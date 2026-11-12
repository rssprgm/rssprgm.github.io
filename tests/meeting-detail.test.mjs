import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../meeting-detail.js', import.meta.url), 'utf8').replace(/^import .*;\n/, '');
const { matchingNotes } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('notes search is case-insensitive, whitespace tolerant, and requires every word', () => {
  const notes = ['A commit records staged contents locally.', 'Push sends commits to a remote.'];
  assert.deepEqual(matchingNotes(notes, '  COMMIT   locally '), [true, false]);
  assert.deepEqual(matchingNotes(notes, 'remote'), [false, true]);
  assert.deepEqual(matchingNotes(notes, ''), [true, true]);
  assert.deepEqual(matchingNotes(notes, 'unmatched'), [false, false]);
});
