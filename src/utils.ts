import { PathLike } from "./poggies.ts"

export const isTag = (char: string) => /^[\w!-]+$/.test(char)
export const isIdentifier = (string: string) => /^\p{ID_Start}\p{ID_Continue}$/u.test(string)
export const isWS = (char: string) => /^\s+$/.test(char)

export const inputvar = "__INPUT__"
export const outvar = "__OUT__"
export const jsonifyfunc = "__JSONIFY__"
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
	"'": "&apos;",
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
}
const htmlEscapeRegex = /["&'<>]/g
export const escapeHTML = (string: string) =>
	string.replaceAll(
		htmlEscapeRegex,
		(char) => htmlEscapeMap[char as keyof typeof htmlEscapeMap],
	)

// for inside of generated code
export const escapeHTMLSource = `\
const __HTML_ESCAPE_MAP__={'"': "&quot;","'": "&apos;","&": "&amp;","<": "&lt;",">": "&gt;"}
const __HTML_ESCAPE_REGEX__=/["&'<>]/g
const __ESCAPE_HTML__=s=>s.replace(__HTML_ESCAPE_REGEX__,c=>__HTML_ESCAPE_MAP__[c])
` // vitally important newline
export const escapehtmlfunc = "__ESCAPE_HTML__"

declare global {
	// @ts-ignore if deno already exists
	const Deno: undefined | { readTextFile: (file: PathLike) => Promise<string> }
	// @ts-ignore if process already exists
	const process: undefined | { release: { name: string } }
}

export let readTextFile = async function (file: PathLike): Promise<string> {
	if (typeof Deno === "object") {
		readTextFile = (file) => Deno.readTextFile(file)
	} else {
		try {
			const fs = await import("node:fs")
			const { readFile } = fs.promises
			readTextFile = (file) => readFile(file, "utf8")
		} catch {
			throw new Error(
				"Unsupported environment for renderFile, expected Deno or Node.js",
			)
		}
	}
	return readTextFile(file) // call the new function
}
