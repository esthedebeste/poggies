import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts"
import { Reader } from "../src/reader.ts"

Deno.test("parseAttributes", async (t) => {
	await t.step("last argument", () => {
		const source = "$foo(arg=[1, 2, 3])"
		const reader = new Reader(source)
		reader.index = source.indexOf("[")
		assertEquals(reader.jsExpression(), "[1, 2, 3]")
		assertEquals(reader.index, source.indexOf("]") + 1)
	})
})
