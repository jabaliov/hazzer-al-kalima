import { answers } from './solutions.mjs?v=6';
import { alphabet, dictionaryHas, normalize, score, nextHint } from './engine.mjs?v=6';

const byId = id => document.getElementById(id);
const input = byId('guess');
const status = byId('status');
const submit = byId('submit');
const reveal = byId('reveal');
const surrender = byId('surrender');
const help = byId('rules');
const confirm = byId('confirm');
const preferences = byId('preferences');
const keyboardOnly = byId('game-keyboard-only');
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
let hints = [];
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
    erase.textContent = '⌫ حذف حرف';
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

  for (const hint of hints) {
    if (hint.kind === 'exclude') {
      for (const letter of hint.letters) states.set(letter, 'absent');
    }
  }

  for (const [letter, key] of keys) {
    const outcome = states.get(letter);
    paint(key, letter, outcome);
    key.setAttribute('aria-label', outcome ? letter + '، ' + labels[outcome] : letter);
    key.setAttribute('aria-disabled', String(finished));
  }
  input.readOnly = finished || keyboardOnly.checked;
  input.inputMode = keyboardOnly.checked ? 'none' : 'text';
  byId('erase').setAttribute('aria-disabled', String(finished || !input.value));
  submit.setAttribute('aria-disabled', String(!dictionary || finished));
  byId('attempt').textContent = finished ? 'انتهت الجولة'
    : 'المحاولة ' + numbers.format(guesses.length + 1) + ' من ٦';
  reveal.setAttribute('aria-disabled', String(finished || !nextHint(answers[answerIndex][0], guesses, hints)));
  surrender.setAttribute('aria-disabled', String(finished));
  const category = byId('category');
  category.hidden = guesses.length < 2;
  category.textContent = category.hidden ? '' : 'تلميح المعنى: ' + answers[answerIndex][1];
}

function newRound() {
  const options = answers.length - Number(answerIndex >= 0);
  const next = Math.floor(Math.random() * options);
  answerIndex = answerIndex >= 0 && next >= answerIndex ? next + 1 : next;
  guesses = [];
  input.value = '';
  finished = false;
  hints = [];
  byId('hint').hidden = true;
  byId('result').hidden = true;
  byId('reset').hidden = false;
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
    if (!keyboardOnly.checked) input.focus();
    return;
  }
  input.removeAttribute('aria-invalid');
  const [answer, meaning] = answers[answerIndex];
  const result = score(word, answer);
  guesses.push({ word, result });
  input.value = '';
  if (word === answer || guesses.length === 6) {
    finishRound(word === answer ? 'أحسنت! الكلمة هي' : 'انتهت المحاولات. الكلمة هي');
    return;
  }
  refresh();
  const detail = [...word].map((letter, col) => letter + ' ' + labels[result[col]]).join('، ');
  status.textContent = detail + (guesses.length === 2 ? '، تلميح المعنى: ' + meaning + '.' : '.');
  status.classList.add('sr-only');
  if (!keyboardOnly.checked) input.focus();
});

function finishRound(label) {
  finished = true;
  input.value = '';
  input.removeAttribute('aria-invalid');
  const [answer] = answers[answerIndex];
  byId('result-label').textContent = label;
  byId('answer').textContent = answer;
  byId('result').hidden = false;
  byId('reset').hidden = true;
  status.textContent = label + ' «' + answer + '».';
  status.classList.add('sr-only');
  refresh();
  byId('next-round').focus();
}

reveal.addEventListener('click', () => {
  if (finished) return;
  const hint = nextHint(answers[answerIndex][0], guesses, hints);
  if (!hint) return;
  hints.push(hint);

  let message;
  switch (hint.kind) {
    case 'letter':
      message = 'في الحل حرف «' + hint.letter + '».';
      break;
    case 'position':
      message = 'الخانة ' + numbers.format(hint.index + 1) + ' من اليمين فيها «' + hint.letter + '».';
      break;
    case 'repeat':
      message = hint.repeats ? 'يوجد حرف مكرر في الحل.' : 'حروف الحل كلها مختلفة.';
      break;
    case 'exclude':
      message = 'خارج الحل: ' + hint.letters.map(letter => '«' + letter + '»').join(' و') + '.';
      break;
  }
  byId('hint').textContent = message;
  byId('hint').hidden = false;
  status.textContent = message;
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

try { keyboardOnly.checked = localStorage.getItem('hazzer-game-keyboard-only') === '1'; } catch {}
keyboardOnly.addEventListener('change', () => {
  try { localStorage.setItem('hazzer-game-keyboard-only', keyboardOnly.checked ? '1' : '0'); } catch {}
  refresh();
});
byId('settings').addEventListener('click', () => preferences.showModal());

byId('help').addEventListener('click', () => help.showModal());
surrender.addEventListener('click', () => {
  if (!finished) ask('surrender', 'الاستسلام؟', 'ستنتهي الجولة وتظهر الكلمة.', 'استسلمت');
});
byId('next-round').addEventListener('click', () => {
  newRound();
  status.textContent = 'بدأت الجولة الجديدة.';
  status.classList.add('sr-only');
  if (keyboardOnly.checked) keys.get('ذ').focus();
  else input.focus();
});
byId('reset').addEventListener('click', () => {
  if (!finished && (guesses.length || input.value || hints.length)) {
    ask('restart', 'بدء جولة جديدة؟', 'ستُمسح تخمينات هذه الجولة.', 'ابدأ جولة جديدة');
    return;
  }
  newRound();
  if (!keyboardOnly.checked) input.focus();
});
confirm.addEventListener('close', () => {
  if (confirm.returnValue === 'surrender') finishRound('الكلمة هي');
  if (confirm.returnValue === 'restart') {
    newRound();
    if (!keyboardOnly.checked) input.focus();
  }
});

help.addEventListener('close', () => {
  try { sessionStorage.setItem('hazzer-rules-seen', '1'); } catch {}
  help.querySelector('button').textContent = 'إغلاق';
  byId('help').focus();
});

function showIntro() {
  try {
    if (sessionStorage.getItem('hazzer-rules-seen')) {
      help.querySelector('button').textContent = 'إغلاق';
      return;
    }
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
