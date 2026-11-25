import { answers } from './solutions.mjs?v=8';
import { alphabet, dictionaryHas, normalize, score, nextHint } from './engine.mjs?v=8';

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
const hintOptions = [...preferences.querySelectorAll('[name="hint-kind"]')];
const selectedHints = () => hintOptions.filter(option => option.checked).map(option => option.value);
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
let hasPlayed = false;
let helpPromptTimer;
const helpPromptDelay = 12000;

function promptForHelp() {
  clearTimeout(helpPromptTimer);
  reveal.classList.remove('help-nudge');
  if (hasPlayed || finished || reveal.getAttribute('aria-disabled') === 'true'
      || document.hidden || document.querySelector('dialog[open]')) return;
  helpPromptTimer = setTimeout(() => {
    if (!document.hidden && !document.querySelector('dialog[open]')) reveal.classList.add('help-nudge');
  }, helpPromptDelay);
}

function markPlayed() {
  if (hasPlayed) return;
  hasPlayed = true;
  promptForHelp();
}

const availableHint = () => nextHint(answers[answerIndex][0], guesses, hints, selectedHints());
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

  const revealed = new Set();
  const repeated = new Map();
  for (const hint of hints) {
    if (hint.kind === 'exclude') states.set(hint.letter, 'absent');
    if (hint.kind === 'letter' || hint.kind === 'position') revealed.add(hint.letter);
    if (hint.kind === 'repeat' && hint.letter) {
      revealed.add(hint.letter);
      repeated.set(hint.letter, hint.count);
    }
  }

  for (const [letter, key] of keys) {
    const outcome = states.get(letter);
    paint(key, letter, outcome);
    const isRevealed = revealed.has(letter);
    key.classList.toggle('revealed', isRevealed && outcome !== 'exact');
    const count = repeated.get(letter);
    if (count || (isRevealed && outcome !== 'exact')) {
      let mark = key.querySelector('.mark');
      if (!mark) {
        mark = document.createElement('span');
        mark.className = 'mark';
        mark.setAttribute('aria-hidden', 'true');
        key.append(mark);
      }
      mark.textContent = count ? '×' + numbers.format(count) : '•';
    }
    const state = outcome === 'exact' || (!isRevealed && outcome) ? labels[outcome]
      : isRevealed ? 'موجود في الحل' : '';
    const repetition = count ? 'يتكرر ' + numbers.format(count) + ' مرات' : '';
    key.setAttribute('aria-label', [letter, state, repetition].filter(Boolean).join('، '));
    key.setAttribute('aria-disabled', String(finished));
  }
  input.readOnly = finished || keyboardOnly.checked;
  input.inputMode = keyboardOnly.checked ? 'none' : 'text';
  byId('erase').setAttribute('aria-disabled', String(finished || !input.value));
  submit.setAttribute('aria-disabled', String(!dictionary || finished));
  byId('attempt').textContent = finished ? 'انتهت الجولة'
    : 'المحاولة ' + numbers.format(guesses.length + 1) + ' من ٦';
  reveal.setAttribute('aria-disabled', String(finished || !availableHint()));
  surrender.setAttribute('aria-disabled', String(finished));
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
  const [answer] = answers[answerIndex];
  const result = score(word, answer);
  guesses.push({ word, result });
  input.value = '';
  if (word === answer || guesses.length === 6) {
    finishRound(word === answer ? 'أحسنت! الكلمة هي' : 'انتهت المحاولات. الكلمة هي');
    return;
  }
  refresh();
  const detail = [...word].map((letter, col) => letter + ' ' + labels[result[col]]).join('، ');
  status.textContent = detail + '.';
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
  const hint = availableHint();
  if (!hint) return;
  hints.push(hint);

  const [, meaning, pattern] = answers[answerIndex];
  let message;
  switch (hint.kind) {
    case 'meaning':
      message = 'تلميح المعنى: ' + meaning;
      break;
    case 'pattern':
      message = 'الوزن الصرفي: ' + pattern;
      break;
    case 'letter':
      message = 'في الحل حرف «' + hint.letter + '».';
      break;
    case 'position':
      message = 'الخانة ' + numbers.format(hint.index + 1) + ' من اليمين فيها «' + hint.letter + '».';
      break;
    case 'repeat':
      message = hint.letter ? '«' + hint.letter + '» يتكرر '
        + (hint.count === 2 ? 'مرتين.' : numbers.format(hint.count) + ' مرات.')
        : 'حروف الحل كلها مختلفة.';
      break;
    case 'exclude':
      message = '«' + hint.letter + '» ليس ضمن الكلمة.';
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
  openDialog(confirm);
}

try { keyboardOnly.checked = localStorage.getItem('hazzer-game-keyboard-only') === '1'; } catch {}
keyboardOnly.addEventListener('change', () => {
  try { localStorage.setItem('hazzer-game-keyboard-only', keyboardOnly.checked ? '1' : '0'); } catch {}
  refresh();
});
try {
  const stored = JSON.parse(localStorage.getItem('hazzer-hint-kinds'));
  if (Array.isArray(stored)) {
    for (const option of hintOptions) option.checked = stored.includes(option.value);
  }
} catch {}
for (const option of hintOptions) {
  option.addEventListener('change', () => {
    try { localStorage.setItem('hazzer-hint-kinds', JSON.stringify(selectedHints())); } catch {}
    refresh();
  });
}

function openDialog(dialog) {
  dialog.showModal();
  promptForHelp();
}

document.querySelector('.arena').addEventListener('click', markPlayed);
document.querySelector('.arena').addEventListener('input', markPlayed);
document.querySelector('.arena').addEventListener('keydown', event => {
  if (event.key !== 'Tab' && event.key !== 'Shift') markPlayed();
});
document.addEventListener('visibilitychange', promptForHelp);
for (const dialog of [help, preferences, confirm]) dialog.addEventListener('close', promptForHelp);
byId('settings').addEventListener('click', () => openDialog(preferences));

byId('help').addEventListener('click', () => openDialog(help));
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
promptForHelp();
