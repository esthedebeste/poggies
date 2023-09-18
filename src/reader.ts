import { isClose, isOpen, isStringDelimiter, isTag, isWS } from "./utils.ts"

export class Reader {
	index = 0
	line = 1
	column = 1
	constructor(public source: string) {}
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
	eof() {
		return this.index >= this.source.length
	}
	collect(predicate: (char: string) => boolean) {
		let result = ""
		while (this.index < this.source.length && predicate(this.peek())) {
			result += this.next()
		}
		return result
	}
	tag() {
		return this.collect(isTag)
	}
	skipJsString(): void {
		let escaped = false
		const startLine = this.line,
			startColumn = this.column
		const quote = this.next() // Skip past the initial quote
		for (; !this.eof(); this.next()) {
			const char = this.peek()
			if (escaped) escaped = false // Skip past the escaped character
			else if (char === "\\") escaped = true // Escape the next character
			else if (quote === "`" && char === "$" && this.peek(1) === "{") {
				this.skip(2) // Skip past $
				this.jsExpression() // Skip past { ... }
			} else if (char === quote) {
				this.next() // Skip past the closing quote
				return // End of the string!
			}
		}
		throw new Error(`Unmatched string from (${startLine}:${startColumn})`)
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
			if (depth === 0 && (isClose(char) || isWS(char))) {
				return this.source.slice(start, this.index)
			} else if (isOpen(char)) {
				depth++
				this.next()
			} else if (isClose(char)) {
				depth--
				this.next()
			} else if (isStringDelimiter(char)) this.skipJsString()
			else this.next()
		}
		throw new Error("Unmatched bracket")
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
