import { answers } from './solutions.mjs';
import { alphabet, dictionaryHas, normalize, score } from './engine.mjs';

const byId = id => document.getElementById(id);
const input = byId('guess');
const status = byId('status');
const submit = byId('submit');
const erase = byId('erase');
const help = byId('rules');
const restart = byId('restart');
const symbols = { exact: '✓', present: '↔', absent: '×' };
const labels = {
  exact: 'في مكانه الصحيح',
  present: 'في مكان آخر',
  absent: 'غير موجود أو استُخدم بالفعل',
};
const rank = { exact: 3, present: 2, absent: 1 };
const numbers = new Intl.NumberFormat('ar-SA');
const cells = [];
const keys = new Map();
let answerIndex = -1;
let guesses = [];
let dictionary;
let finished = false;

for (let row = 0; row < 6; row++) {
  const item = document.createElement('li');
  item.className = 'row';
  const slots = Array.from({ length: 5 }, () => {
    const cell = document.createElement('span');
    cell.className = 'cell';
    cell.setAttribute('aria-hidden', 'true');
    item.append(cell);
    return cell;
  });
  const text = document.createElement('span');
  text.className = 'sr-only';
  item.append(text);
  byId('board').append(item);
  cells.push({ item, slots, text });
}

for (let row = 0; row < 3; row++) {
  const line = document.createElement('div');
  line.className = 'key-row';
  for (const letter of alphabet.slice(row * 11, row * 11 + 11)) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'key';
    key.addEventListener('click', () => {
      if (finished || input.value.length === 5) return;
      input.value += letter;
      input.removeAttribute('aria-invalid');
      refresh();
    });
    keys.set(letter, key);
    line.append(key);
  }
  byId('keys').append(line);
}

function paint(element, letter, outcome) {
  element.classList.remove('exact', 'present', 'absent');
  element.textContent = letter;
  if (!outcome) return;
  element.classList.add(outcome);
  const mark = document.createElement('span');
  mark.className = 'mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = symbols[outcome];
  element.append(mark);
}

function refresh() {
  const states = new Map();
  cells.forEach(({ item, slots, text }, row) => {
    const guess = guesses[row];
    const active = !finished && row === guesses.length;
    item.classList.toggle('current', active);
    text.textContent = 'المحاولة ' + numbers.format(row + 1) + '، ' + (
      guess ? [...guess.word].map((letter, col) => letter + ' ' + labels[guess.result[col]]).join('، ')
        : active ? 'جارية' : 'فارغة'
    );
    slots.forEach((cell, col) => {
      const letter = guess?.word[col] ?? (active ? input.value[col] : '') ?? '';
      const result = guess?.result[col];
      paint(cell, letter, result);
      if (result && rank[result] > (rank[states.get(letter)] ?? 0)) states.set(letter, result);
    });
  });

  for (const [letter, key] of keys) {
    const outcome = states.get(letter);
    paint(key, letter, outcome);
    key.setAttribute('aria-label', outcome ? letter + '، ' + labels[outcome] : letter);
    key.setAttribute('aria-disabled', String(finished));
  }
  input.readOnly = finished;
  erase.setAttribute('aria-disabled', String(finished || !input.value));
  submit.setAttribute('aria-disabled', String(!dictionary || finished));
  byId('attempt').textContent = finished ? 'انتهت الجولة'
    : 'المحاولة ' + numbers.format(guesses.length + 1) + ' من ٦';
  byId('hint').textContent = guesses.length >= 2 || finished
    ? answers[answerIndex][1] : 'تظهر فئة الكلمة بعد محاولتين.';
}

function newRound() {
  const options = answers.length - Number(answerIndex >= 0);
  const next = Math.floor(Math.random() * options);
  answerIndex = answerIndex >= 0 && next >= answerIndex ? next + 1 : next;
  guesses = [];
  input.value = '';
  finished = false;
  input.removeAttribute('aria-invalid');
  status.textContent = dictionary ? 'أدخل تخمينك الأول.' : 'جارٍ تحميل القاموس…';
  refresh();
}

input.addEventListener('input', event => {
  if (event.isComposing) return;
  input.value = normalize(input.value);
  input.removeAttribute('aria-invalid');
  refresh();
});
input.addEventListener('compositionend', () => {
  input.value = normalize(input.value);
  refresh();
});

byId('form').addEventListener('submit', event => {
  event.preventDefault();
  if (!dictionary || finished) return;
  const word = normalize(input.value);
  if (word.length !== 5 || !dictionaryHas(dictionary, word)) {
    const message = word.length !== 5 ? 'أدخل خمسة حروف.' : 'هذه الكلمة غير موجودة في القاموس.';
    input.setAttribute('aria-invalid', 'true');
    status.textContent = message;
    input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  const [answer, category] = answers[answerIndex];
  const result = score(word, answer);
  guesses.push({ word, result });
  input.value = '';
  finished = word === answer || guesses.length === 6;
  refresh();
  const detail = [...word].map((letter, col) => letter + ' ' + labels[result[col]]).join('، ');
  status.textContent = word === answer ? 'أحسنت! اكتشفت كلمة «' + answer + '».'
    : finished ? 'انتهت المحاولات. الكلمة هي «' + answer + '».'
    : detail + (guesses.length === 2 ? '، فئة الكلمة ' + category + '.' : '.');
  if (!finished) input.focus();
});

erase.addEventListener('click', () => {
  if (finished || !input.value) return;
  input.value = input.value.slice(0, -1);
  input.removeAttribute('aria-invalid');
  refresh();
});

byId('help').addEventListener('click', () => help.showModal());
byId('reset').addEventListener('click', () => {
  if (guesses.length && !finished) {
    restart.returnValue = 'cancel';
    restart.showModal();
    return;
  }
  newRound();
  input.focus();
});
restart.addEventListener('close', () => {
  if (restart.returnValue !== 'restart') return;
  newRound();
  input.focus();
});

async function loadDictionary() {
  const retry = byId('retry');
  if (retry) retry.remove();
  status.textContent = 'جارٍ تحميل القاموس…';
  try {
    const response = await fetch('./dictionary.bin.gz');
    if (!response.ok || !response.body) throw new Error('Dictionary unavailable');
    const decoded = response.body.pipeThrough(new DecompressionStream('gzip'));
    const bytes = await new Response(decoded).arrayBuffer();
    if (bytes.byteLength !== Math.ceil(alphabet.length ** 5 / 8)) throw new Error('Invalid dictionary');
    dictionary = new Uint8Array(bytes);
    status.textContent = 'أدخل تخمينك الأول.';
    refresh();
  } catch {
    status.textContent = 'تعذّر تحميل القاموس.';
    const button = document.createElement('button');
    button.id = 'retry';
    button.className = 'quiet';
    button.textContent = 'إعادة تحميل القاموس';
    button.addEventListener('click', loadDictionary);
    status.after(button);
  }
}

newRound();
loadDictionary();
