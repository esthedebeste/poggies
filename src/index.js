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
		// Index is the index of the starting (, which we can skip for parsing.
		index++;
		const attrs = {};
		for (; index < source.length; index++) {
			while (isWS(source[index]) && index < source.length) index++;
			if (source[index] === ")") {
				return {
					index: index + 1,
					attrs: new Attributes(attrs)
				};
			}
			let key = "";
			for (; index < source.length && isTag(source[index]); index++)
				key += source[index];
			while (isWS(source[index]) && index < source.length) index++;
			let value = "";
			let evaluate = false;
			if (source[index] === "=") {
				index++;
				if (source[index] === ">") {
					evaluate = true;
					index++;
				}
				if (source[index] !== `"`)
					throw new Error(`Invalid attribute, no ending "`);
				index++;
				let escape = 0;
				for (; index < source.length; index++) {
					if (source[index] === "\\") escape++;
					else if (source[index] === `"` && escape % 2 === 0) break;
					else if (escape - 1 > 0) {
						value += "\\".repeat(escape / 2);
						escape = 0;
						value += source[index];
					} else value += source[index];
				}
			}
			attrs[key] = new Statement(value, evaluate);
		}
		throw new Error(`Element doesn't have closing ) tag.`);
	}
}

class Element {
	/**
	 * @param {string} tag Element tag
	 * @param {Element[]} children The element's children
	 * @param {string} id The element's id field
	 * @param {string[]} classList The element's classes
	 * @param {Statement} content Element's inner text
	 * @param {Attributes} attributes Element's attributes
	 */
	constructor(
		tag = "",
		children = [],
		id = "",
		classList = [],
		content = new Statement(),
		attributes = new Attributes()
	) {
		this.tag = tag;
		this.children = children;
		this.id = id;
		this.classList = classList;
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
		while (isWS(source[index]) && index < len) index++;
		for (; index < len && isTag(source[index]); index++)
			returning.tag += source[index];
		while (isWS(source[index]) && index < len) index++;
		if (source[index] === "#") {
			index++;
			for (; index < len && isTag(source[index]); index++)
				returning.id += source[index];
		}
		while (source[index] === ".") {
			index++;
			let clas = "";
			for (; index < len && isTag(source[index]); index++)
				clas += source[index];
			returning.classList.push(clas);
		}
		// Attributes
		if (source[index] === "(")
			({ index, attrs: returning.attributes } = Attributes.from(source, index));
		// Content
		if (source[index] === "[") {
			let content = "";
			let ignoreNext = false;
			while (++index < len)
				if (ignoreNext) ignoreNext = false;
				else if (source[index] === "\\") ignoreNext = true;
				else if (source[index] === "]") break;
				else content += source[index];
			returning.content = Statement.from(content.trim());
			while (isWS(source[index]) && index < len) index++;
		}

		// Children
		if (source[index] === "{") {
			while (isWS(source[++index]) && index < source.length);
			while (isTag(source[index])) {
				let element;
				({ element, index } = Element.from(source, index));
				returning.children.push(element);
				while (isWS(source[++index]) && index < source.length);
			}
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
	if (element.id) result += ` id="${element.id}"`;
	if (element.classList.length > 0)
		result += ` class="${element.classList.join(" ")}"`;
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

const fileCache = {};
/**
 * Renders a Poggies file with some given variables
 * @param {string} file File path
 * @param {{[x: string]: any}} passing Passed variables
 * @returns {Promise<string>} The HTML
 */
const renderFile = (file, passing) => {
	if (!(file in fileCache))
		fileCache[file] = new Poggies(readFileSync(file).toString());
	return fileCache[file].render(passing);
};
module.exports = { Poggies, renderFile };
