import { ChildNodes, multilinify } from "./nodes.ts"
import { Reader } from "./reader.ts"
import { escapeHTMLSource, inputvar, outvar, readTextFile } from "./utils.ts"
// only this file's .d.ts is exported to npm!!
// be careful not to export types from other files :p

// eslint-disable-next-line @typescript-eslint/no-empty-function -- function only exists for its constructor
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
export type Options = {
	/** @deprecated `!doctype(html)` is now valid poggies code, use that instead. */
	doctype?: string | false
}

export type RenderFunction = (input: Record<string, unknown>) => Promise<string>

export class Poggies {
	private nodes: ChildNodes
	private func!: RenderFunction
	/** The body of the function. Available before calling compile() or javascript() */
	js: string
	constructor(source: string) {
		const reader = new Reader("{" + source + "}")
		reader.column-- // because the first character is a fake {
		try {
			this.nodes = ChildNodes.from(reader)
		} catch (error) {
			if (error instanceof Error) {
				error.message += ` at (${reader.line}:${reader.column}) ("${
					reader.source.slice(reader.index - 5, reader.index + 5)
				}")`
			}
			throw error
		}
		const js = multilinify(this.nodes.jsify())
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
/** Coggers promise-style template function */
export async function renderFile(
	file: PathLike,
	input: Record<string, unknown> = {},
	options: Options & { cache?: boolean } = {},
): Promise<string> {
	if (options.cache === false) {
		const poggies = new Poggies(await readTextFile(file))
		return poggies.render(input, options)
	}

	let poggies = fileCache.get(file)
	if (poggies == undefined) {
		poggies = new Poggies(await readTextFile(file))
		fileCache.set(file, poggies)
	}
	return poggies.render(input, options)
}
/** Express-style template function */
export function express(
	file: string,
	input: Record<string, unknown> = {},
	options: Options = {},
	callback: (error: unknown, html?: string) => unknown,
) {
	renderFile(file, input, options).then(
		(result) => callback(undefined, result),
		(error) => callback(error),
	)
}
