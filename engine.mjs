export const alphabet = 'ضصثقفغعهخحجشسيبلاتنمكطئءؤرزةوىدذظ';
const letters = new Set(alphabet);

export function normalize(value) {
  return [...value.normalize('NFC').replace(/[أإآٱ]/g, 'ا')]
    .filter(letter => letters.has(letter)).slice(0, 5).join('');
}

export function score(guess, answer) {
  const remainder = [...answer];
  const result = Array.from(guess, (letter, index) => {
    if (letter !== answer[index]) return 'absent';
    remainder[index] = null;
    return 'exact';
  });

  for (const [index, letter] of [...guess].entries()) {
    if (result[index] === 'exact') continue;
    const match = remainder.indexOf(letter);
    if (match < 0) continue;
    result[index] = 'present';
    remainder[match] = null;
  }
  return result;
}

// A five-letter word is a base-33 index into the dictionary bitset.
export function dictionaryHas(dictionary, word) {
  if (word.length !== 5) return false;
  let index = 0;
  for (const letter of word) {
    const digit = alphabet.indexOf(letter);
    if (digit < 0) return false;
    index = index * alphabet.length + digit;
  }
  return Boolean(dictionary[index >> 3] & (1 << (index & 7)));
}

export const hintKinds = ['meaning', 'pattern', 'letter', 'repeat', 'exclude', 'position'];
const letterHintOrder = ['letter', 'repeat', 'exclude', 'position'];

// Prefer newly available descriptions, then rotate through the remaining help.
export function nextHint(answer, guesses, history, enabled = hintKinds) {
  const available = new Set(enabled);
  const used = new Set(history.map(hint => hint.kind));
  if (available.has('meaning') && !used.has('meaning')) return { kind: 'meaning' };
  if (available.has('pattern') && guesses.length >= 4 && !used.has('pattern')) {
    return { kind: 'pattern' };
  }

  const known = new Set();
  const positioned = new Set();
  const excluded = new Set();
  for (const { word, result } of guesses) {
    result.forEach((outcome, index) => {
      if (outcome === 'exact') positioned.add(index);
      if (outcome !== 'absent') known.add(word[index]);
      else if (!answer.includes(word[index])) excluded.add(word[index]);
    });
  }
  for (const hint of history) {
    if (hint.kind === 'letter' || hint.kind === 'position' || (hint.kind === 'repeat' && hint.letter)) {
      known.add(hint.letter);
    }
    if (hint.kind === 'position') positioned.add(hint.index);
    if (hint.kind === 'exclude') excluded.add(hint.letter);
  }

  const positions = [0, 4, 2, 1, 3];
  const letter = positions.map(index => answer[index]).find(value => !known.has(value));
  const index = positions.find(position => !positioned.has(position));
  const excludedLetter = [...alphabet].find(value => !answer.includes(value) && !excluded.has(value));
  const counts = new Map();
  for (const value of answer) counts.set(value, (counts.get(value) ?? 0) + 1);
  const repeated = [...counts].filter(([value, count]) => count > 1
    && !history.some(hint => hint.kind === 'repeat' && hint.letter === value));
  const repeat = repeated.length
    ? { kind: 'repeat', letter: repeated[0][0], count: repeated[0][1] }
    : counts.size === answer.length && !used.has('repeat') ? { kind: 'repeat' } : null;
  const candidates = {
    letter: letter && { kind: 'letter', letter },
    repeat,
    exclude: excludedLetter && { kind: 'exclude', letter: excludedLetter },
    position: index !== undefined && { kind: 'position', index, letter: answer[index] },
  };

  const previous = history.findLast(hint => letterHintOrder.includes(hint.kind));
  const start = previous ? letterHintOrder.indexOf(previous.kind) + 1 : 0;
  for (let offset = 0; offset < letterHintOrder.length; offset++) {
    const kind = letterHintOrder[(start + offset) % letterHintOrder.length];
    if (available.has(kind) && candidates[kind]) return candidates[kind];
  }
  return null;
}
