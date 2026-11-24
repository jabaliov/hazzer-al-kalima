import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { alphabet, dictionaryHas, normalize, score } from './engine.mjs';
import { answers } from './solutions.mjs';

test('normalizes Arabic alef, strips marks, and limits an entry to five letters', () => {
  assert.equal(normalize('أَسْـمَاء!!'), 'اسماء');
  assert.equal(normalize('إآٱابج'), 'ااااب');
  assert.equal(normalize('abc'), '');
});

test('exact matches consume letters before misplaced matches', () => {
  assert.deepEqual(score('سسسسم', 'سمتسم'), ['exact', 'absent', 'absent', 'exact', 'exact']);
  assert.deepEqual(score('ممسست', 'سمتسم'), ['present', 'exact', 'present', 'exact', 'present']);
  assert.deepEqual(score('غابات', 'غابات'), Array(5).fill('exact'));
});

test('preserves all accepted guesses and 200 unique categorized answers', () => {
  const dictionary = gunzipSync(readFileSync(new URL('./dictionary.bin.gz', import.meta.url)));
  assert.equal(dictionary.length, Math.ceil(alphabet.length ** 5 / 8));
  const bitCount = Array.from({ length: 256 }, (_, n) => n.toString(2).replaceAll('0', '').length);
  const count = dictionary.reduce((sum, byte) => sum + bitCount[byte], 0);
  assert.equal(count, 540057);
  assert.equal(new Set(answers.map(([word]) => word)).size, 200);
  assert.ok(answers.every(([word, category]) => category && dictionaryHas(dictionary, word)));
  assert.equal(dictionaryHas(dictionary, 'غغااا'), false);
});
