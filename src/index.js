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
				let singleWord = true;
				if (source[index] === `"`) {
					singleWord = false;
					index++;
				}
				let escape = 0;
				for (; index < source.length; index++) {
					if (source[index] === "\\") escape++;
					else if (singleWord && (source[index] === ")" || isWS(source[index])))
						break;
					else if (source[index] === `"` && escape % 2 === 0) {
						index++;
						break;
					} else if (escape - 1 > 0) {
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

class TextNode {
	/**
	 * @param {Statement} content
	 */
	constructor(content) {
		this.content = content;
	}
	/**
	 * Creates a TextNode from Poggies syntax.
	 * @param {string} source The source string to parse from
	 * @param {number} index The index to start parsing from
	 * @returns {{element: TextNode, index: number}} The resulting element, and the index at which it ended.
	 */
	static from(source, index) {
		let content = "";
		let ignoreNext = false;
		while (++index < source.length)
			if (ignoreNext) ignoreNext = false;
			else if (source[index] === "\\") ignoreNext = true;
			else if (source[index] === "]") break;
			else content += source[index];
		return {
			element: new TextNode(Statement.from(content)),
			index
		};
	}
	/**
	 * Converts this to HTML
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async htmlify(passing) {
		let content = await this.content.get(passing);
		if (typeof content !== "string") content = JSON.stringify(content);
		return htmlescape(content);
	}
}

class ForElement {
	/**
	 * @param {ChildNodes} children
	 * @param {string} valueName
	 * @param {string} arrayPath
	 */
	constructor(children, valueName, arrayPath) {
		this.children = children;
		this.valueName = valueName;
		this.arrayPath = arrayPath;
	}

	/**
	 * Converts this to HTML
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async htmlify(passing) {
		let array = passing;
		for (const part of this.arrayPath)
			if (part in array) array = array[part];
			else throw new Error("Array not found in parameters.");
		if (array == null || typeof array[Symbol.iterator] !== "function")
			throw new Error("Object passed isn't iterable.");
		let returning = "";
		const passingCopy = { ...passing };
		for (const value of array) {
			passingCopy[this.valueName] = value;
			returning += await this.children.htmlify(passingCopy);
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
		let arrayPath = [];
		index--;
		do {
			index++;
			let arrayName = "";
			for (; index < len && isTag(source[index]); index++)
				arrayName += source[index];
			arrayPath.push(arrayName);
		} while (source[index] === ".");
		while (isWS(source[index]) && index < len) index++;
		if (source[index++] !== ")")
			throw new Error("Expected closing ) in for statement");
		// Children
		let children;
		({ children, index } = ChildNodes.from(source, index));
		return { element: new ForElement(children, valueName, arrayPath), index };
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
		if (await exec(this.condition, passing))
			return await this.children.htmlify(passing);
		return "";
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
		// Children
		let children;
		({ children, index } = ChildNodes.from(source, index));
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

class ChildNodes {
	/**
	 * @param {TextNode[]} nodes The nodes
	 */
	constructor(nodes) {
		this.nodes = nodes;
	}
	/**
	 * Converts this to HTML
	 * @param {{[x: string]: any}} passing Passed variables
	 * @returns {Promise<string>} The HTML
	 */
	async htmlify(passing) {
		let returning = "";
		for (const node of this.nodes) returning += await node.htmlify(passing);
		return returning;
	}
	/**
	 * Creates an For Element from Poggies syntax, starting at (
	 * @param {string} source The source string to parse from
	 * @param {number} index The index to start parsing from
	 * @returns {{children: ChildNodes, index: number}} The resulting ForElement, and the index at which it ended.
	 */
	static from(source, index) {
		const len = source.length;
		while (isWS(source[index]) && index < len) index++;
		let nodes = [];
		while (index < source.length)
			if (source[index] === "[") {
				const { index: i, element: node } = TextNode.from(source, index);
				nodes.push(node);
				index = i + 1;
				while (isWS(source[index]) && index < len) index++;
			}

			// Children
			else if (source[index] === "{") {
				index++;
				while (isWS(source[index]) && index < len) index++;
				while (isTag(source[index])) {
					let element;
					({ element, index } = Element.from(source, index));
					nodes.push(element);
				}
				index++;
				while (isWS(source[index]) && index < len) index++;
			}

			// Dynamics (if, or)
			else if (source[index] === "<") {
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
					while (isWS(source[index]) && index < len) index++;
					nodes.push(element);
				}
				index++;
				while (isWS(source[index]) && index < len) index++;
			} else break;
		return { children: new ChildNodes(nodes), index };
	}
	get size() {
		return this.nodes.length;
	}
}

class Element {
	/**
	 * @param {string} tag Element tag
	 * @param {ChildNodes} children The element's children
	 * @param {string} id The element's id field
	 * @param {string[]} classList The element's classes
	 * @param {Attributes} attributes Element's attributes
	 */
	constructor(
		tag = "",
		children = [],
		id = "",
		classList = [],
		attributes = new Attributes()
	) {
		this.tag = tag;
		this.children = children;
		this.id = id;
		this.classList = classList;
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
		// Void Elements (Elements that shouldn't have content)
		if (voidElements.includes(this.tag) && this.children.size === 0)
			return result + "/>";
		return result + `>${await this.children.htmlify(passing)}</${this.tag}>`;
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
			index++;
			({ index, attrs: returning.attributes } = Attributes.from(source, index));
			index++;
			while (isWS(source[index]) && index < len) index++;
		}
		({ children: returning.children, index } = ChildNodes.from(source, index));
		return { element: returning, index: index };
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
		}
	}
	/** @typedef {{doctype?:"html"|string|false, cache?:boolean}} Options */
	/**
	 * Renders this Poggies document with some given variables
	 * @param {{[x: string]: any}} passing Passed variables
	 * @param {Options} options Options
	 * @returns {Promise<string>} The HTML
	 */
	async render(passing = {}, options = { doctype: "html" }) {
		let result = "";
		for (const element of this.parsed) result += await element.htmlify(passing);
		if (options.doctype) result = `<!doctype ${options.doctype}>` + result;
		return result;
	}
}

const fileCache = new Map();
/**
 * Renders a Poggies file with some given variables
 * @param {string} file File path
 * @param {{[x: string]: any}} passing Passed variables
 * @param {Options} options Options
 * @returns {Promise<string>} The HTML
 */
const renderFile = (file, passing, options) => {
	if (options.cache === false)
		return new Poggies(readFileSync(file).toString()).render(passing, options);
	if (!fileCache.has(file))
		fileCache.set(file, new Poggies(readFileSync(file).toString()));
	return fileCache.get(file).render(passing, options);
};
/** Support for express templating */
const __express = (file, passing, _options, callback) =>
	renderFile(file, passing).then(
		result => callback(null, result),
		err => callback(err)
	);
module.exports = { Poggies, renderFile, __express };
