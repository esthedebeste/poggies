export const isTag = (char: string) => /^[\w!-]+$/.test(char);
export const isWS = (char: string) => /^\s+$/.test(char);

export const inputvar = "__INPUT__";
export const outvar = "__OUT__";
export const jsonifyfunc = "__JSONIFY__";
