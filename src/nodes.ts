import { Element } from "./element";
import { isTag, isWS, outvar } from "./utils.js";

export interface Node {
	jsify(): string;
}
export const JSONify = (str: string) => JSON.stringify(str);
class Text implements Node {
	constructor(public text: string) {}
	jsify() {
		return `${outvar} += ${JSONify(this.text)};`;
	}
	static from(source: string, index: number) {
		const endI = source.indexOf("]", index);
		return { index: endI, node: new Text(source.slice(index, endI)) };
	}
}
class DynamicText implements Node {
	constructor(public code: string) {}
	jsify() {
		return `${outvar} += ${this.code};`;
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
		code += this.children.jsify();
		code += "}";
		return code;
	}
	static from(source: string, index: number) {
		const len = source.length;
		let type = "";
		for (; index < len && isTag(source[index]); index++) type += source[index];
		while (isWS(source[index]) && index < len) index++;
		if (source[index] !== "(") {
			console.dir(source[index]);
			console.log(index, source.slice(index - 3, index + 3));
			throw new Error("Expected ( after dynamic name");
		}
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
	size: number;
	constructor(public nodes: Node[]) {
		this.size = nodes.length;
	}
	jsify(): string {
		return this.nodes.map(node => node.jsify()).join("\n");
	}
	static from(
		source: string,
		index: number
	): { children: ChildNodes; index: number } {
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
				while (isTag(source[index])) {
					let node: any;
					({ node, index } = Element.from(source, index));
					nodes.push(node);
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
