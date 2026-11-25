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

// Keep the help sequence deterministic and skip information already on the board.
export function nextHint(answer, guesses, history) {
  const known = new Set();
  const positioned = new Set();
  const excluded = new Set();
  for (const {word, result} of guesses) {
    result.forEach((outcome, index) => {
      if (outcome === 'exact') positioned.add(index);
      if (outcome !== 'absent') known.add(word[index]);
      else if (!answer.includes(word[index])) excluded.add(word[index]);
    });
  }
  for (const hint of history) {
    if (hint.kind === 'letter' || hint.kind === 'position') known.add(hint.letter);
    if (hint.kind === 'position') positioned.add(hint.index);
    if (hint.kind === 'exclude') hint.letters.forEach(letter => excluded.add(letter));
  }

  const letters = [...answer];
  const positions = [0, 4, 2, 1, 3];
  const newLetter = positions.map(i => letters[i]).find(letter => !known.has(letter));
  if (history.length === 0 && newLetter) return {kind: 'letter', letter: newLetter};

  if (!history.some(hint => hint.kind === 'repeat')) {
    return {kind: 'repeat', repeats: new Set(letters).size < letters.length};
  }

  const index = positions.find(position => !positioned.has(position));
  const unused = [...alphabet].filter(letter => !answer.includes(letter) && !excluded.has(letter));
  if (unused.length && (index === undefined || history.at(-1)?.kind !== 'exclude')) {
    return {kind: 'exclude', letters: unused.slice(0, 2)};
  }
  if (index !== undefined) return {kind: 'position', index, letter: letters[index]};
  return null;
}
