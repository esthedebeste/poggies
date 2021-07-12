const { writeFileSync } = require("fs");
const { renderFile } = require("../index.js");
renderFile("test.pog", { tld: "org" }).then(file => {
	writeFileSync("test.html", file);
});
