// Adjacent days change both the first operation and its character position.
// Parentheses appear only in separated slots, including across cycle boundaries.
const schedule = [
  ['*', 1, true], ['/', 2, false], ['+', 1, false], ['-', 2, false],
  ['*', 1, false], ['+', 2, false], ['/', 1, true], ['*', 2, false],
  ['-', 1, false], ['/', 2, false], ['+', 1, false], ['-', 2, false],
];
const banks = new Map();
const operations = {
  '+': (a, b) => a + b, '-': (a, b) => a - b,
  '*': (a, b) => a * b, '/': (a, b) => a / b,
};
const high = operator => operator === '*' || operator === '/';

function value(a, first, b, second, c, parentheses) {
  if (parentheses || (!high(first) && high(second))) return operations[first](a, operations[second](b, c));
  return operations[second](operations[first](a, b), c);
}

function bankFor([first, digits, parentheses]) {
  const key = `${first}:${digits}:${parentheses}`;
  if (banks.has(key)) return banks.get(key);
  const structures = new Map();
  for (let a = digits === 1 ? 1 : 10; a <= (digits === 1 ? 9 : 99); a++) {
    for (let b = 1; b <= 40; b++) {
      for (let c = 1; c <= 20; c++) {
        for (const second of ['+', '-', '*', '/']) {
          const result = value(a, first, b, second, c, parentheses);
          if (!Number.isInteger(result) || result < 0 || result > 999) continue;
          if (parentheses && result === value(a, first, b, second, c, false)) continue;
          const equation = `${a}${first}${parentheses ? '(' : ''}${b}${second}${c}${parentheses ? ')' : ''}=${result}`;
          if (equation.length !== 10) continue;
          const signature = equation.replace(/\d/g, 'N');
          if (!structures.has(signature)) structures.set(signature, []);
          structures.get(signature).push(equation);
        }
      }
    }
  }
  const bank = [...structures.values()];
  if (!bank.length) throw new Error(`No equations for ${key}`);
  banks.set(key, bank);
  return bank;
}

function random(seed) {
  return () => {
    let t = seed += 0x6d2b79f5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateEquation(isDaily = false, date = new Date().toISOString().slice(0, 10)) {
  const day = Date.parse(`${date}T00:00:00Z`) / 86400000;
  if (isDaily && (!Number.isInteger(day) || new Date(day * 86400000).toISOString().slice(0, 10) !== date)) throw new RangeError('Expected a valid YYYY-MM-DD date');
  const rng = isDaily ? random(day) : Math.random;
  const slot = isDaily ? ((day % schedule.length) + schedule.length) % schedule.length : Math.floor(rng() * schedule.length);
  const bank = bankFor(schedule[slot]);
  // Choose structures evenly so abundant numerical combinations do not dominate.
  const structure = bank[Math.floor(rng() * bank.length)];
  return structure[Math.floor(rng() * structure.length)];
}
