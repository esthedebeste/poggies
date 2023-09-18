import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts"
import { Reader } from "../src/reader.ts"

Deno.test("whitespace", async (t) => {
	await t.step("a   end", () => {
		const source = "a   end"
		const reader = new Reader(source)
		reader.skip(1) // skip a
		reader.whitespace()
		assertEquals(reader.index, source.indexOf("end"))
	})
	await t.step("a comment end", () => {
		const source = "a // comment  \n  end"
		const reader = new Reader(source)
		reader.skip(1) // skip a
		reader.whitespace()
		assertEquals(reader.index, source.indexOf("end"))
	})
})

Deno.test("jsExpression", async (t) => {
	await t.step("last argument", () => {
		const source = "$foo(arg=[1, 2, 3])"
		const reader = new Reader(source)
		reader.index = source.indexOf("[")
		assertEquals(reader.jsExpression(), "[1, 2, 3]")
		assertEquals(reader.index, source.indexOf("]") + 1)
	})
	await t.step("first argument", () => {
		const source = "$foo(arg=[1, 2, 3] nothing in particular)"
		const reader = new Reader(source)
		reader.index = source.indexOf("[")
		assertEquals(reader.jsExpression(), "[1, 2, 3]")
	})
	await t.step("contains string containing a bracket", () => {
		const source = "$foo(arg=[1, ']', 3])"
		const reader = new Reader(source)
		reader.index = source.indexOf("[")
		assertEquals(reader.jsExpression(), "[1, ']', 3]")
	})
	await t.step(
		"contains string containing brackets, a real escape, a fake escape, and the wrong end quotes",
		() => {
			const source = "$foo(arg=[1, ']\\'\"`])\\\\', 3])"
			const reader = new Reader(source)
			reader.index = source.indexOf("[")
			assertEquals(reader.jsExpression(), "[1, ']\\'\"`])\\\\', 3]")
		},
	)
})
