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
class Attribute {
	constructor(public code: string) {}
	jsify() {
		return this.code
	}
	/** adds ` ${value}` to the end of the attribute */
	add(value: string) {
		this.code = `(${this.code})+${JSON.stringify(` ${value}`)}`
	}
}

class Flag {
	jsify() {
		return "true"
	}
}
function parseAttributes(reader: Reader) {
	const attributes: Record<
		string,
		Attribute | Flag
	> = {}
	while (!reader.eof()) {
		reader.whitespace()
		if (reader.peek() === ")") {
			reader.skip(1)
			break
		}
		const key = reader.tag()
		reader.whitespace()
		if (reader.peek() === "=") {
			reader.skip(1)
		} else {
			attributes[key] = new Flag()
			continue
		} // skip =
		reader.whitespace()
		switch (reader.peek()) {
			case '"':
			case "'":
			case "`":
			case "[":
			case "(": {
				const expression = reader.jsExpression()
				attributes[key] = new Attribute(expression)
				break
			}
			case "{": {
				const expression = reader.jsExpression().slice(1, -1)
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
			Attribute | Flag
		>,
	) {}
	jsify() {
		const attributes = Object.entries(this.attributes)
		if (attributes.length === 0) {
			return { multiline: false, code: JSON.stringify(`<${this.tag}>`) }
		}
		let code = JSON.stringify(`<${this.tag}`)
		for (const [name, attribute] of attributes) {
			code += attribute instanceof Flag
				? `+${JSON.stringify(` ${name}`)}`
				: `+${JSON.stringify(` ${name}="`)}+${attribute.jsify()}+'"'`
		}
		code += '+">"'
		return { multiline: false, code }
	}
}
export class Element extends VoidElement {
	constructor(
		public tag: string,
		public attributes: Record<string, Attribute | Attribute | Flag>,
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
	static from(tag: string, reader: Reader, isVoid = false): VoidElement | Element {
		let attributes_: Record<string, Attribute | Attribute | Flag> = {}
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
					else if (attributes_.class instanceof Flag) {
						attributes_.class = new Attribute(JSON.stringify(clazz))
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
		const children = ChildNodes.from(reader)
		if (isVoid || voidElements.has(tag.toLowerCase())) {
			if (children.nodes.length > 0) {
				throw new Error(`${tag} cannot have children`)
			} else return new VoidElement(tag, attributes_)
		}
		return new Element(tag, attributes_, children)
	}
}
