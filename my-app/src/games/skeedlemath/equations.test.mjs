import test from 'node:test';
import assert from 'node:assert/strict';
import { generateEquation } from './equations.js';

test('daily equations vary operations and locations across three years, including leap day', () => {
  let previous;
  const signatures = new Set();
  for (let day = 0; day < 1096; day++) {
    const date = new Date(Date.UTC(2026, 0, 1) + day * 86400000).toISOString().slice(0, 10);
    const equation = generateEquation(true, date);
    assert.equal(equation.length, 10, date);
    assert.match(equation, /^[0-9+*/()=-]+$/);
    const [left, right] = equation.split('=');
    assert.equal(Function(`return (${left})`)(), Number(right), date);
    const first = equation.match(/[+*/-]/);
    if (previous) {
      assert.notEqual(first[0], previous.match(/[+*/-]/)[0], date);
      assert.notEqual(first.index, previous.match(/[+*/-]/).index, date);
      assert.ok(!(equation.includes('(') && previous.includes('(')), date);
    }
    if (equation.includes('(')) assert.notEqual(Function(`return (${left.replace(/[()]/g, '')})`)(), Number(right));
    signatures.add(equation.replace(/\d/g, 'N'));
    previous = equation;
  }
  assert.ok(signatures.size >= 20, `Expected diverse layouts, got ${signatures.size}`);
});

test('daily generation is independent of practice games and date lookup order', () => {
  const first = generateEquation(true, '2028-02-29');
  for (let i = 0; i < 30; i++) assert.equal(generateEquation(false).length, 10);
  generateEquation(true, '2030-01-01');
  assert.equal(generateEquation(true, '2028-02-29'), first);
  assert.throws(() => generateEquation(true, '2026-02-30'), RangeError);
});
