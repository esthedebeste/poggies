const { readFileSync } = require("fs");
const exec = require("./executor.js");
const isTag = a => /^[\w-]+$/.test(a);
const isWS = a => /^\s+$/.test(a);
/** Elements that shouldn't have a closing tag */
const voidElements = [
	"area",
	"base",
	"br",
	"col",
	"hr",
	"img",
	"input",
	"link",
	"meta",
	"param",
	"command",
	"keygen",
	"source"
];
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
		while (index < source.length) {
			while (isWS(source[index]) && index < source.length) index++;
			if (source[index] === ")") {
				return {
					index: index,
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
				index++;
			}
			attrs[key] = new Statement(value, evaluate);
		}
		throw new Error(`Element doesn't have closing ) tag.`);
	}
}

class ForElement {
	/**
	 * @param {(Element|ForElement|IfElement)[]} children
	 * @param {string} valueName
	 * @param {string} arrayName
	 */
	constructor(children, valueName, arrayName) {
		this.children = children;
		this.valueName = valueName;
		this.arrayName = arrayName;
	}

	/**
	 * Converts this to HTML
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async htmlify(passing) {
		if (!(this.arrayName in passing))
			throw new Error("Array not found in parameters.");
		const array = passing[this.arrayName];
		if (array == null || typeof array[Symbol.iterator] !== "function")
			throw new Error("Object passed isn't iterable.");
		let returning = "";
		const passingCopy = { ...passing };
		for (const value of passing[this.arrayName]) {
			passingCopy[this.valueName] = value;
			for (const child of this.children)
				returning += await child.htmlify(passingCopy);
		}
		return returning;
	}
	/**
	 * Creates an For Element from Poggies syntax, starting at (
	 * @param {string} source The source string to parse from
	 * @param {number} index The index to start parsing from
	 * @returns {{element: ForElement, index: number}} The resulting ForElement, and the index at which it ended.
	 */
	static from(source, index) {
		const len = source.length;
		if (source[index++] !== "(") throw new Error("Expected ( after for");
		while (isWS(source[index]) && index < len) index++;
		let valueName = "";
		for (; index < len && isTag(source[index]); index++)
			valueName += source[index];
		while (isWS(source[index]) && index < len) index++;
		let forType = "";
		for (; index < len && isTag(source[index]); index++)
			forType += source[index];
		if (forType != "of")
			throw new Error(`Invalid for method "${forType}" (expected "of")`);
		while (isWS(source[index]) && index < len) index++;
		let arrayName = "";
		for (; index < len && isTag(source[index]); index++)
			arrayName += source[index];
		while (isWS(source[index]) && index < len) index++;
		if (source[index++] !== ")")
			throw new Error("Expected closing ) in for statement");
		if (source[index++] !== "{")
			throw new Error("Expected { after for statement");
		// Children
		let children = [];
		while (isWS(source[index]) && index < len) index++;
		while (isTag(source[index])) {
			let element;
			({ element, index } = Element.from(source, index));
			children.push(element);
			index++;
			while (isWS(source[index]) && index < len) index++;
		}
		return { element: new ForElement(children, valueName, arrayName), index };
	}
}

class IfElement {
	/**
	 * @param {(Element|ForElement|IfElement)[]} children
	 * @param {string} condition JS Code to test
	 */
	constructor(children, condition) {
		this.children = children;
		this.condition = condition;
	}

	/**
	 * Converts this to HTML
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async htmlify(passing) {
		if (!(await exec(this.condition, passing))) return "";
		let returning = "";
		for (const child of this.children)
			returning += await child.htmlify(passing);
		return returning;
	}

	/**
	 * Creates an If Element from Poggies syntax, starting at (
	 * @param {string} source The source string to parse from
	 * @param {number} index The index to start parsing from
	 * @returns {{element: IfElement, index: number}} The resulting IfElement, and the index at which it ended.
	 */
	static from(source, index) {
		const len = source.length;
		if (source[index++] !== "(") throw new Error("Expected ( after if");
		while (isWS(source[index]) && index < len) index++;
		let condition = "";
		let opening = 1;
		let closing = 0;
		while (index < source.length && opening > closing) {
			if (source[index] === "(") opening++;
			else if (source[index] === ")") closing++;
			condition += source[index];
			index++;
		}
		condition = condition.slice(0, -1);
		if (source[index++] !== "{")
			throw new Error("Expected { after if statement");
		// Children
		let children = [];
		while (isWS(source[index]) && index < len) index++;
		while (isTag(source[index])) {
			let element;
			({ element, index } = Element.from(source, index));
			children.push(element);
			index++;
			while (isWS(source[index]) && index < len) index++;
		}
		return { element: new IfElement(children, condition), index };
	}
}

