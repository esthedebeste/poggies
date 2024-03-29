import { PathLike } from "./poggies.ts"

export const isTag = (char: string) => /^[\w!-]+$/.test(char)
export const isIdentifier = (string: string) => /^\p{ID_Start}\p{ID_Continue}$/u.test(string)
export const isWS = (char: string) => /^\s+$/.test(char)

export const inputvar = "__INPUT__"
export const outvar = "__OUT__"
export const defaultslot = "__DEFAULT_SLOT__"

export const isOpen = (char: string) => /^[([{]$/.test(char)
export const isClose = (char: string) => /^[)\]}]$/.test(char)
export const isStringDelimiter = (char: string) => /^["'`]$/.test(char)

const jsonEscapeRegex = /[\p{Cc}"]/gu
export const escapeJSON = (stringContent: string) =>
	stringContent.replaceAll(
		jsonEscapeRegex,
		// eslint-disable-next-line unicorn/prefer-code-point -- we do need to get the char code here
		(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
	)

let variableNameState = 0
export function variableName() {
	return `_${(variableNameState++).toString(36)}`
}

export const has = Function.prototype.call.bind(Object.prototype.hasOwnProperty) as <T>(
	object: unknown,
	key: keyof T,
) => object is T

const htmlEscapeMap = {
	'"': "&quot;",
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
}
const htmlEscapeRegex = /["&<>]/g
export const escapeHTML = (string: string) =>
	string.replaceAll(
		htmlEscapeRegex,
		(char) => htmlEscapeMap[char as keyof typeof htmlEscapeMap],
	)

// for inside of generated code
export const escapeHTMLSource = `\
const __HTML_ESCAPE_MAP__={'"': "&quot;","&": "&amp;","<": "&lt;",">": "&gt;"}
const __HTML_ESCAPE_REGEX__=/["&<>]/g
const __ESCAPE_HTML__=s=>s.replace(__HTML_ESCAPE_REGEX__,c=>__HTML_ESCAPE_MAP__[c])
` // vitally important newline
export const escapehtmlfunc = "__ESCAPE_HTML__"

declare global {
	// @ts-ignore if deno already exists
	const Deno: undefined | {
		readTextFile: (file: PathLike) => Promise<string>
		readTextFileSync: (file: PathLike) => string
	}
	// @ts-ignore if process already exists
	const process: undefined | object
}

export let readTextFile: (file: PathLike) => Promise<string>
export let readTextFileSync: (path: PathLike) => string

if (typeof Deno === "object") {
	readTextFile = (file) => Deno.readTextFile(file)
	readTextFileSync = (file) => Deno.readTextFileSync(file)
} else if (typeof process === "object") {
	try {
		const { promises: { readFile }, readFileSync } = await import("node:fs")
		readTextFile = (file) => readFile(file, "utf8")
		readTextFileSync = (file) => readFileSync(file, "utf8")
	} catch {
		readTextFile = () => {
			throw new Error(
				"Unsupported environment for poggies.renderFile, expected Deno or Node.js (or compatible)",
			)
		}
		readTextFileSync = () => {
			throw new Error(
				"Default importer for poggies files only exists in Deno, Node.js, or compatible runtimes. Please specify an importer function.",
			)
		}
	}
}

type Falsy = false | undefined | null | 0 | ""

export class JsifyResult {
	constructor(public multiline: boolean, public code: string) {}
	static add(...jsify: (JsifyResult | Falsy)[]): JsifyResult {
		let result = ""
		let lastML = false
		let hasML = false
		for (const part of jsify) {
			if (!part) continue
			const { multiline, code } = part
			if (!hasML && multiline) {
				hasML = true
				if (!lastML && result.length > 0) result = `${outvar}+=${result}`
			}
			if (lastML) result += multiline ? code : `${outvar}+=${code}`
			else if (result.length === 0) result += code
			else result += multiline ? `;${code}` : `+${code}`
			lastML = multiline
		}
		if (hasML && !lastML) result += ";"
		return new JsifyResult(hasML, result)
	}
	add(...jsify: (JsifyResult | Falsy)[]): JsifyResult {
		return JsifyResult.add(this, ...jsify)
	}
	inlinify(): JsifyResult {
		return inline(this.multiline ? `(()=>{let ${outvar}="";${this.code};return ${outvar};})()` : this.code)
	}
	multilinify(): JsifyResult {
		return multiline(this.multiline ? this.code : `${outvar}+=${this.code};`)
	}
}

export type Inline = JsifyResult & { multiline: false }
export const inline = (code: string) => new JsifyResult(false, code)
export const text = (text: string) => new JsifyResult(false, JSON.stringify(text))
export type Multiline = JsifyResult & { multiline: true }
export const multiline = (code: string) => new JsifyResult(true, code)
