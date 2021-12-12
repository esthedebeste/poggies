import { Element } from "./element.js";
import { Template, TemplateUsage } from "./templating.js";
import { isTag, isWS, outvar } from "./utils.js";

export interface Node {
	jsify(): {
		multiline: boolean;
		code: string;
	};
}
export const multilinify = (js: ReturnType<Node["jsify"]>): string =>
	js.multiline ? js.code : `${outvar}+=${js.code};`;
export const JSONify = (str: string) => JSON.stringify(str);
class Text implements Node {
	constructor(public text: string) {}
	jsify() {
		return { multiline: false, code: JSONify(this.text) };
	}
	static from(source: string, index: number) {
		const endI = source.indexOf("]", index);
		return { index: endI, node: new Text(source.slice(index, endI)) };
	}
}
class DynamicText implements Node {
	constructor(public code: string) {}
	jsify() {
		return { multiline: false, code: this.code };
	}
	static from(source: string, index: number) {
		const endI = source.indexOf("]", index);
		return {
			index: endI,
			node: new DynamicText(source.slice(index, endI)),
		};
	}
}

class Dynamic implements Node {
	constructor(
		public type: string,
		public declaration: string,
		public children: ChildNodes
	) {}
	jsify() {
		let code =
			this.type === "for" && !/^\s*.+\s+(of|in)\s+/.test(this.declaration)
				? // Prevent for...of and for...in from leaking into global scope
				  `for (let ${this.declaration}) {`
				: `${this.type} (${this.declaration}) {`;
		code += multilinify(this.children.jsify());
		code += "}";
		return { multiline: true, code };
	}
	static from(source: string, index: number) {
		const len = source.length;
		let type = "";
		for (; index < len && isTag(source[index]); index++) type += source[index];
		while (isWS(source[index]) && index < len) index++;
		if (source[index] !== "(") throw new Error("Expected ( after dynamic name");
		let content = "";
		let open = 1;
		while (open > 0) {
			content += source[++index];
			if (source[index] === "(") open++;
			else if (source[index] === ")") open--;
		}
		index++;
		content = content.slice(0, -1); // Remove trailing )
		while (isWS(source[index]) && index < len) index++;
		let children: ChildNodes;
		({ children, index } = ChildNodes.from(source, index));
		return {
			node: new Dynamic(type, content, children),
			index,
		};
	}
}

export class ChildNodes implements Node {
	static readonly starts = "[{<";
	size: number;
	constructor(public nodes: Node[]) {
		this.size = nodes.length;
	}
	jsify() {
		let result = "";
		let lastML = false;
		let hasML = false;
		for (const node of this.nodes) {
			const { multiline, code } = node.jsify();
			if (!hasML && multiline) {
				hasML = true;
				if (!lastML && result.length > 0) result = `${outvar}+=${result}`;
			}
			if (lastML) result += multiline ? code : `${outvar}+=${code}`;
			else if (result.length === 0) result += code;
			else result += multiline ? `;${code}` : `+${code}`;
			lastML = multiline;
		}
		if (hasML && !lastML) result += ";";
		return { multiline: hasML, code: result };
	}
	static from(
		source: string,
		index: number,
		creatingTemplates = false
	): { children: ChildNodes; index: number } {
		const T = creatingTemplates ? Template : TemplateUsage;
		const len = source.length;
		while (isWS(source[index]) && index < len) index++;
		const nodes: Node[] = [];
		while (index < source.length)
			if (source[index] === "[") {
				index++;
				let type: typeof Text | typeof DynamicText = Text;
				if (source[index] === ">") {
					type = DynamicText;
					index++;
				}
				const { index: i, node } = type.from(source, index);
				nodes.push(node);
				index = i + 1;
				while (isWS(source[index]) && index < len) index++;
			}
			// Children
			else if (source[index] === "{") {
				index++;
				while (isWS(source[index]) && index < len) index++;
				while (isTag(source[index]) || source[index] === "$") {
					if (source[index] === "$") {
						let template: Node;
						({ template, index } = T.from(source, index));
						nodes.push(template);
					} else {
						let node: Node;
						({ node, index } = Element.from(source, index));
						nodes.push(node);
					}
				}
				index++;
				while (isWS(source[index]) && index < len) index++;
			}
			// Dynamics (if, for)
			else if (source[index] === "<") {
				index++;
				while (source[index] !== ">") {
					while (isWS(source[index]) && index < len) index++;
					let node: Dynamic;
					({ node, index } = Dynamic.from(source, index));
					nodes.push(node);
					while (isWS(source[index]) && index < len) index++;
				}
				index++;
				while (isWS(source[index]) && index < len) index++;
			} else break;
		return { children: new ChildNodes(nodes), index };
	}
}