const htmlescapes = {
	"&": "&amp;",
	'"': "&quot;",
	"<": "&lt;",
	">": "&gt;"
};
/**
 * @param {string} unescaped Unescaped text
 * @returns {string} The same text but HTML-escaped (Similar to DOM Element.innerText)
 */
const htmlescape = unescaped =>
	unescaped.replace(/[&"<>]/g, c => htmlescapes[c]);

class Element {
	/**
	 * @param {string} tag Element tag
	 * @param {(Element|ForElement|IfElement)[]} children The element's children
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
	 * Converts this to HTML
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async htmlify(passing) {
		let result = `<${this.tag}`;
		if (this.id) result += ` id="${this.id}"`;
		if (this.classList.length > 0)
			result += ` class="${this.classList.join(" ")}"`;
		for (let key in this.attributes) {
			const value = await this.attributes[key].get(passing);
			if (value === "") result += ` ${key}`;
			else result += ` ${key}="${value}"`;
		}
		let content = await this.content.get(passing);
		if (typeof content !== "string") content = JSON.stringify(content);
		// Void Elements (Elements that shouldn't have content)
		if (
			voidElements.includes(this.tag) &&
			content.length === 0 &&
			this.children.length === 0
		)
			return result + "/>";
		result += `>${htmlescape(content)}`;
		for (let child of this.children) result += await child.htmlify(passing);
		result += `</${this.tag}>`;
		return result;
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
			while (isWS(source[index]) && index < len) index++;
		}
		while (source[index] === ".") {
			index++;
			let clas = "";
			for (; index < len && isTag(source[index]); index++)
				clas += source[index];
			returning.classList.push(clas);
			while (isWS(source[index]) && index < len) index++;
		}
		// Attributes
		if (source[index] === "(") {
			({ index, attrs: returning.attributes } = Attributes.from(source, index));
			index++;
			while (isWS(source[index]) && index < len) index++;
		}
		// Content
		if (source[index] === "[") {
			let content = "";
			let ignoreNext = false;
			while (++index < len)
				if (ignoreNext) ignoreNext = false;
				else if (source[index] === "\\") ignoreNext = true;
				else if (source[index] === "]") break;
				else content += source[index];
			returning.content = Statement.from(content);
			index++;
			while (isWS(source[index]) && index < len) index++;
		}

		// Children
		if (source[index] === "{") {
			index++;
			while (isWS(source[index]) && index < len) index++;
			while (isTag(source[index])) {
				let element;
				({ element, index } = Element.from(source, index));
				returning.children.push(element);
				index++;
				while (isWS(source[index]) && index < len) index++;
			}
			index++;
			while (isWS(source[index]) && index < len) index++;
		}

		// Dynamics (if, or)
		if (source[index] === "<") {
			index++;
			while (source[index] !== ">") {
				while (isWS(source[index]) && index < len) index++;
				let type = "";
				for (; index < len && isTag(source[index]); index++)
					type += source[index];
				while (isWS(source[index]) && index < len) index++;
				let element;
				if (type === "for")
					({ element, index } = ForElement.from(source, index));
				else if (type === "if")
					({ element, index } = IfElement.from(source, index));
				else
					throw new Error(
						`Invalid dynamic "${type}" (did you mean to use {} instead of <>?)}`
					);
				returning.children.push(element);
				index++;
				while (isWS(source[index]) && index < len) index++;
			}
			index++;
			while (isWS(source[index]) && index < len) index++;
		}
		return { element: returning, index: index - 1 };
	}
}

class Poggies {
	/**
	 * Root element's children.
	 * @type {Element[]}
	 */
	parsed = [];
	/**
	 * Initializes a Poggies document
	 * @param {string} source Poggies code to parse
	 */
	constructor(source) {
		let index = 0;
		while (isWS(source[index]) && index < source.length) index++;
		while (isTag(source[index]) && index < source.length) {
			let element;
			({ element, index } = Element.from(source, index));
			this.parsed.push(element);
			index++;
			while (isWS(source[index]) && index < source.length) index++;
		}
	}
	/**
	 * Renders this Poggies document with some given variables
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async render(passing = {}) {
		let result = ``;
		for (const element of this.parsed) result += await element.htmlify(passing);
		return result;
	}
}

const fileCache = new Map();
/**
 * Renders a Poggies file with some given variables
 * @param {string} file File path
 * @param {{[x: string]: any}} passing Passed variables
 * @returns {Promise<string>} The HTML
 */
const renderFile = (file, passing) => {
	if (!fileCache.has(file))
		fileCache.set(file, new Poggies(readFileSync(file).toString()));
	return fileCache.get(file).render(passing);
};
// Support for express templating
const __express = (file, passing, _options, callback) =>
	renderFile(file, passing)
		.then(result => callback(null, result))
		.catch(err => callback(err));
module.exports = { Poggies, renderFile, __express };
