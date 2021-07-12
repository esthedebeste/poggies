const { readFileSync } = require("fs");
const exec = require("./executor.js");
const isTag = a => /^[\w-]+$/.test(a);
const isWS = a => /^\s+$/.test(a);
class Statement {
	constructor(value = "", evaluate = false) {
		this.value = value;
		this.evaluate = evaluate;
	}
	async get(opts) {
		if (this.evaluate) return await exec(this.value, opts);
		return await this.value;
	}
	static from(source) {
		return new Statement(
			source.startsWith(">") ? source.slice(1) : source,
			source.startsWith(">")
		);
	}
}

class Attributes {
	constructor(attributes = {}) {
		Object.assign(this, attributes);
	}
	static from(source, i) {
		let attrs = [];
		let valuing = false;
		while ((source[i] === "(" || isWS(source[i])) && i < source.length) {
			if (source[i] === "(") i++;
			let key = null;
			let value = null;
			let curr = source[i];
			let ignoreNext = false;
			while (++i < source.length) {
				if (!ignoreNext) {
					if (source[i] === "\\") {
						ignoreNext = true;
						continue;
					} else if (source[i] === `=`) {
						key = curr;
						curr = "";
						i++;
						continue;
					} else if (valuing && source[i] === ` `) {
						value = curr;
						curr = "";
						break;
					} else if (source[i] === `"`) {
						i++;
						valuing = !valuing;
						if (value == null) value = curr;
						curr = "";
						break;
					} else if (!valuing && source[i] === `)`) {
						if (value == null) value = curr;
						break;
					}
				}
				curr += source[i];
				ignoreNext = false;
			}
			if (!(key == null || value == null)) {
				attrs.push([key, value]);
				key = null;
				value = null;
			}
		}
		while (i < source.length && isWS(source[i])) i++;
		i++;
		return {
			i,
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
	 * @param {string} tag
	 * @param {Element[]} children
	 * @param {Statement} content
	 * @param {Attributes} attributes
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
	static from(source, index = 0) {
		let returning = new Element();
		const len = source.length;
		while (index < len && isWS(source[index])) index++;
		for (; index < len && isTag(source[index]); index++)
			returning.tag += source[index];
		while (index < len && isWS(source[index])) index++;

		// Attributes
		if (source[index] === "(") {
			const { attrs, i } = Attributes.from(source, index);
			returning.attributes = attrs;
			index = i;
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

class Poggies {
	/**
	 * @param {string} content Text to parse
	 */
	constructor(content) {
		this.parsed = Element.from(content).element;
	}
	/** @private */
	async htmlify(element, passing) {
		let result = `<${element.tag}`;
		for (let key in element.attributes)
			result += ` ${key}="${await element.attributes[key].get(passing)}"`;
		result += `>${await element.content.get(passing)}`;
		for (let child of element.children)
			result += await this.htmlify(child, passing);
		result += `</${element.tag}>`;
		return result;
	}
	/**
	 * @param {object} passing What to pass to template statements
	 */
	async render(passing = {}) {
		return await this.htmlify(this.parsed, passing);
	}
}
const renderFile = (file, passing) =>
	new Poggies(readFileSync(file).toString()).render(passing);
module.exports = { Poggies, renderFile };
