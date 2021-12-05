import { PathLike, readFileSync } from "node:fs";
import { ChildNodes } from "./nodes.js";
import { inputvar, jsonifyfunc, outvar } from "./utils.js";
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
export type Options = { doctype?: "html" | string | false };
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
		this.js = `${jsonifyfunc}=${jsonifyfunc}||JSON.stringify;let ${outvar}="";with(${inputvar}){${this.nodes.jsify()}}return ${outvar};`;
	}
	compile(): (passing: Record<string, string>) => Promise<string> {
		return (this.function = new AsyncFunction(inputvar, jsonifyfunc, this.js));
	}
	/** Renders this Poggies document with some given variables */
	async render(
		passing: Record<string, any>,
		{ doctype = "html" }: Options = {}
	): Promise<string> {
		if (this.function == null) this.compile();
		let output = await this.function(passing, JSON.stringify);
		if (doctype) output = `<!doctype ${doctype}>` + output;
		return output;
	}
}

const fileCache = new Map<PathLike, Poggies>();
/** Coggers promise-style template function */
export const renderFile = async (
	file: PathLike,
	passing: Record<any, any>,
	options: Options & { cache?: boolean }
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
	passing: Record<any, any>,
	options: Options,
	callback: (error: any, html?: string) => any
) =>
	renderFile(file, passing, options).then(
		result => callback(null, result),
		error => callback(error)
	);
