export type AngleMode = 'rad' | 'deg';
const FUNCTIONS: Record<string, (x: number) => number> = {
  sin: Math.sin, cos: Math.cos, tan: Math.tan,
  asin: Math.asin, acos: Math.acos, atan: Math.atan,
  sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
  ln: Math.log, log: Math.log10, sqrt: Math.sqrt, cbrt: Math.cbrt,
  exp: Math.exp, abs: Math.abs,
};

export function factorial(n: number): number {
  if (!Number.isInteger(n) || n < 0 || n > 170) throw new Error('Factorial requires an integer from 0 to 170');
  let result = 1;
  for (let i = 2; i <= n; i++) result *= i;
  return result;
}

// Bounded recursive-descent arithmetic grammar; never executes JavaScript.
export function evaluate(expression: string, angleMode: AngleMode = 'rad'): number {
  if (!expression.trim()) throw new Error('Enter an expression');
  if (expression.length > 1000) throw new Error('Expression is too long (maximum 1000 characters)');
  const source = expression;
  let index = 0, depth = 0;
  const space = () => { while (/\s/.test(source[index] ?? '') && index < source.length) index++; };
  const take = (symbol: string) => { space(); if (source[index] !== symbol) return false; index++; return true; };
  const nested = (parse: () => number): number => {
    if (++depth > 64) throw new Error('Expression nesting is too deep');
    try { return parse(); } finally { depth--; }
  };
  const primary = (): number => {
    space();
    if (take('(')) {
      const value = nested(sum);
      if (!take(')')) throw new Error('Missing closing parenthesis');
      return value;
    }
    const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(source.slice(index));
    if (number) { index += number[0].length; return Number(number[0]); }
    const name = /^[a-zA-Z]+/.exec(source.slice(index));
    if (name) {
      index += name[0].length;
      const key = name[0].toLowerCase();
      if (key === 'pi') return Math.PI;
      if (key === 'e') return Math.E;
      if (!Object.hasOwn(FUNCTIONS, key)) throw new Error(`Unknown function: ${name[0]}`);
      if (!take('(')) throw new Error('Function requires parentheses');
      let argument = nested(sum);
      if (!take(')')) throw new Error('Missing closing parenthesis');
      if (angleMode === 'deg' && ['sin', 'cos', 'tan'].includes(key)) argument *= Math.PI / 180;
      let value = FUNCTIONS[key](argument);
      if (angleMode === 'deg' && ['asin', 'acos', 'atan'].includes(key)) value *= 180 / Math.PI;
      return value;
    }
    throw new Error('Expected a number, function or parenthesis');
  };
  const postfix = (): number => { let value = primary(); while (take('!')) value = factorial(value); return value; };
  const power = (): number => { const base = postfix(); return take('^') ? base ** nested(unary) : base; };
  const unary = (): number => {
    if (take('+')) return nested(unary);
    if (take('-')) return -nested(unary);
    return power();
  };
  const product = (): number => {
    let value = unary();
    while (true) {
      if (take('*')) value *= unary();
      else if (take('/')) value /= unary();
      else if (take('%')) value %= unary();
      else return value;
    }
  };
  const sum = (): number => {
    let value = product();
    while (true) {
      if (take('+')) value += product();
      else if (take('-')) value -= product();
      else return value;
    }
  };
  const value = sum();
  space();
  if (index !== source.length) throw new Error(`Unexpected character: ${source[index]}`);
  if (!Number.isFinite(value)) throw new Error('Result is outside the real finite number range');
  return value;
}
