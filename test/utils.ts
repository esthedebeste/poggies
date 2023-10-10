import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts"
import { Poggies } from "../src/poggies.ts"

export const data = {
	site: "example",
	tld: "com",
	forTest: { sentence: ["For", "of", "loops", "work!"] },
	ifstatements: { working: () => true },
	doubleTest: [
		{ show: true, content: "For and If combined is" },
		{ show: false, content: "not" },
		{ show: true, content: "working!" },
	],
	first: 12,
	second: 26,
	words: ["loops ", "are ", "cool"],
	chance: Math.random() < 0.5,
	users: [
		{
			name: "Esthe de Beste",
			thebest: true,
		},
		{
			name: "John Doe",
			thebest: false,
		},
	],
	add: (a: number, b: number) => a + b,
	chanceTrue: true,
	chanceFalse: false,
	href: "https://example.com/",
}

export const checker = (t: Deno.TestContext) => (name: string, source: string, expected: string) =>
	t.step(name, async () => {
		const poggies = new Poggies(source)
		let result: string
		try {
			result = await poggies.render(data)
		} catch (error) {
			console.error(poggies.javascript())
			throw error
		}
		try {
			assertEquals(result.replaceAll("</", "\n</"), expected.replaceAll("</", "\n</"))
		} catch (readableError) {
			try {
				assertEquals(
					result.replaceAll(/\s+/g, ""),
					expected.replaceAll(/\s+/g, ""),
				)
			} catch {
				throw readableError
			}
		}
	})
