import { writeFileSync } from "fs";
/*
Symlink created in node_modules to allow test to
import its parent without needing to specify a path
*/
import { renderFile } from "poggies";
const start = performance.now();
const ansi = (...n) => process.stdout.write(`\x1b[${n.join(";")}m`, ``);
renderFile("test.pog", {
	site: "example",
	tld: "com",
	forTest: { sentence: ["Woah, ", "for ", "of ", "loops ", "work!"] },
	ifstatements: { working: () => true },
	doubleTest: [
		{ show: true, content: "For and If combined is " },
		{ show: false, content: "not " },
		{ show: true, content: "working!" }
	]
}).then(file => {
	ansi(33, 1);
	console.log(
		`Uncached renderFile speed ${(performance.now() - start).toFixed(4)}ms`
	);
	const first = performance.now();
	renderFile("test.pog", {
		site: "example",
		tld: "org",
		forTest: { sentence: ["Woah, ", "for ", "of ", "loops ", "work!"] },
		ifstatements: { working: () => true },
		doubleTest: [
			{ show: true, content: "For and If combined is " },
			{ show: false, content: "not " },
			{ show: true, content: "working!" }
		]
	}).then(file => {
		ansi(32, 1);
		console.log(
			`Cached renderFile speed   ${(performance.now() - first).toFixed(4)}ms`
		);
		writeFileSync("test.html", file);
		ansi(0, 6);
	});
});
