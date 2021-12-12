import { readFileSync } from "node:fs";
import { ChildNodes, multilinify } from "./nodes.js";
import { inputvar, jsonifyfunc, outvar } from "./utils.js";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
export type Options = {
	/** @deprecated `!doctype(html)` is now valid poggies code, use that instead. */
	doctype?: string | false;
};
export class Poggies {
	private nodes: ChildNodes;
	js: string;
	func: (
		input: Record<any, any>,
		jsonify?: (str: string) => string
	) => Promise<string>;
	constructor(source: string) {
		const { children } = ChildNodes.from("{" + source + "}", 0, true);
		this.nodes = children;
		const js = multilinify(this.nodes.jsify());
		this.js = `let ${outvar}="";with(${inputvar}){${js}}return ${outvar};`;
	}
	compile(): (passing: Record<string, string>) => Promise<string> {
		// async function(__INPUT__, __JSONIFY__ = JSON.stringify) { ${this.js} }
		return (this.func = new AsyncFunction(
			inputvar,
			jsonifyfunc + "=JSON.stringify",
			this.js
		));
	}
	/** Renders this Poggies document with some given variables */
	async render(
		input: Record<any, any> = {},
		options: Options = {}
	): Promise<string> {
		if (this.func == null) this.compile();
		let output = await this.func(input, JSON.stringify);
		const { doctype } = options;
		if (doctype) output = `<!doctype ${doctype}>` + output;
		return output;
	}
}

type PathLike = string | URL;
const fileCache = new Map<PathLike, Poggies>();
/** Coggers promise-style template function */
export const renderFile = async (
	file: PathLike,
	input: Record<any, any> = {},
	options: Options & { cache?: boolean } = {}
): Promise<string> => {
	if (options.cache === false) {
		const poggies = new Poggies(readFileSync(file).toString());
		return poggies.render(input, options);
	}
	if (!fileCache.has(file))
		fileCache.set(file, new Poggies(readFileSync(file).toString()));
	const poggies = fileCache.get(file);
	return poggies.render(input, options);
};
/** Express-style template function */
export const express = (
	file: string,
	input: Record<any, any> = {},
	options: Options = {},
	callback: (error: any, html?: string) => any
) =>
	renderFile(file, input, options).then(
		result => callback(null, result),
		error => callback(error)
	);
