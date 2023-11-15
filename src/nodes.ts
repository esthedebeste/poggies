import { Element } from "./element.ts"
import { Reader } from "./reader.ts"
import { TemplateDeclaration, TemplateUsage } from "./templating.ts"
import {
	defaultslot,
	escapeHTML,
	escapehtmlfunc,
	escapeJSON,
	inline,
	isStringDelimiter,
	isTag,
	JsifyResult,
	multiline,
} from "./utils.ts"

export interface Node {
	jsify(): JsifyResult
}
class DynamicText implements Node {
	constructor(public code: string) {}
	jsify() {
		return inline(this.code)
	}
	static from(reader: Reader) {
		const delimeter = reader.peek()
		switch (delimeter) {
			case '"':
			case "'": {
				const string = reader.jsString()
				const text = new DynamicText(delimeter + escapeJSON(escapeHTML(string.slice(1, -1))) + delimeter)
				reader.whitespace()
				return text
			}
			case "`": {
				const expression = reader.jsString()
				const text = new DynamicText(`${escapehtmlfunc}(${expression})`)
				reader.whitespace()
				return text
			}
		}
		reader.error(`Invalid delimeter ${delimeter}`)
	}
}

/** technically just embeds the value of that variable right into the html. :p */
class SlotNode implements Node {
	constructor(public name: string) {}
	jsify() {
		return inline(this.name)
	}
}

class Dynamic implements Node {
	static readonly dynamics = new Set(["if", "else", "for", "while"])
	constructor(
		public type: string,
		public declaration: string,
		public children: ChildNodes,
	) {}
	jsify() {
		let code = this.type === "for" && !/^\s*(const|let|var|;)\s*(of|in)\s*/.test(this.declaration)
			// Prevent for...of and for...in from leaking into global scope
			? `for(let ${this.declaration}){`
			: `${this.type}(${this.declaration}){`
		code += this.children.jsify().multilinify().code
		code += "}"
		return multiline(code)
	}
	static from(type: string, reader: Reader): Node {
		reader.whitespace()
		if (type === "else") return DynamicElse.from(reader)
		if (reader.peek() !== "(") {
			reader.error(`Expected ( after dynamic name ${type}`)
		}
		const content = reader.jsExpression().slice(1, -1)
		const children = ChildNodes.from(reader)
		return new Dynamic(type, content, children)
	}
}

class DynamicElse implements Node {
	constructor(public children: ChildNodes) {}
	jsify() {
		return multiline(`else{${(this.children.jsify().multilinify().code)}}`)
	}
	/** Starts after else[whitespace] */
	static from(reader: Reader) {
		const children = ChildNodes.from(reader)
		return new DynamicElse(children)
	}
}

export class ChildNodes implements Node {
	constructor(public nodes: Node[]) {
	}
	get size() {
		return this.nodes.length
	}
	jsify() {
		return JsifyResult.add(...this.nodes.map((node) => node.jsify()))
	}
	static from(reader: Reader, scriptHandling = false): ChildNodes {
		reader.whitespace()
		const nodes: Node[] = []
		loop:
		while (!reader.eof()) {
			reader.whitespace()
			const c = reader.peek()
			switch (c) {
				// Children
				case "{": {
					if (scriptHandling) {
						// script { const hi = 1; }
						// style { .hi { color: red; } }
						const code = reader.jsExpression().slice(1, -1)
						nodes.push(new DynamicText(JSON.stringify(code)))
						reader.whitespace()
						break
					}
					reader.next()
					reader.whitespace()
					const extra = /^["$'`]$/
					let c = reader.peek()
					while (isTag(c) || extra.test(c)) {
						if (isStringDelimiter(c)) {
							nodes.push(DynamicText.from(reader)) // { "text" } syntax
						} else if (c === "$" && reader.peek(1) == "$") {
							reader.skip(2) // Skip past $$
							const name = reader.tag()
							nodes.push(TemplateDeclaration.from(name, reader))
						} else if (c === "$") {
							reader.skip(1) // Skip past $
							const name = reader.tag()
							nodes.push(TemplateUsage.from(name, reader))
						} else {
							const tag = reader.tag()
							if (Dynamic.dynamics.has(tag)) {
								nodes.push(Dynamic.from(tag, reader))
							} else if (tag === "slot!") {
								reader.whitespace()
								let name = defaultslot
								if (reader.check("(")) {
									name = reader.identifier()
									reader.whitespace()
									if (!reader.check(")")) reader.error("Expected ) to close slot name")
								}
								nodes.push(new SlotNode(name))
							} else {
								nodes.push(Element.from(tag, reader))
							}
						}
						reader.whitespace()
						c = reader.peek()
					}
					reader.whitespace()
					if (!reader.check("}")) reader.error("Expected } to close child nodes")
					break
				}
				case "`":
				case '"':
				case "'": {
					nodes.push(DynamicText.from(reader))
					break
				}
				default: {
					break loop
				}
			}
		}
		return new ChildNodes(nodes)
	}
}
