// deno does these without decimals, polyfill with more precision
const timers = new Map<string, number>()
console.time = function time(name: string) {
	timers.set(name, performance.now())
}
console.timeEnd = function timeEnd(name: string) {
	const end = performance.now()
	const start = timers.get(name)
	if (start === undefined) throw new Error("Timer not started")
	const ms = end - start
	console.log(
		`${name}: ${ms.toFixed(10).replace(/0+$/, "")}ms`,
	)
}

export const data = {
	site: "example",
	tld: "com",
	forTest: { sentence: ["For ", "of ", "loops ", "work!"] },
	ifstatements: { working: () => true },
	doubleTest: [
		{ show: true, content: "For and If combined is " },
		{ show: false, content: "not " },
		{ show: true, content: "working!" },
	],
	first: 12,
	second: 26,
	words: ["loops ", "are ", "cool"],
	chance: Math.random() < 0.5,
	users: [
		{
			name: "Esthe de Beste",
			thebest: true,
		},
		{
			name: "John Doe",
			thebest: false,
		},
	],
}
