const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
/**
 * Executes code, supports async/await syntax.
 * @param {string} code Code to execute
 * @param {[x: string]: any} opts Passed variables
 * @returns {any} Result
 */
module.exports = async (code, opts) => {
	const source = `
    ${Object.keys(opts)
			.map(variable => `const ${variable} = ${JSON.stringify(opts[variable])};`)
			.join("")}return ${code};`;
	return await AsyncFunction(source)();
};
