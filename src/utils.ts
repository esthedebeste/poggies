import { PathLike } from "./poggies.ts"

export const isTag = (char: string) => /^[\w!-]+$/.test(char)

export const isWS = (char: string) => /^\s+$/.test(char)

export const inputvar = "__INPUT__"
export const outvar = "__OUT__"
export const jsonifyfunc = "__JSONIFY__"

export const isOpen = (char: string) => /^[([{]$/.test(char)
export const isClose = (char: string) => /^[)\]}]$/.test(char)
export const isStringDelimiter = (char: string) => /^["'`]$/.test(char)

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

const jsonEscapeRegex = /[\p{Cc}"]/gu
export const escapeJSON = (stringContent: string) =>
	stringContent.replaceAll(
		jsonEscapeRegex,
		// eslint-disable-next-line unicorn/prefer-code-point -- we do need to get the char code here
		(char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`,
	)
// for inside of generated code
export const escapeHTMLSource = `\
const __HTML_ESCAPE_MAP__ = {
	'"': "&quot;",
	"'": "&apos;",
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
}
const __HTML_ESCAPE_REGEX__ = /["&'<>]/g
const __ESCAPE_HTML__ = (string) =>
	string.replaceAll(
		__HTML_ESCAPE_REGEX__,
		(char) => __HTML_ESCAPE_MAP__[char],
	)
`
export const escapehtmlfunc = "__ESCAPE_HTML__"

declare global {
	// @ts-ignore if deno already exists
	const Deno: undefined | { readTextFile: (file: PathLike) => Promise<string> }
	// @ts-ignore if process already exists
	const process: undefined | { release: { name: string } }
}

export let readTextFile = async function (file: PathLike): Promise<string> {
	if (typeof Deno !== "undefined") {
		readTextFile = (file) => Deno.readTextFile(file)
	} else if (
		typeof process !== "undefined" &&
		process.release.name === "node"
	) {
		const fs = await import("node:fs")
		const { readFile } = fs.promises
		readTextFile = (file) => readFile(file, "utf8")
	} else {
		throw new Error(
			"Unsupported environment for renderFile, expected Deno or Node.js",
		)
	}
	return readTextFile(file) // call the new function
}
