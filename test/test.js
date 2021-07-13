const { renderFile } = require("../index.js");
const { writeFileSync } = require("fs");
const start = performance.now();
const ansi = (...n) => process.stdout.write(`\x1b[${n.join(";")}m`, ``);
renderFile("test.pog", { tld: "com" }).then(file => {
	ansi(33, 1);
	console.log(
		`Uncached renderFile speed ${(performance.now() - start).toFixed(4)}ms`
	);
	const first = performance.now();
	renderFile("test.pog", { tld: "org" }).then(file => {
		ansi(32, 1);
		console.log(
			`Cached renderFile speed   ${(performance.now() - first).toFixed(4)}ms`
		);
		writeFileSync("test.html", file);
		ansi(0, 6);
	});
});
