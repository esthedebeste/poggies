import { ChildNodes, Node } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { inline, isWS, JsifyResult } from "./utils.ts"

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

export class WithBlock {
	constructor(public script?: ChildNodes) {}
	static from(reader: Reader) {
		reader.whitespace()
		if (!reader.check("with")) return
		reader.whitespace()
		if (reader.check("script")) {
			reader.whitespace()
			return new WithBlock(Element.from("script", reader).children)
		} else throw new Error("Expected script after with")
	}
}

export class Element implements Node {
	constructor(
		public tag: string,
		public attributes: Record<string, Attribute | SlotAttribute | Flag>,
		public children?: ChildNodes,
		public withBlock?: WithBlock,
	) {}
	jsify() {
		const attributes = Object.entries(this.attributes) as [string, Attribute | Flag][]
		if (attributes.some((attribute) => attribute[1] instanceof SlotAttribute)) {
			throw new Error("Non-template elements can't have slot attributes")
		}
		let code = JsifyResult.add(
			inline(JSON.stringify(`<${this.tag}`)),
			...attributes.flatMap(([name, attribute]) =>
				attribute instanceof Flag ? [inline(`" ${name}"`)] : [
					inline(`" ${name}=\\""`),
					inline(attribute.jsify()),
					inline('"\\""'),
				]
			),
			inline('">"'),
		)
		const children = this.children?.jsify()
		if (children != undefined && children.code.length > 0) {
			code = code.add(children)
		}
		if (!voidElements.has(this.tag.toLowerCase())) {
			code = code.add(inline(JSON.stringify(`</${this.tag}>`)))
		}
		if (this.withBlock?.script) {
			const script = this.withBlock.script.jsify()
			// mostly for custom elements: `3rd-char=1-1` => `_3rdChar_1_1`
			// h1 => h1, p => p, my-element => myElement
			const variableName = this.tag
				.replaceAll(/-[a-z]/g, (match) => match[1].toUpperCase())
				.replace(/^\P{ID_Start}/u, "_$&")
				.replaceAll(/\P{ID_Continue}/ug, "_")
			code = code.add(
				inline(`"<script>(function(${variableName}){"`),
				script,
				inline('"}(document.currentScript.previousElementSibling))</script>"'),
			)
		}
		return code
	}
	static from(tag: string, reader: Reader): Element {
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
		if (voidElements.has(tag.toLowerCase())) {
			return new Element(tag, attributes_, undefined, WithBlock.from(reader))
		}
		const children = ChildNodes.from(reader, tag === "script" || tag === "style")
		return new Element(tag, attributes_, children, WithBlock.from(reader))
	}
}
