const { readFileSync } = require("fs");
const exec = require("./executor.js");
const isTag = a => /^[\w-]+$/.test(a);
const isWS = a => /^\s+$/.test(a);
class Statement {
	/**
	 * @param {string} value The value
	 * @param {boolean} evaluate Whether to execute value as JS code
	 */
	constructor(value = "", evaluate = false) {
		this.value = value;
		this.evaluate = evaluate;
	}
	/**
	 * Evaluates the value.
	 * @param {[x: string]: any} opts Passed variables
	 * @returns {Promise}
	 */
	get(opts) {
		if (this.evaluate) return exec(this.value, opts);
		return this.value;
	}
	/**
	 * @param {string} source Statement source
	 * @returns {Statement}
	 */
	static from(source) {
		return new Statement(
			source.startsWith(">") ? source.slice(1) : source,
			source.startsWith(">")
		);
	}
}

class Attributes {
	/**
	 * @param {[x: string]: Statement} attributes
	 */
	constructor(attributes = {}) {
		Object.assign(this, attributes);
	}
	/**
	 * Creates an Attributes object from Poggies syntax.
	 * @param {string} source The source string to parse from
	 * @param {number} index The index to start parsing from
	 * @returns {{attrs: Attributes, index: number}} The resulting attributes, and the index at which it ended.
	 */
	static from(source, index) {
		let attrs = [];
		let valuing = false;
		while (
			(source[index] === "(" || isWS(source[index])) &&
			index < source.length
		) {
			if (source[index] === "(") index++;
			let key = null;
			let value = null;
			let curr = source[index];
			let ignoreNext = false;
			while (++index < source.length) {
				if (!ignoreNext) {
					if (source[index] === "\\") {
						ignoreNext = true;
						continue;
					} else if (source[index] === `=`) {
						key = curr;
						curr = "";
						index++;
						continue;
					} else if (valuing && source[index] === ` `) {
						value = curr;
						curr = "";
						break;
					} else if (source[index] === `"`) {
						index++;
						valuing = !valuing;
						if (value == null) value = curr;
						curr = "";
						break;
					} else if (!valuing && source[index] === `)`) {
						if (value == null) value = curr;
						break;
					}
				}
				curr += source[index];
				ignoreNext = false;
			}
			if (!(key == null || value == null)) {
				attrs.push([key, value]);
				key = null;
				value = null;
			}
		}
		while (index < source.length && isWS(source[index])) index++;
		index++;
		return {
			index,
			attrs: new Attributes(
				Object.fromEntries(
					attrs.map(entries =>
						entries.map((v, i) => (i === 1 && Statement.from(v)) || v.trim())
					)
				)
			)
		};
	}
}

class Element {
	/**
	 * @param {string} tag Element tag
	 * @param {Element[]} children The element's children
	 * @param {Statement} content Element's inner text
	 * @param {Attributes} attributes Element's attributes
	 */
	constructor(
		tag = "",
		children = [],
		content = new Statement(),
		attributes = new Attributes()
	) {
		this.tag = tag;
		this.children = children;
		this.content = content;
		this.attributes = attributes;
	}
	/**
	 * Creates an Element from Poggies syntax.
	 * @param {string} source The source string to parse from
	 * @param {number} index The index to start parsing from
	 * @returns {{element: Element, index: number}} The resulting element, and the index at which it ended.
	 */
	static from(source, index = 0) {
		let returning = new Element();
		const len = source.length;
		while (index < len && isWS(source[index])) index++;
		for (; index < len && isTag(source[index]); index++)
			returning.tag += source[index];
		while (index < len && isWS(source[index])) index++;

		// Attributes
		if (source[index] === "(") {
			const attrs = Attributes.from(source, index);
			returning.attributes = attrs.attrs;
			index = attrs.index;
		}
		// Content
		if (source[index] === "[") {
			let content = "";
			let ignoreNext = false;
			while (++index < len) {
				if (!ignoreNext) {
					if (source[index] === "\\") {
						ignoreNext = true;
						continue;
					} else if (source[index] === "]") break;
				}
				ignoreNext = false;
				content += source[index];
			}
			returning.content = Statement.from(content.trim());
			while (index < len && isWS(source[index])) index++;
		}

		// Children
		if (source[index] === "{") {
			index++;
			while (index < len && isWS(source[index])) index++;
			let child = { index };
			while (isTag(source[index])) {
				const ind = index;
				if (source[ind] === "}") break;
				child = Element.from(source, ind);
				returning.children.push(child.element);
				index = child.index + 1;
				while (index < len && isWS(source[index])) index++;
			}
			returning.children = returning.children.filter(a => a.tag);
		}
		return { element: returning, index };
	}
}
/**
 * Converts an Element to HTML
 * @param {Element} element Element to HTMLify
 * @param {{[x: string]: any}} passing Passed variables
 * @returns {Promise<string>} The HTML
 */
const htmlify = async (element, passing) => {
	let result = `<${element.tag}`;
	for (let key in element.attributes)
		result += ` ${key}="${await element.attributes[key].get(passing)}"`;
	result += `>${await element.content.get(passing)}`;
	for (let child of element.children) result += await htmlify(child, passing);
	result += `</${element.tag}>`;
	return result;
};

class Poggies {
	/**
	 * @param {string} content Poggies code to parse
	 */
	constructor(content) {
		this.parsed = Element.from(content).element;
	}
	/**
	 * Renders this Poggies document with some given variables
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	render(passing = {}) {
		return htmlify(this.parsed, passing);
	}
}

const cache = {};

/**
 * Renders a Poggies file with some given variables
 * @param {string} file File path
 * @param {{[x: string]: any}} passing Passed variables
 * @returns
 */
const renderFile = (file, passing) => {
	if (!(file in cache))
		cache[file] = new Poggies(readFileSync(file).toString());
	return cache[file].render(passing);
};
module.exports = { Poggies, renderFile };
