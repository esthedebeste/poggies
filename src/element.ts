import { ChildNodes, JSONify, Node } from "./nodes.js";
import { isTag, isWS, jsonifyfunc, outvar } from "./utils.js";

/** Elements that shouldn't have a closing tag */
export const voidElements = new Set([
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
	"source",
	"!doctype",
]);
class Attribute {
	constructor(public value: string) {}
	jsify() {
		return JSONify(this.value);
	}
	/** adds a string to the end of the attribute */
	add(value: string) {
		this.value += " " + value;
	}
}
class DynamicAttribute {
	constructor(public code: string) {}
	jsify() {
		return `${jsonifyfunc}(${this.code})`;
	}
	/** adds a string to the end of the attribute */
	add(value: string) {
		this.code = `(${this.code}) + ${JSONify(value)}`;
	}
}
class Flag {}
const parseAttributes = (source: string, index: number) => {
	const attributes: Record<string, Attribute | DynamicAttribute | Flag> = {};
	while (index < source.length) {
		while (isWS(source[index]) && index < source.length) index++;
		if (source[index] === ")") {
			index++;
			break;
		}
		let key = "";
		for (; index < source.length && isTag(source[index]); index++)
			key += source[index];
		while (isWS(source[index]) && index < source.length) index++;
		let value = "";
		let type: typeof Attribute | typeof DynamicAttribute | typeof Flag = Flag;
		if (source[index] === "=") {
			type = Attribute;
			index++;
			if (source[index] === ">") {
				type = DynamicAttribute;
				index++;
			}
			let singleWord = true;
			if (source[index] === '"') {
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
		attributes[key] = new type(value);
	}
	return { attributes, index };
};
const isAttr = (kv: [string, any]): kv is [string, Attribute] =>
	kv[1] instanceof Attribute;
const isDynAttr = (kv: [string, any]): kv is [string, DynamicAttribute] =>
	kv[1] instanceof DynamicAttribute;
const isFlag = (kv: [string, any]): kv is [string, Flag] =>
	kv[1] instanceof Flag;
class VoidElement implements Node {
	constructor(
		public tag: string,
		public attrs: Record<string, Attribute | DynamicAttribute | Flag>
	) {}
	jsify() {
		const attrs = Object.entries(this.attrs);
		if (attrs.length === 0)
			return { multiline: false, code: `"<${this.tag}>"` };
		const staticAttrs =
			attrs
				.filter(isAttr)
				.map(([name, attr]) => ` ${name}=${attr.jsify()}`)
				.join("") +
			attrs
				.filter(isFlag)
				.map(([name]) => ` ${name}`)
				.join("");
		const dynAttrs = attrs.filter(isDynAttr);
		if (dynAttrs.length === 0)
			return {
				multiline: false,
				code: JSON.stringify(`<${this.tag}${staticAttrs}>`),
			};
		let code = JSON.stringify(`<${this.tag}${staticAttrs}`);
		for (const [name, attr] of dynAttrs)
			code += "+" + JSONify(" " + name + "=") + "+" + attr.jsify();
		code += '+">"';
		return { multiline: false, code };
	}
}
export class Element extends VoidElement {
	constructor(
		public tag: string,
		public attrs: Record<string, Attribute | DynamicAttribute | Flag>,
		public children: ChildNodes
	) {
		super(tag, attrs);
	}
	jsify() {
		const { code } = super.jsify();
		const { multiline, code: childCode } = this.children.jsify();
		if (childCode.length === 0)
			return { multiline, code: code + "+" + JSONify(`</${this.tag}>`) };
		return {
			multiline,
			code: multiline
				? `${outvar}+=${code};${childCode}${outvar} += ${JSONify(
						`</${this.tag}>`
				  )};`
				: `${code}+${childCode}+${JSONify(`</${this.tag}>`)}`,
		};
	}
	static from(source: string, index: number) {
		const len = source.length;
		let tag = "";
		for (; index < len && isTag(source[index]); index++) tag += source[index];
		let attrs: Record<string, Attribute | DynamicAttribute | Flag> = {};
		while ("(.#".includes(source[index])) {
			if (source[index] === "(") {
				index++;
				let attributes: Record<string, Attribute | DynamicAttribute | Flag>;
				({ attributes, index } = parseAttributes(source, index));
				attrs = { ...attrs, ...attributes };
			} else if (source[index] === ".") {
				index++;
				let clazz = "";
				for (; index < len && isTag(source[index]); index++)
					clazz += source[index];
				if (attrs.class == null) attrs.class = new Attribute(clazz);
				else if (attrs.class instanceof Flag)
					attrs.class = new Attribute(clazz);
				else attrs.class.add(clazz);
			} else if (source[index] === "#") {
				index++;
				let id = "";
				for (; index < len && isTag(source[index]); index++)
					id += source[index];
				attrs.id = new Attribute(id);
			}
		}

		while (isWS(source[index]) && index < len) index++;
		let children: ChildNodes;
		({ children, index } = ChildNodes.from(source, index));
		if (voidElements.has(tag.toLowerCase()))
			if (children.nodes.length > 0)
				throw new Error(`${tag} cannot have children`);
			else return { node: new VoidElement(tag, attrs), index };
		return {
			node: new Element(tag, attrs, children),
			index,
		};
	}
}
