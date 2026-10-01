import assert from 'node:assert/strict';
import test from 'node:test';
import { generateEquation } from './equations.js';
import { mathProgressKey, restoreMathGuesses } from './progress.js';

test('archive progress keys are separate from the live daily', () => {
  assert.notEqual(mathProgressKey('2026-09-01', true), mathProgressKey('2026-09-01', false));
});

test('saved guesses restore with the right game status', () => {
  const target = generateEquation(true, '2026-09-05');
  const wrong = '1+2+3+4=10';
  assert.deepEqual(restoreMathGuesses(target, { target, guesses: [wrong] }, 6), { guesses: [wrong], status: 'IN_PROGRESS', hasStarted: true });
  assert.equal(restoreMathGuesses(target, { target, guesses: [wrong, target] }, 6).status, 'WON');
  assert.equal(restoreMathGuesses(target, { target, guesses: Array(6).fill(wrong) }, 6).status, 'LOST');
  assert.deepEqual(restoreMathGuesses(target, { target: 'other', guesses: [wrong] }, 6).guesses, []);
});
