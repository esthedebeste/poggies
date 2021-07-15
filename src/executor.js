const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
/**
 * Executes code, supports async/await syntax.
 * @param {string} code Code to execute
 * @param {[x: string]: any} opts Passed variables
 * @returns {Promise} Result
 */
module.exports = (code, opts) =>
	AsyncFunction(
		...Object.keys(opts),
		`return ${code};`
	)(...Object.values(opts));
