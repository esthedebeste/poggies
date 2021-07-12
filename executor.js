const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
module.exports = async (code, opts) => {
	const source = `
    ${Object.keys(opts)
			.map(variable => `const ${variable} = ${JSON.stringify(opts[variable])};`)
			.join("")}return ${code};`;
	return await AsyncFunction(source)();
};
