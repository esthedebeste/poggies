import { Element } from "./element.ts"
import { Reader } from "./reader.ts"
import { TemplateDeclaration, TemplateUsage } from "./templating.ts"
import { defaultslot, escapeHTML, escapehtmlfunc, escapeJSON, isStringDelimiter, isTag, outvar } from "./utils.ts"

export interface JsifyResult {
	multiline: boolean
	code: string
}
export interface Node {
	jsify(): JsifyResult
}
export const multilinify = (js: JsifyResult): string => js.multiline ? js.code : `${outvar}+=${js.code};`
class DynamicText implements Node {
	constructor(public code: string) {}
	jsify() {
		return { multiline: false, code: this.code }
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
		throw new Error(`Invalid delimeter ${delimeter}`)
	}
}

/** technically just embeds the value of that variable right into the html. :p */
class SlotNode implements Node {
	constructor(public name: string) {}
	jsify() {
		return { multiline: false, code: this.name }
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
		code += multilinify(this.children.jsify())
		code += "}"
		return { multiline: true, code }
	}
	static from(type: string, reader: Reader): Node {
		reader.whitespace()
		if (reader.peek() !== "(") {
			if (type === "else") return DynamicElse.from(reader)
			else throw new Error(`Expected ( after dynamic name ${type}`)
		}
		const content = reader.jsExpression().slice(1, -1)
		const children = ChildNodes.from(reader)
		return new Dynamic(type, content, children)
	}
}

class DynamicElse implements Node {
	constructor(public children: ChildNodes) {}
	jsify() {
		return {
			multiline: true,
			code: `else{${multilinify(this.children.jsify())}}`,
		}
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
		let result = ""
		let lastML = false
		let hasML = false
		for (const node of this.nodes) {
			const { multiline, code } = node.jsify()
			if (!hasML && multiline) {
				hasML = true
				if (!lastML && result.length > 0) result = `${outvar}+=${result}`
			}
			if (lastML) result += multiline ? code : `${outvar}+=${code}`
			else if (result.length === 0) result += code
			else result += multiline ? `;${code}` : `+${code}`
			lastML = multiline
		}
		if (hasML && !lastML) result += ";"
		return { multiline: hasML, code: result }
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
									if (!reader.check(")")) throw new Error("Expected ) to close slot name")
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
					if (!reader.check("}")) throw new Error("Expected } to close child nodes")
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
