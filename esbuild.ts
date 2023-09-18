import { build } from "npm:esbuild"
await build({
	entryPoints: ["src/poggies.ts"],
	outfile: "dist/poggies.js",
	format: "esm",
	bundle: true,
	treeShaking: true,
	external: ["node:fs"],
	minify: true,
})

import("npm:typescript/lib/tsc.js") // fun way to run `tsc` to generate types
