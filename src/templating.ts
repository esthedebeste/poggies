import { Element, VoidElement } from "./element.ts"
import { ChildNodes, Node } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { outvar } from "./utils.ts"

export class TemplateDeclaration implements Node {
	constructor(
		public name: string,
		public properties: string[],
		public children: ChildNodes,
	) {}
	jsify() {
		const { multiline, code } = this.children.jsify()
		return {
			multiline: true,
			code: `const $${this.name.replaceAll("-", "$")}=async({${
				this.properties.join(
					",",
				)
			}})=>${multiline ? `{let ${outvar}="";${code};return ${outvar};}` : code};`,
		}
	}
	static from(name: string, reader: Reader): TemplateDeclaration {
		if (reader.next() !== "(") {
			throw new Error("Invalid template tag, no input declaration")
		}
		const text = reader.collect((char) => char !== ")")
		const properties = text.split(/\s+/).map((s) => s.trim())
		reader.skip(1) // Skip past the closing `)`
		const children = ChildNodes.from(reader)
		return new TemplateDeclaration(name, properties, children)
	}
}

export class TemplateUsage extends VoidElement {
	jsify() {
		const attributeObject = Object.entries(this.attributes)
			.map(([name, attribute]) => `${JSON.stringify(name)}:${attribute.jsify()}`)
			.join(",")
		return {
			multiline: false,
			code: `(await $${this.tag.replaceAll("-", "$")}({${attributeObject}}))`,
		}
	}
	static from(name: string, reader: Reader): TemplateUsage {
		const template: VoidElement | Element = Element.from(name, reader, true)
		if ("children" in template) {
			throw new Error("Template usages cannot have children")
		}
		return new TemplateUsage(name, template.attributes)
	}
}
