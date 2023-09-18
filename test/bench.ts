import { Poggies } from "../src/poggies.ts"
import { data } from "./utils.ts"

const source = Deno.readTextFileSync(new URL("test.pog", import.meta.url))
Deno.bench("parse", async () => {
	new Poggies(source)
})
const poggies = new Poggies(source)
Deno.bench("compile", async () => {
	poggies.compile()
})
poggies.compile()
Deno.bench("render", async () => {
	await poggies.render(data)
})
