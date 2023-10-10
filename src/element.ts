import { ChildNodes, Node } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { isWS, outvar } from "./utils.ts"

/** Elements that shouldn't have a closing tag */
const voidElements = new Set([
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
])
export class Attribute {
	constructor(public code: string) {}
	jsify() {
		return this.code
	}
	/** adds ` ${value}` to the end of the attribute */
	add(value: string) {
		this.code = `(${this.code})+${JSON.stringify(` ${value}`)}`
	}
}

export class SlotAttribute {
	constructor(public children: ChildNodes) {}
	jsify() {
		return this.children.jsify()
	}
}

export class Flag {
	jsify() {
		return "true"
	}
}
function parseAttributes(reader: Reader) {
	const attributes: Record<
		string,
		Attribute | SlotAttribute | Flag
	> = {}
	while (!reader.eof()) {
		reader.whitespace()
		if (reader.peek() === ")") {
			reader.skip(1)
			break
		}
		if (reader.check("(")) {
			// a((href)) => a(href=(href)) shorthand
			const name = reader.identifier()
			if (!reader.check(")")) {
				throw new Error("expected ) after tag in attribute shortcut (`a((href))` => `a(href=(href))`)")
			}
			attributes[name] = new Attribute(name)
			continue
		}
		const key = reader.tag()
		reader.whitespace()
		if (!reader.check("=")) {
			attributes[key] = new Flag()
			continue
		} // skip =
		switch (reader.peek()) {
			case "{": {
				const children = ChildNodes.from(reader)
				attributes[key] = new SlotAttribute(children)
				break
			}
			case '"':
			case "'":
			case "`": {
				const string = reader.jsString()
				attributes[key] = new Attribute(string)
				break
			}
			case "[":
			case "(": {
				const expression = reader.jsExpression()
				attributes[key] = new Attribute(expression)
				break
			}
			default: // single word string
			{
				const string = reader.collect((char) => !(isWS(char) || char === ")"))
				attributes[key] = new Attribute(JSON.stringify(string))
			}
		}
	}
	return attributes
}

export class VoidElement implements Node {
	constructor(
		public tag: string,
		public attributes: Record<
			string,
			Attribute | SlotAttribute | Flag
		>,
	) {}
	jsify() {
		const attributes = Object.entries(this.attributes) as [string, Attribute | Flag][]
		if (attributes.length === 0) {
			return { multiline: false, code: JSON.stringify(`<${this.tag}>`) }
		}
		if (attributes.some((attribute) => attribute[1] instanceof SlotAttribute)) {
			throw new Error("Non-template elements can't have slot attributes")
		}
		let code = JSON.stringify(`<${this.tag}`)
		for (const [name, attribute] of attributes) {
			code += attribute instanceof Flag
				? `+${JSON.stringify(` ${name}`)}`
				: `+${JSON.stringify(` ${name}="`)}+${attribute.code}+'"'`
		}
		code += '+">"'
		return { multiline: false, code }
	}
}
export class Element extends VoidElement {
	constructor(
		public tag: string,
		public attributes: Record<string, Attribute | SlotAttribute | Flag>,
		public children: ChildNodes,
	) {
		super(tag, attributes)
	}
	jsify() {
		const { code } = super.jsify()
		const { multiline, code: childCode } = this.children.jsify()
		if (childCode.length === 0) {
			return { multiline, code: code + "+" + JSON.stringify(`</${this.tag}>`) }
		}
		return {
			multiline,
			code: multiline
				? `${outvar}+=${code};${childCode}${outvar} += ${
					JSON.stringify(
						`</${this.tag}>`,
					)
				};`
				: `${code}+${childCode}+${JSON.stringify(`</${this.tag}>`)}`,
		}
	}
	static from(tag: string, reader: Reader): Element
	static from(tag: string, reader: Reader, isVoid: false): Element
	static from(tag: string, reader: Reader, isVoid: true): VoidElement
	static from(tag: string, reader: Reader, isVoid = false): VoidElement | Element {
		let attributes_: Record<string, Attribute | SlotAttribute | Flag> = {}
		while ("(.#".includes(reader.peek())) {
			switch (reader.peek()) {
				case "(": {
					reader.skip(1)
					const attributes = parseAttributes(reader)
					attributes_ = { ...attributes_, ...attributes }
					break
				}
				case ".": {
					reader.skip(1)
					const clazz = reader.tag()
					if (attributes_.class == undefined) attributes_.class = new Attribute(JSON.stringify(clazz))
					else if (attributes_.class instanceof Flag) attributes_.class = new Attribute(JSON.stringify(clazz))
					else if (attributes_.class instanceof SlotAttribute) {
						throw new TypeError("Can't use .class shortcut if class is already defined as a slot attribute")
					} else attributes_.class.add(clazz)
					break
				}
				case "#": {
					reader.skip(1)
					const id = reader.tag()
					attributes_.id = new Attribute(JSON.stringify(id))
					break
				}
					// No default
			}
		}
		reader.whitespace()
		if (isVoid || voidElements.has(tag.toLowerCase())) {
			return new VoidElement(tag, attributes_)
		}
		const children = ChildNodes.from(reader)
		return new Element(tag, attributes_, children)
	}
}
