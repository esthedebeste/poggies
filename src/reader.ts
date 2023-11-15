import { Importer } from "./poggies.ts"
import { isClose, isOpen, isStringDelimiter, isTag, isWS } from "./utils.ts"

export class Reader {
	index = 0
	line = 1
	column = 1
	constructor(public source: string, public path: string | URL = "<start>", public importer?: Importer) {}

	import(path: string | URL) {
		if (this.importer === undefined) this.error(`No importer provided, cannot import ${path}`)
		if (typeof path === "string" && path.startsWith(".")) {
			path = new URL(path, this.path) // relative path from self, not cwd
		}
		const source = this.importer(path)
		const reader = new Reader("{" + source + "}", path, this.importer)
		reader.column-- // because the first character is a fake {
		return reader
	}

	error(message: string): never {
		const error = new Error(message)
		error.name = "PoggiesError"
		error.message += ` at (${this.path}:${this.line}:${this.column}) ("${
			this.source.slice(this.index - 5, this.index + 5)
		}")`
		throw error
	}

	/**
	 * Peeks at the next character in the source
	 * @param extra 0 returns the same as next(), 1 returns what's after that, etc.
	 */
	peek(extra = 0) {
		return this.source[this.index + extra]
	}
	next() {
		const char = this.source[this.index]
		if (char === "\n") {
			this.line++
			this.column = 1
		} else this.column++
		this.index++
		return char
	}
	skip(n: number) {
		for (let index = 0; index < n; index++) this.next()
	}
	/**
	 * Checks if the next characters are equal to `string`, and if so, skips them.
	 * @param string String to check for
	 * @returns `true` if skipped, `false` if not
	 */
	check(string: string): boolean {
		if (this.source.slice(this.index, this.index + string.length) === string) {
			this.skip(string.length)
			return true
		}
		return false
	}
	eof() {
		return this.index >= this.source.length
	}
	collect(predicate: (char: string, index: number) => boolean) {
		let result = ""
		const start = this.index
		while (this.index < this.source.length && predicate(this.peek(), this.index - start)) {
			result += this.next()
		}
		return result
	}
	tag() {
		return this.collect(isTag)
	}
	identifier() {
		return this.collect((char, index) => index > 0 ? /\p{ID_Continue}/u.test(char) : /\p{ID_Start}/u.test(char))
	}
	skipJsString(): void {
		let escaped = false
		const startLine = this.line,
			startColumn = this.column
		const quote = this.next() // Skip past the initial quote
		for (; !this.eof();) {
			const char = this.peek()
			if (escaped) {
				escaped = false // Skip past the escaped character
				this.next()
			} else if (char === "\\") {
				escaped = true // Escape the next character
				this.next()
			} else if (quote === "`" && char === "$" && this.peek(1) === "{") {
				this.skip(1) // Skip past $
				this.jsExpression() // Skip past { ... }
			} else if (char === quote) {
				this.next() // Skip past the closing quote
				return // End of the string!
			} else {
				this.next()
			}
		}
		this.error(`Unmatched string from (${startLine}:${startColumn})`)
	}
	jsString(): string {
		const start = this.index
		this.skipJsString()
		return this.source.slice(start, this.index)
	}
	jsExpression(): string {
		let depth = 0
		const start = this.index
		while (!this.eof()) {
			const char = this.peek()
			if (isOpen(char)) {
				depth++
				this.next()
			} else if (isClose(char)) {
				depth--
				this.next()
				if (depth === 0) {
					return this.source.slice(start, this.index).trim()
				}
			} else if (isStringDelimiter(char)) this.skipJsString()
			else this.next()
		}
		this.error("Unmatched bracket")
	}
	whitespace() {
		while (
			this.index < this.source.length &&
			(isWS(this.source[this.index]) ||
				(this.source[this.index] === "/" &&
					this.source[this.index + 1] === "/"))
		) {
			this.skip(1)
			if (
				this.source[this.index] === "/" &&
				this.source[this.index + 1] === "/"
			) {
				while (
					this.source[this.index] !== "\n" &&
					this.index < this.source.length
				) {
					this.skip(1)
				}
			}
		}
	}
}
