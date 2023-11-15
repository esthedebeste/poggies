import { assertEquals } from "https://deno.land/std@0.201.0/assert/mod.ts"
import { Reader } from "../src/reader.ts"
import { checker } from "./utils.ts"

Deno.test("parseAttributes", async (t) => {
	await t.step("last argument", () => {
		const source = "$foo(arg=[1, 2, 3])"
		const reader = new Reader(source)
		reader.index = source.indexOf("[")
		assertEquals(reader.jsExpression(), "[1, 2, 3]")
		assertEquals(reader.index, source.indexOf("]") + 1)
	})
})

Deno.test("special {} syntax", async (t) => {
	const check = checker(t)
	await check(
		"scripts",
		`script {const hi = 1;}`,
		`<script>const hi = 1;</script>`,
	)
	await check(
		"styles",
		`style {.hi { color: red; }}`,
		`<style>.hi { color: red; }</style>`,
	)
})

Deno.test("with blocks", async (t) => {
	const check = checker(t)
	await check(
		"with script",
		`p "hello" with script { p.textContent = "hi"; }`,
		`<p>hello</p>
		<script>{
			const p=document.currentScript.previousElementSibling,{dataset}=p;
			p.textContent = "hi"; 
		}</script>`,
	)
})

Deno.test("event handlers", async (t) => {
	const check = checker(t)
	await check(
		"with script",
		`p(on:click|capture|once|passive|preventDefault|stopPropagation|stopImmediatePropagation|self|trusted {
			p.textContent = "clicked"
		}) "hello"`,
		`<p>hello</p>
		<script>{
			const p=document.currentScript.previousElementSibling,{dataset}=p;
			p.addEventListener("click",function(event){
				if(event.target!==p)return;
				if(!event.isTrusted)return;
				event.preventDefault();
				event.stopPropagation();
				event.stopImmediatePropagation();
				p.textContent = "clicked"
			},{"capture":true,"once":true,"passive":true});
		}</script>`,
	)
})
