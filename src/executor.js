const { Script } = require("vm");
/**
 * Executes code, doesn't support async/await syntax.
 * @param {Script} script Code to execute
 * @param {[x: string]: any} opts Passed variables (contextified!)
 * @returns {Promise} Result
 */
module.exports = {
	compile: code => new Script(code),
	exec: (script, opts) => script.runInContext(opts)
};
