const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
/**
 * Executes code, supports async/await syntax.
 * @param {string} code Code to execute
 * @param {[x: string]: any} opts Passed variables
 * @returns {any} Result
 */
module.exports = async (code, opts) => {
	const source = `return ${code};`;
	return await AsyncFunction(
		...Object.keys(opts),
		source
	)(...Object.values(opts));
};
