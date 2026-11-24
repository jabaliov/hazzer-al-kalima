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
