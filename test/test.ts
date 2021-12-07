import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Poggies, renderFile } from "../dist/poggies.js";

const ansi = (...n: number[]) => `\x1b[${n.join(";")}m`;
const reset = ansi(0);
const green = ansi(32);
const styled = (str: string, style: string) => `${style}${str}${reset}`;
mkdirSync(new URL("./output", import.meta.url), { recursive: true });
console.log(styled("Poggies Benchmark / Test", ansi(32, 4)));
const data = {
	site: "example",
	tld: "com",
	forTest: { sentence: ["For ", "of ", "loops ", "work!"] },
	ifstatements: { working: () => true },
	doubleTest: [
		{ show: true, content: "For and If combined is " },
		{ show: false, content: "not " },
		{ show: true, content: "working!" },
	],
};
const total = styled("Total Time Taken", green);
const parsing = styled("Parsing", green);
const compiling = styled("Compiling", green);
const firstRender = styled("First Render", green);

const source = readFileSync(new URL("./test.pog", import.meta.url)).toString();
console.time(total);
console.time(parsing);
const poggies = new Poggies(source);
console.timeEnd(parsing);
console.time(compiling);
const compiled = poggies.compile();
console.timeEnd(compiling);
console.time(firstRender);
await poggies.render(data);
console.timeEnd(firstRender);
console.timeEnd(total);
writeFileSync(
	new URL("./output/poggies.js", import.meta.url),
	"/*eslint-disable unicorn/no-abusive-eslint-disable*/\n/*eslint-disable*/\n" +
		compiled.toString()
);
writeFileSync(
	new URL("./output/poggies.html", import.meta.url),
	await renderFile(new URL("./test.pog", import.meta.url), data)
);

const start = process.hrtime.bigint();
for (let i = 0; i < 100; i++) await poggies.render(data);
const end = process.hrtime.bigint();
const msAvg = Number(end - start) / 100000000;
console.log(green + `100 renders average${reset}: ${msAvg} ms/render`);
console.log("\n");
console.log(
	green +
		"Rendered to ./output/poggies.html, compile output at ./output/poggies.js" +
		reset
);
