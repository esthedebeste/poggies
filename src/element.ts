import { ChildNodes, Node } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { inline, isWS, JsifyResult, text } from "./utils.ts"

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
interface EventHandlerFlags {
	capture?: boolean
	once?: boolean
	passive?: boolean
	preventDefault?: boolean
	stopPropagation?: boolean
	stopImmediatePropagation?: boolean
	self?: boolean
	trusted?: boolean
}
const EVENT_HANDLER_FLAGS = new Set<keyof EventHandlerFlags>(
	[
		"capture",
		"once",
		"passive",
		"preventDefault",
		"stopPropagation",
		"stopImmediatePropagation",
		"self",
		"trusted",
	],
)

export class EventHandler {
	constructor(public name: string, public code: ChildNodes, public flags: EventHandlerFlags) {}
	jsify(variable: string) {
		const addOptions = this.flags.capture || this.flags.once || this.flags.passive
		const options = addOptions && { capture: this.flags.capture, once: this.flags.once, passive: this.flags.passive }
		return JsifyResult.add(
			text(`${variable}.addEventListener("${this.name}",function(event){`),
			this.flags.self && text(`if(event.target!==${variable})return;`),
			this.flags.trusted && text(`if(!event.isTrusted)return;`),
			this.flags.preventDefault && text("event.preventDefault();"),
			this.flags.stopPropagation && text("event.stopPropagation();"),
			this.flags.stopImmediatePropagation && text("event.stopImmediatePropagation();"),
			this.code.jsify(),
			text("}"),
			addOptions && text(`,${JSON.stringify(options)}`),
			text(");"),
		)
	}
}

function parseAttributes(
	reader: Reader,
	attributes: Record<
		string,
		Attribute | SlotAttribute | Flag
	>,
	eventHandlers: EventHandler[],
) {
	while (!reader.eof()) {
		reader.whitespace()
		if (reader.check(")")) {
			break
		}
		if (reader.check("(")) {
			// a((href)) => a(href=(href)) shorthand
			const name = reader.identifier()
			if (!reader.check(")")) {
				reader.error("expected ) after tag in attribute shortcut (`a((href))` => `a(href=(href))`)")
			}
			attributes[name] = new Attribute(name)
			continue
		}
		if (reader.check("on:")) {
			const name = reader.identifier()
			const flags: EventHandlerFlags = {}
			for (;;) {
				reader.whitespace()
				if (!reader.check("|")) break
				reader.whitespace()
				const flag = reader.identifier()
				if (!EVENT_HANDLER_FLAGS.has(flag as never)) {
					reader.error(`Invalid event handler flag ${flag}, expected: ${[...EVENT_HANDLER_FLAGS].join(", ")}`)
				}
				flags[flag as keyof EventHandlerFlags] = true
			}
			const children = ChildNodes.from(reader, true)
			eventHandlers.push(new EventHandler(name, children, flags))
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
			return new WithBlock(ChildNodes.from(reader, true))
		} else reader.error("Expected script after with")
	}
}

export class Element implements Node {
	constructor(
		public tag: string,
		public attributes: Record<string, Attribute | SlotAttribute | Flag>,
		public eventHandlers?: EventHandler[],
		public children?: ChildNodes,
		public withBlock?: WithBlock,
	) {}
	jsify() {
		const attributes = Object.entries(this.attributes) as [string, Attribute | Flag][]
		if (attributes.some((attribute) => attribute[1] instanceof SlotAttribute)) {
			throw new Error("Non-template elements can't have slot attributes")
		}
		let code = JsifyResult.add(
			text(`<${this.tag}`),
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
			code = code.add(text(`</${this.tag}>`))
		}
		if (this.withBlock?.script || (this.eventHandlers != undefined && this.eventHandlers.length > 0)) {
			// mostly for custom elements: `3rd-char=1-1` => `_3rdChar_1_1`
			// h1 => h1, p => p, my-element => myElement
			const variableName = this.tag
				.replaceAll(/-[a-z]/g, (match) => match[1].toUpperCase())
				.replace(/^\P{ID_Start}/u, "_$&")
				.replaceAll(/\P{ID_Continue}/ug, "_")
			code = code.add(
				inline(
					`"<script>{const ${variableName}=document.currentScript.previousElementSibling,{dataset}=${variableName};"`,
				),
			)
			if (this.eventHandlers) {
				for (const handler of this.eventHandlers) {
					code = code.add(handler.jsify(variableName))
				}
			}
			if (this.withBlock?.script) {
				code = code.add(this.withBlock.script.jsify())
			}
			code = code.add(inline('"}</script>"'))
		}
		return code
	}
	static from(tag: string, reader: Reader): Element {
		const attributes: Record<string, Attribute | SlotAttribute | Flag> = {}
		const eventHandlers: EventHandler[] = []
		while ("(.#".includes(reader.peek())) {
			switch (reader.peek()) {
				case "(": {
					reader.skip(1)
					parseAttributes(reader, attributes, eventHandlers)
					break
				}
				case ".": {
					reader.skip(1)
					const clazz = reader.tag()
					if (attributes.class == undefined) attributes.class = new Attribute(JSON.stringify(clazz))
					else if (attributes.class instanceof Flag) attributes.class = new Attribute(JSON.stringify(clazz))
					else if (attributes.class instanceof SlotAttribute) {
						throw new TypeError("Can't use .class shortcut if class is already defined as a slot attribute")
					} else attributes.class.add(clazz)
					break
				}
				case "#": {
					reader.skip(1)
					const id = reader.tag()
					attributes.id = new Attribute(JSON.stringify(id))
					break
				}
					// No default
			}
		}
		reader.whitespace()
		if (voidElements.has(tag.toLowerCase())) {
			return new Element(tag, attributes, eventHandlers, undefined, WithBlock.from(reader))
		}
		const children = ChildNodes.from(reader, tag === "script" || tag === "style")
		return new Element(tag, attributes, eventHandlers, children, WithBlock.from(reader))
	}
}
