import { readFileSync } from "node:fs";
import { ChildNodes, multilinify } from "./nodes.js";
import { inputvar, jsonifyfunc, outvar } from "./utils.js";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
export type Options = {
	/** @deprecated `!doctype(html)` is now valid poggies code, use that instead. */
	doctype?: "html" | string | false;
};
export class Poggies {
	private nodes: ChildNodes;
	js: string;
	function: (
		passing: Record<string, string>,
		jsonify?: (str: string) => string
	) => Promise<string>;
	constructor(source: string) {
		const { children } = ChildNodes.from("{" + source + "}", 0);
		this.nodes = children;
		const js = multilinify(this.nodes.jsify());
		this.js = `let ${outvar}="";with(${inputvar}){${js}}return ${outvar};`;
	}
	compile(): (passing: Record<string, string>) => Promise<string> {
		// async function(__INPUT__, __JSONIFY__ = JSON.stringify) { ${this.js} }
		return (this.function = new AsyncFunction(
			inputvar,
			jsonifyfunc + "=JSON.stringify",
			this.js
		));
	}
	/** Renders this Poggies document with some given variables */
	async render(
		passing: Record<any, any> = {},
		options: Options = {}
	): Promise<string> {
		if (this.function == null) this.compile();
		let output = await this.function(passing, JSON.stringify);
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
	passing: Record<any, any> = {},
	options: Options & { cache?: boolean } = {}
): Promise<string> => {
	if (options.cache === false) {
		const poggies = new Poggies(readFileSync(file).toString());
		return poggies.render(passing, options);
	}
	if (!fileCache.has(file))
		fileCache.set(file, new Poggies(readFileSync(file).toString()));
	const poggies = fileCache.get(file);
	return poggies.render(passing, options);
};
/** Express-style template function */
export const express = (
	file: string,
	passing: Record<any, any> = {},
	options: Options = {},
	callback: (error: any, html?: string) => any
) =>
	renderFile(file, passing, options).then(
		result => callback(null, result),
		error => callback(error)
	);
