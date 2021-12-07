import { readFileSync } from "node:fs";
import { Poggies } from "../src/poggies.js";

const readme = readFileSync(
	new URL("../readme.md", import.meta.url)
).toString();

const renderRe =
	/```\s+(html[^]*?)\s*?```|`(?!js)([a-z][^<]+?)`|new Poggies\(\s*'([a-z].+?)'\s*\)|new Poggies\(\s*"([a-z].+?)"\s*\)|new Poggies\(\s*`([a-z].+?)`\s*\)/g;

const strs = [...readme.matchAll(renderRe)].map(([, ...poss]) =>
	poss.find(Boolean)
);
const data = {
	first: 12,
	second: 26,
	words: ["loops ", "are ", "cool"],
	chance: Math.random() < 0.5,
};
console.dir(strs);
for (const str of strs) {
	console.dir(str);
	console.log(await new Poggies(str).render(data));
}
