import { Element } from "./element.ts"
import { Reader } from "./reader.ts"
import { TemplateDeclaration, TemplateUsage } from "./templating.ts"
import { escapeHTML, escapehtmlfunc, escapeJSON, isTag, outvar } from "./utils.ts"

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
}

class Dynamic implements Node {
	static readonly dynamics = new Set(["if", "else", "for"])
	constructor(
		public type: string,
		public declaration: string,
		public children: ChildNodes,
	) {}
	jsify() {
		let code = this.type === "for" && !/^\s*.+\s+(of|in)\s+/.test(this.declaration)
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
		let content = ""
		let open = 1
		reader.skip(1) // Skip past the initial (
		while (open > 0) {
			// todo use skipJsExpression here?
			const c = reader.next()
			content += c
			if (c === "(") open++
			else if (c === ")") open--
		}
		content = content.slice(0, -1) // Remove trailing )
		reader.whitespace()
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
	static from(reader: Reader): ChildNodes {
		reader.whitespace()
		const nodes: Node[] = []
		loop:
		while (!reader.eof()) {
			const c = reader.peek()
			switch (c) {
				// Children
				case "{": {
					reader.next()
					reader.whitespace()
					let c = reader.peek()
					while (isTag(c) || c === "$") {
						if (c === "$" && reader.peek(1) == "$") {
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
							} else {
								nodes.push(Element.from(tag, reader))
							}
						}
						c = reader.peek()
					}
					reader.next()
					reader.whitespace()
					break
				}
				case '"':
				case "'": {
					const string = reader.jsString()
					nodes.push(new DynamicText(c + escapeJSON(escapeHTML(string.slice(1, -1))) + c))
					reader.whitespace()
					break
				}
				case "`": {
					const string = reader.jsString()
					nodes.push(new DynamicText(`${escapehtmlfunc}(${string})`))
					reader.whitespace()
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
