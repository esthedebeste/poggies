import { fromFileUrl } from "https://deno.land/std@0.180.0/path/mod.ts"
import { Poggies } from "../src/poggies.ts"
import { data } from "./utils.ts"

const input = fromFileUrl(new URL("input.pog", import.meta.url))
const output = fromFileUrl(new URL("dist/live.html", import.meta.url))
const outputJS = fromFileUrl(new URL("dist/live.js", import.meta.url))
Deno.writeTextFileSync(input, "")
const watcher = Deno.watchFs(input)
console.log("Live reloading ./input.pog to dist/live.html and dist/live.js")

function clean() {
	console.log("Bye!")
	Deno.removeSync(input)
}

addEventListener("beforeunload", clean)
addEventListener("unload", clean)
Deno.addSignalListener("SIGINT", () => {
	Deno.exit()
})

for await (const event of watcher) {
	if (event.kind !== "modify") continue
	const poggies = new Poggies(Deno.readTextFileSync(input) || "ERROR!")
	Deno.writeTextFileSync(
		outputJS,
		`// @ts-nocheck\nasync function anonymous(__INPUT__,__JSONIFY__=JSON.stringify){${poggies.js}}`,
	)
	try {
		poggies.compile()
	} catch (error) {
		console.error(error)
		console.dir(poggies, { depth: Number.POSITIVE_INFINITY })
		continue
	}
	Deno.writeTextFileSync(
		outputJS,
		"// @ts-nocheck\n" + poggies.compile().toString(),
	)
	poggies
		.render(data)
		// eslint-disable-next-line unicorn/prefer-top-level-await
		.then((html) => {
			Deno.writeTextFileSync(output, html)
			console.log("Rendered to ./dist/live.html")
		}, console.error)
}
