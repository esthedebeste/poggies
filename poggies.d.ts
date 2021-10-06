export class Poggies {
	constructor(source: string);
	/**
	 * Renders this Poggies document with some given variables
	 * @param passing Passed variables
	 * @returns The HTML
	 */
	render(passing: { [key: string]: any }): Promise<string>;
}
export type Options = { doctype?: "html" | string | false };
/**
 * Renders a Poggies file with some given variables
 * @param file File path
 * @param passing Passed variables
 * @returns The HTML
 */
export function renderFile(
	file: string,
	passing: { [key: string]: any },
	options: Options
): Promise<string>;
export function __express(
	file: string,
	passing: { [key: string]: any },
	options: Options,
	callback: (err: any, result: string) => void
): void;
