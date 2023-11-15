import { ChildNodes } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { escapeHTMLSource, inputvar, outvar, readTextFile, readTextFileSync } from "./utils.ts"
// only this file's .d.ts is exported to npm!!
// be careful not to export types from other files :p

// eslint-disable-next-line @typescript-eslint/no-empty-function -- function only exists for its constructor
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
export type Options = {
	/** @deprecated `!doctype(html)` is now valid poggies code, use that instead. */
	doctype?: string | false
}

/**
 * Importer function for `import` statements.
 * @param path The path of the file to import
 * @returns Poggies source code
 */
export type Importer = (path: string | URL) => string

export interface PoggiesOptions {
	/**
	 * Name of the main document. Used for error messages, often the path.
	 * @default "<start>"
	 */
	name?: string
	/**
	 * Importer function for `$$component from "path"` statements. Defaults to `readTextFileSync` in Deno and Node.js (or compatible runtimes).
	 * @param path The path of the file to import
	 * @returns Poggies source code
	 */
	importer?: Importer
}

export type RenderFunction = (input: Record<string, unknown>) => Promise<string>

export class Poggies {
	private nodes: ChildNodes
	private func!: RenderFunction
	/** The body of the function. Available before calling compile() or javascript() */
	js: string
	constructor(source: string, { importer = readTextFileSync, name = "<start>" }: PoggiesOptions = {}) {
		const reader = new Reader("{" + source + "}", name, importer)
		reader.column-- // because the first character is a fake {
		this.nodes = ChildNodes.from(reader)
		const js = this.nodes.jsify().multilinify().code
		this.js = `with(${inputvar}){${escapeHTMLSource}let ${outvar}="";${js}return ${outvar};}`
	}
	/** Compiles the Poggies document into a function that can be called to return the rendered HTML */
	compile(): RenderFunction {
		return (this.func = new AsyncFunction(
			inputvar,
			this.js,
		))
	}
	/**
	 * `async function(__INPUT__) { ${this.js} }`.
	 * Similar to this.compile().toString(), but doesn't actually compile a function.
	 */
	javascript(): string {
		return `async function(${inputvar}) { ${this.js} }`
	}
	/** Renders this Poggies document with some given variables */
	async render(
		input: Record<string, unknown> = {},
		options: Options = {},
	): Promise<string> {
		if (this.func === undefined) this.compile()
		let output = await this.func(input)
		const { doctype } = options
		if (doctype) output = `<!doctype ${doctype}>` + output
		return output
	}
}

export type PathLike = string | URL
const fileCache = new Map<PathLike, Poggies>()

export type RenderFileOptions = Options & PoggiesOptions & { cache?: boolean }

/** Coggers promise-style template function */
export async function renderFile(
	file: PathLike,
	input: Record<string, unknown> = {},
	options: Options & PoggiesOptions & { cache?: boolean } = {},
): Promise<string> {
	if (options.cache) {
		const cached = fileCache.get(file)
		if (cached != undefined) return cached.render(input, options)
	}
	const source = await readTextFile(file)
	options.importer ??= readTextFileSync
	options.name ??= file.toString()
	const poggies = new Poggies(source, options)
	if (options.cache) {
		fileCache.set(file, poggies)
	}
	return poggies.render(input, options)
}
/** Express-style template function */
export function express(
	file: string,
	input: Record<string, unknown> = {},
	options: Options & PoggiesOptions & { cache?: boolean } = {},
	callback: (error: unknown, html?: string) => unknown,
) {
	renderFile(file, input, options).then(
		(result) => callback(undefined, result),
		(error) => callback(error),
	)
}
