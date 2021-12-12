import { Element, VoidElement } from "./element.js";
import { ChildNodes, Node } from "./nodes.js";
import { isTag, outvar } from "./utils.js";

export class Template implements Node {
	constructor(
		public name: string,
		public props: string[],
		public children: ChildNodes
	) {}
	jsify() {
		const { multiline, code } = this.children.jsify();
		return {
			multiline: true,
			code: `const $${this.name}=async({${this.props.join(",")}})=>${
				multiline ? `{let ${outvar}="";${code};return ${outvar};}` : code
			};`,
		};
	}
	static from(
		source: string,
		index: number
	): { template: Template; index: number } {
		const len = source.length;
		index++; // Skip past the initial `$`
		let name = "";
		for (; index < len && isTag(source[index]); index++) name += source[index];
		if (source[index] !== "(")
			throw new Error("Invalid template tag, no input declaration");
		const end = source.indexOf(")", index + 1);
		const props: string[] = source
			.slice(index + 1, end)
			.split(/\s/)
			.map(s => s.trim());
		index = end + 1;
		let children: ChildNodes;
		({ children, index } = ChildNodes.from(source, index));
		return { template: new Template(name, props, children), index };
	}
}

export class TemplateUsage extends VoidElement {
	jsify() {
		const attrObj = Object.entries(this.attrs)
			.map(([name, attr]) => `${JSON.stringify(name)}:${attr.jsify()}`)
			.join(",");
		return {
			multiline: false,
			code: `(await $${this.tag}({${attrObj}}))`,
		};
	}
	static from(
		source: string,
		index: number
	): { template: TemplateUsage; index: number } {
		index++; // Skip past the initial `$`
		let template: VoidElement | Element;
		({ node: template, index } = Element.from(source, index, true));
		if ("children" in template)
			throw new Error("Template usages cannot have children");
		return { template: new TemplateUsage(template.tag, template.attrs), index };
	}
}
