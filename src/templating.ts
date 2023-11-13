import { Attribute, Element, Flag, SlotAttribute } from "./element.ts"
import { ChildNodes, Node } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { defaultslot, has, Inline, inline, Multiline, multiline, outvar, variableName } from "./utils.ts"

const templateName = (stringContent: string) =>
	"$" + stringContent.replaceAll(
		/\W/g,
		// eslint-disable-next-line unicorn/prefer-code-point -- we do need to get the char code here
		(char) => `u${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
	)

export class TemplateDeclaration implements Node {
	constructor(
		public name: string,
		public properties: string[],
		public children: ChildNodes,
	) {}
	jsify() {
		const jsify = this.children.jsify()
		return multiline(`const ${templateName(this.name)}=async({${
			[...this.properties, defaultslot].join(
				",",
			)
		}})=>${jsify.multiline ? `{let ${outvar}="";${jsify.code};return ${outvar};}` : jsify.code || '""'};`)
	}
	static from(name: string, reader: Reader): TemplateDeclaration {
		let properties: string[] = []
		if (reader.check("(")) {
			const text = reader.collect((char) => char !== ")")
			properties = text.split(/\s+/).map((s) => s.trim()).filter((s) => s.length > 0)
			if (!reader.check(")")) throw new Error("Invalid template tag, no closing `)`")
		}
		const children = ChildNodes.from(reader)
		return new TemplateDeclaration(name, properties, children)
	}
}

export class TemplateUsage extends Element {
	constructor(
		public tag: string,
		public attributes: Record<string, Attribute | SlotAttribute | Flag>,
	) {
		super(tag, attributes)
	}
	jsify() {
		const js = Object.entries(this.attributes).map(([name, attribute]) => [name, attribute.jsify()])
		const multilines = js.filter(
			(pair): pair is [string, Multiline] => typeof pair[1] === "object" && pair[1].multiline,
		).map((pair) => {
			pair.push(variableName())
			return pair as never as [string, Multiline, string]
		})
		const inlines = js.filter(
			(pair): pair is [string, Inline | string] => typeof pair[1] !== "object" || !pair[1].multiline,
		)
		const attributeObject = inlines
			.map(([name, attribute]) =>
				`${JSON.stringify(name)}:${typeof attribute === "string" ? attribute : attribute.code}`
			)
		if (multilines.length === 0) {
			return inline(`(await ${templateName(this.tag)}({${attributeObject.join(",")}}))`)
		}
		attributeObject.push(
			...multilines.map(([name, , variable]) => `${JSON.stringify(name)}:${variable}`),
		)

		return multiline(
			"{" + multilines.map(([, { code }, variable]) => {
				return `let ${variable};{let ${outvar} = "";${code};${variable}=${outvar}}`
			}).join("") + `${outvar}+=(await ${templateName(this.tag)}({${attributeObject.join(",")}}))}`,
		)
	}
	static from(name: string, reader: Reader): TemplateUsage {
		const template = Element.from(name, reader)
		if (template.children && template.children.size > 0) {
			if (has(template.attributes, defaultslot)) {
				throw new Error(`Cannot have a ${defaultslot} attribute and a default slot (children of a template usage)`)
			}
			template.attributes[defaultslot] = new SlotAttribute(template.children)
		}

		return new TemplateUsage(name, template.attributes)
	}
}
