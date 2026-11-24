import { answers } from './solutions.mjs';
import { alphabet, dictionaryHas, normalize, score } from './engine.mjs';

const byId = id => document.getElementById(id);
const input = byId('guess');
const status = byId('status');
const submit = byId('submit');
const reveal = byId('reveal');
const surrender = byId('surrender');
const help = byId('rules');
const confirm = byId('confirm');
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
let revealedIndex = -1;
const keyboardRows = ['ذ', 'ض ص ث ق ف غ ع ه خ ح ج د', 'ش س ي ب ل ا ت ن م ك ط', 'ئ ء ؤ ر لا ى ة و ز ظ'];

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

for (const row of keyboardRows) {
  const line = document.createElement('div');
  line.className = 'key-row';
  for (const letter of row.split(' ')) {
    const key = document.createElement('button');
    key.type = 'button';
    key.className = 'key';
    key.addEventListener('click', () => {
      if (finished || input.value.length + letter.length > 5) return;
      input.value += letter;
      input.removeAttribute('aria-invalid');
      refresh();
    });
    keys.set(letter, key);
    line.append(key);
  }
  if (row === 'ذ') {
    const erase = document.createElement('button');
    erase.type = 'button';
    erase.id = 'erase';
    erase.className = 'key';
    erase.textContent = '⌫';
    erase.setAttribute('aria-label', 'حذف حرف');
    erase.addEventListener('click', () => {
      if (finished || !input.value) return;
      input.value = input.value.slice(0, -1);
      input.removeAttribute('aria-invalid');
      refresh();
    });
    line.append(erase);
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
  byId('erase').setAttribute('aria-disabled', String(finished || !input.value));
  submit.setAttribute('aria-disabled', String(!dictionary || finished));
  byId('attempt').textContent = finished ? 'انتهت الجولة'
    : 'المحاولة ' + numbers.format(guesses.length + 1) + ' من ٦';
  reveal.setAttribute('aria-disabled', String(finished || revealedIndex >= 0));
  surrender.setAttribute('aria-disabled', String(finished));
  const category = byId('category');
  category.hidden = guesses.length < 2;
  category.textContent = category.hidden ? '' : answers[answerIndex][1];
}

function newRound() {
  const options = answers.length - Number(answerIndex >= 0);
  const next = Math.floor(Math.random() * options);
  answerIndex = answerIndex >= 0 && next >= answerIndex ? next + 1 : next;
  guesses = [];
  input.value = '';
  finished = false;
  revealedIndex = -1;
  byId('hint').hidden = true;
  byId('result').hidden = true;
  input.removeAttribute('aria-invalid');
  status.textContent = dictionary ? '' : 'جارٍ تحميل القاموس…';
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
    status.classList.remove('sr-only');
    status.textContent = message;
    input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  const [answer, category] = answers[answerIndex];
  const result = score(word, answer);
  guesses.push({ word, result });
  input.value = '';
  if (word === answer || guesses.length === 6) {
    finishRound(word === answer ? 'أحسنت! الكلمة هي' : 'انتهت المحاولات. الكلمة هي');
    return;
  }
  refresh();
  const detail = [...word].map((letter, col) => letter + ' ' + labels[result[col]]).join('، ');
  status.textContent = detail + (guesses.length === 2 ? '، فئة الكلمة ' + category + '.' : '.');
  status.classList.add('sr-only');
  input.focus();
});

function finishRound(label) {
  finished = true;
  input.value = '';
  input.removeAttribute('aria-invalid');
  const [answer] = answers[answerIndex];
  byId('result-label').textContent = label;
  byId('answer').textContent = answer;
  byId('result').hidden = false;
  status.textContent = label + ' «' + answer + '».';
  status.classList.add('sr-only');
  refresh();
  byId('reset').focus();
}

reveal.addEventListener('click', () => {
  if (finished || revealedIndex >= 0) return;
  const [answer] = answers[answerIndex];
  const unknown = [...answer].map((_, index) => index)
    .filter(index => !guesses.some(guess => guess.result[index] === 'exact'));
  const choices = unknown.length ? unknown : [...answer].map((_, index) => index);
  revealedIndex = choices[Math.floor(Math.random() * choices.length)];
  const clue = 'الخانة ' + numbers.format(revealedIndex + 1) + ' من اليمين: «' + answer[revealedIndex] + '»';
  byId('hint').textContent = clue;
  byId('hint').hidden = false;
  status.textContent = clue;
  status.classList.add('sr-only');
  refresh();
});

function ask(action, title, text, button) {
  confirm.returnValue = 'cancel';
  byId('confirm-title').textContent = title;
  byId('confirm-text').textContent = text;
  const confirmButton = byId('confirm-action');
  confirmButton.textContent = button;
  confirmButton.value = action;
  confirm.showModal();
}

byId('help').addEventListener('click', () => help.showModal());
surrender.addEventListener('click', () => {
  if (!finished) ask('surrender', 'الاستسلام؟', 'ستنتهي الجولة وتظهر الكلمة.', 'استسلمت');
});
byId('reset').addEventListener('click', () => {
  if (!finished && (guesses.length || input.value || revealedIndex >= 0)) {
    ask('restart', 'بدء جولة جديدة؟', 'ستُمسح تخمينات هذه الجولة.', 'ابدأ جولة جديدة');
    return;
  }
  newRound();
  input.focus();
});
confirm.addEventListener('close', () => {
  if (confirm.returnValue === 'surrender') finishRound('الكلمة هي');
  if (confirm.returnValue === 'restart') {
    newRound();
    input.focus();
  }
});

help.addEventListener('close', () => {
  try { sessionStorage.setItem('hazzer-rules-seen', '1'); } catch {}
  byId('help').focus();
});

function showIntro() {
  try {
    if (sessionStorage.getItem('hazzer-rules-seen')) return;
  } catch {}
  help.showModal();
}

async function loadDictionary() {
  const retry = byId('retry');
  if (retry) retry.remove();
  status.classList.remove('sr-only');
  status.textContent = 'جارٍ تحميل القاموس…';
  try {
    const response = await fetch('./dictionary.bin.gz');
    if (!response.ok || !response.body) throw new Error('Dictionary unavailable');
    const decoded = response.body.pipeThrough(new DecompressionStream('gzip'));
    const bytes = await new Response(decoded).arrayBuffer();
    if (bytes.byteLength !== Math.ceil(alphabet.length ** 5 / 8)) throw new Error('Invalid dictionary');
    dictionary = new Uint8Array(bytes);
    if (!finished && status.textContent === 'جارٍ تحميل القاموس…') status.textContent = '';
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

showIntro();
