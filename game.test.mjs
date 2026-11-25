import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { gunzipSync } from 'node:zlib';
import { alphabet, dictionaryHas, normalize, score, nextHint } from './engine.mjs';
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

test('preserves all accepted guesses and 200 unique answers with clues and weights', () => {
  const dictionary = gunzipSync(readFileSync(new URL('./dictionary.bin.gz', import.meta.url)));
  assert.equal(dictionary.length, Math.ceil(alphabet.length ** 5 / 8));
  const bitCount = Array.from({ length: 256 }, (_, n) => n.toString(2).replaceAll('0', '').length);
  const count = dictionary.reduce((sum, byte) => sum + bitCount[byte], 0);
  assert.equal(count, 540057);
  assert.equal(new Set(answers.map(([word]) => word)).size, 200);
  assert.ok(answers.every(([word, clue, pattern]) => clue && pattern && dictionaryHas(dictionary, word)));
  assert.equal(dictionaryHas(dictionary, 'غغااا'), false);
});

test('progressive help is truthful, unique and skips positions already solved', () => {
  for (const [answer, description] of answers) {
    assert.ok(description && !description.includes(answer));
    const guesses = [{ word: 'سعادة', result: score('سعادة', answer) }];
    const history = [];
    for (let hint; (hint = nextHint(answer, guesses, history));) {
      assert.ok(history.length < 40);
      assert.ok(!history.some(previous => JSON.stringify(previous) === JSON.stringify(hint)));
      if (hint.kind === 'letter') assert.ok(answer.includes(hint.letter));
      if (hint.kind === 'position') {
        assert.equal(answer[hint.index], hint.letter);
        assert.notEqual(guesses[0].result[hint.index], 'exact');
      }
      if (hint.kind === 'repeat') {
        if (hint.letter) {
          assert.ok(hint.count >= 2);
          assert.equal(hint.count, [...answer].filter(letter => letter === hint.letter).length);
        } else assert.equal(new Set(answer).size, 5);
      }
      if (hint.kind === 'exclude') {
        assert.equal(hint.letter.length, 1);
        assert.ok(!answer.includes(hint.letter));
      }
      history.push(hint);
    }
    assert.ok(history.some(hint => hint.kind === 'repeat'));
    assert.ok(history.some(hint => hint.kind === 'exclude'));
  }
});

test('help settings filter every clue and weight unlocks on the fourth guess', () => {
  const answer = 'ساعات';
  const guess = { word: 'غابات', result: score('غابات', answer) };
  assert.deepEqual(nextHint(answer, [], []), { kind: 'meaning' });
  assert.equal(nextHint(answer, Array(3).fill(guess), [], ['pattern']), null);
  assert.deepEqual(nextHint(answer, Array(4).fill(guess), [], ['pattern']), { kind: 'pattern' });
  assert.equal(nextHint(answer, [], [], []), null);
  assert.deepEqual(nextHint(answer, [], [], ['repeat']), { kind: 'repeat', letter: 'ا', count: 2 });
  assert.equal(nextHint(answer, [], [], ['exclude']).kind, 'exclude');
});
