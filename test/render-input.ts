import { readFileSync, unlinkSync, watchFile, writeFileSync } from "node:fs";
import { Poggies } from "../src/poggies.js";

const data = {
	first: 12,
	second: 26,
	words: ["loops ", "are ", "cool"],
	chance: Math.random() < 0.5,
};
const input = new URL("./input.pog", import.meta.url);
const output = new URL("./output.html", import.meta.url);
const outputJS = new URL("./output.js", import.meta.url);
writeFileSync(input, "");
watchFile(input, {}, () => {
	const poggies = new Poggies(readFileSync(input, "utf8"));
	writeFileSync(
		outputJS,
		"/*eslint-disable unicorn/no-abusive-eslint-disable*/\n/*eslint-disable*/\nasync function anonymous(__INPUT__){" +
			poggies.js +
			"}"
	);
	poggies
		.render(data)
		.then(html => writeFileSync(output, html))
		.catch(console.error);
});
console.log("Live reloading ./input.pog to ./output.html and ./output.js");
process.once("SIGINT", () => {
	unlinkSync(outputJS);
	unlinkSync(output);
	unlinkSync(input);
	process.exit();
});
