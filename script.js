const STORAGE_KEY = 'daylight-journal-v2';
const SETTINGS_KEY = 'daylight-preferences-v1';
const DEFAULT_CATEGORIES = ['Work', 'Study', 'Family', 'Relationships', 'Health', 'Personal growth', 'Everyday life'];
const DEFAULT_SETTINGS = {
  moodLabels: { Low: 'Low', Tender: 'Tender', Steady: 'Steady', Good: 'Good', Bright: 'Bright' },
  categories: DEFAULT_CATEGORIES,
  prompts: {
    bright: 'What small win, effort, or accomplishment would you like to add to your tree?',
    thanks: 'Who or what are you grateful for in this moment?',
    hard: 'What is weighing on you, and what has it been like for you?'
  }
};
const MOODS = {
  Low: { face: '🥺', className: 'mood-low', message: 'You don’t have to make this feeling smaller to be welcome here.' },
  Tender: { face: '🥹', className: 'mood-tender', message: 'A tender day can be met with a tender pace.' },
  Steady: { face: '😌', className: 'mood-steady', message: 'Steady is a real place to be. Thanks for noticing.' },
  Good: { face: '😊', className: 'mood-good', message: 'Let yourself take in a little of the good.' },
  Bright: { face: '😄', className: 'mood-bright', message: 'There’s room to enjoy this bright moment.' }
};
const KIND = {
  bright: { title: 'Bright Finds', eyebrow: 'A FRUIT FOR YOUR TREE', prompt: DEFAULT_SETTINGS.prompts.bright, placeholder: 'A little win counts, even if it felt ordinary at the time.' },
  thanks: { title: 'Thank-you Notes', eyebrow: 'A STAR FOR SOMETHING YOU TREASURE', prompt: DEFAULT_SETTINGS.prompts.thanks, placeholder: 'A person, a small kindness, a place, or a moment…' },
  hard: { title: 'The Unburdening', eyebrow: 'A FEELING TO SET DOWN BY THE WATER', prompt: DEFAULT_SETTINGS.prompts.hard, placeholder: 'You can write the messy version. You don’t need to solve it yet.' }
};

let settings = loadSettings();
let data = { entries: [], moods: {} };
let encryptionKey = null;
let encryptionSalt = null;
let activeKind = 'bright';
let editingEntryId = null;
let activeConversationEntryId = null;
let view = 'month';
let cursorDate = new Date();
let selectedDate = dateKey(new Date());

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
    return {
      moodLabels: { ...DEFAULT_SETTINGS.moodLabels, ...(saved?.moodLabels || {}) },
      categories: Array.isArray(saved?.categories) && saved.categories.length ? saved.categories : [...DEFAULT_CATEGORIES],
      prompts: { ...DEFAULT_SETTINGS.prompts, ...(saved?.prompts || {}) }
    };
  } catch { return JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); }
}
function moodName(key) { return settings.moodLabels[key] || key; }
function renderCategoryOptions(selected = '') {
  const select = document.getElementById('entry-category');
  select.innerHTML = '<option value="">Choose one</option>' + settings.categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join('') + '<option value="__other">Other — write it in</option>';
  const custom = document.getElementById('entry-category-custom');
  if (selected && selected !== '__other' && !settings.categories.includes(selected)) { select.value = '__other'; custom.value = selected; custom.hidden = false; }
  else { select.value = selected; custom.value = ''; custom.hidden = true; }
}
function selectedCategory() { return document.getElementById('entry-category').value === '__other' ? document.getElementById('entry-category-custom').value.trim() : document.getElementById('entry-category').value; }
function applySettings() {
  document.querySelectorAll('.mood-choice').forEach(button => {
    const key = button.dataset.mood;
    button.querySelector('small').textContent = moodName(key);
    button.setAttribute('aria-label', `${moodName(key)} mood`);
  });
  renderCategoryOptions(document.getElementById('entry-category').value);
  document.getElementById('mood-labels-setting').value = Object.keys(MOODS).map(key => moodName(key)).join(', ');
  document.getElementById('categories-setting').value = settings.categories.join(', ');
  document.getElementById('prompt-bright-setting').value = settings.prompts.bright;
  document.getElementById('prompt-thanks-setting').value = settings.prompts.thanks;
  document.getElementById('prompt-hard-setting').value = settings.prompts.hard;
  document.querySelectorAll('.calendar-legend > span').forEach((item, index) => {
    if (index < 5) item.lastChild.textContent = moodName(Object.keys(MOODS)[index]);
  });
}
function bytesToBase64(bytes) { return btoa(String.fromCharCode(...new Uint8Array(bytes))); }
function base64ToBytes(text) { return Uint8Array.from(atob(text), char => char.charCodeAt(0)); }
async function deriveEncryptionKey(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 250000, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function persist() {
  const json = JSON.stringify(data);
  try {
    if (encryptionKey) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, new TextEncoder().encode(json));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, encrypted: true, salt: bytesToBase64(encryptionSalt), iv: bytesToBase64(iv), data: bytesToBase64(encrypted) }));
    } else localStorage.setItem(STORAGE_KEY, json);
    return true;
  } catch {
    announce('Your browser could not save this entry. You can export a copy before leaving the page.');
    return false;
  }
}
async function unlockJournal(passphrase) {
  const record = JSON.parse(localStorage.getItem(STORAGE_KEY));
  const salt = base64ToBytes(record.salt);
  const key = await deriveEncryptionKey(passphrase, salt);
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(record.iv) }, key, base64ToBytes(record.data));
  const decoded = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(decoded.entries) || !decoded.moods) throw new Error('This journal file is not valid.');
  data = decoded;
  encryptionKey = key;
  encryptionSalt = salt;
  document.getElementById('lock-overlay').hidden = true;
  document.getElementById('encrypted-controls').hidden = false;
  document.getElementById('unlock-passphrase').value = '';
  renderAll();
}
async function initializeJournal() {
  let saved;
  try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { saved = null; }
  if (saved?.encrypted) {
    document.getElementById('lock-overlay').hidden = false;
    document.getElementById('unlock-passphrase').focus();
    return;
  }
  if (saved && Array.isArray(saved.entries) && saved.moods) data = saved;
  applySettings();
  renderAll();
}
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function fromDateKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}
function localToday() { return dateKey(new Date()); }
function formatDate(key, options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) {
  return new Intl.DateTimeFormat('en', options).format(fromDateKey(key));
}
function escapeHTML(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}
function announce(message) {
  const node = document.getElementById('mood-message');
  if (node) node.textContent = message;
}
function entriesFor(date = selectedDate) { return data.entries.filter(entry => entry.date === date); }
function getMoodFace(key) { return data.moods[key] ? MOODS[data.moods[key]].face : ''; }

async function setMood(mood) {
  data.moods[selectedDate] = mood;
  await persist();
  document.querySelectorAll('.mood-choice').forEach(button => {
    const isSelected = button.dataset.mood === mood;
    button.classList.toggle('selected', isSelected);
    button.setAttribute('aria-pressed', String(isSelected));
  });
  announce(MOODS[mood].message);
  renderCalendar();
  renderAll();
}

function openComposer(kind) {
  activeKind = kind;
  editingEntryId = null;
  const descriptor = KIND[kind];
  const composer = document.getElementById('entry-composer');
  document.getElementById('composer-eyebrow').textContent = descriptor.eyebrow;
  document.getElementById('composer-title').textContent = descriptor.title;
  document.getElementById('entry-prompt').textContent = settings.prompts[kind] || descriptor.prompt;
  document.getElementById('entry-text').placeholder = descriptor.placeholder;
  document.getElementById('entry-text').value = '';
  document.getElementById('entry-date').value = selectedDate;
  renderCategoryOptions();
  document.getElementById('entry-category').value = '';
  document.getElementById('entry-category-custom').value = '';
  document.getElementById('entry-category-custom').hidden = true;
  document.getElementById('entry-goal').value = '';
  document.getElementById('ask-live-ai').checked = false;
  document.getElementById('intensity-row').hidden = kind !== 'hard';
  document.getElementById('entry-intensity').value = '5';
  document.getElementById('intensity-value').textContent = '5 / 10';
  document.getElementById('save-entry-button').innerHTML = 'Save this moment <span>✦</span>';
  composer.hidden = false;
  composer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.setTimeout(() => document.getElementById('entry-text').focus(), 250);
}

function guessThinkingPattern(text) {
  const phrase = text.toLowerCase();
  if (/\b(always|never|everyone|nobody|no one|every time|nothing ever)\b/.test(phrase)) return 'Could this be overgeneralizing from one hard moment?';
  if (/\b(disaster|ruined everything|worst thing|catastrophe|unbearable)\b/.test(phrase)) return 'I wonder if the outcome is feeling magnified right now.';
  if (/\b(they think|she thinks|he thinks|everyone thinks|they must think)\b/.test(phrase)) return 'Might your mind be trying to guess what someone else thinks?';
  if (/\b(i am|i'm|im) (a )?(failure|useless|stupid|pathetic|hopeless|lazy)\b/.test(phrase)) return 'That sounds like a painful label for yourself. One moment can’t describe all of who you are.';
  if (/\b(will fail|will never|it's definitely|it is definitely|certainly going to|bound to fail)\b/.test(phrase)) return 'Is this a prediction, or something you know for certain?';
  if (/\b(only|just) (the )?(bad|mistake|failure|negative)\b/.test(phrase)) return 'Could the difficult part be taking up the whole picture at the moment?';
  return '';
}

function companionReflection(entry) {
  const text = entry.text;
  const lowered = text.toLowerCase();
  const category = entry.category ? escapeHTML(entry.category.toLowerCase()) : '';
  const goal = entry.goal ? escapeHTML(entry.goal) : '';
  if (entry.kind === 'bright') {
    let strength = 'You gave this moment your effort and attention. That is worth recognizing.';
    let next = 'If you want to build on it, write down one thing you would like to repeat or learn from this experience.';
    if (/\b(job|offer|hired|interview|position|work)\b/.test(lowered)) {
      strength = 'Receiving an offer is evidence that the people you met saw a reason to choose you. You earned the chance to take this next step; it counts whether or not you know how common it is.';
      next = 'A gentle next step: note what helped you feel prepared, then ask about the first priorities, training, and who you can go to with questions.';
    } else if (/\b(finish|finished|complete|completed|submit|submitted|deadline)\b/.test(lowered)) {
      strength = 'You followed through on something that mattered. Finishing it is concrete evidence of your persistence.';
      next = 'Take a moment to notice what helped you finish, and give yourself a little recovery time before choosing the next task.';
    } else if (/\b(ask|asked|speak|spoke|tell|told|boundary|help)\b/.test(lowered)) {
      strength = 'You took a step to communicate what you needed. That kind of self-advocacy can take courage.';
      next = 'If it feels useful, jot down how the conversation went and what you want to carry into the next one.';
    }
    const goalLine = goal ? `You’re working toward “${goal}.”` : 'You can choose a direction that matters to you.';
    return `<div class="companion-content"><p>${strength}</p><p>One thing this moment shows is that you are taking part in your own growth${category ? ` around ${category}` : ''}. ${goalLine}</p><p class="next-step"><b>A next step:</b> ${next}</p></div>`;
  }
  if (entry.kind === 'thanks') {
    let response = 'Taking a moment to name what you appreciate can help keep this person, detail, or kindness in view. You can be grateful for something while still having difficult feelings elsewhere.';
    let next = 'If you would like, you could tell the person what their kindness meant to you, or simply keep this note for yourself.';
    if (/\b(friend|mom|mother|dad|father|partner|sister|brother|teacher|mentor|they|she|he)\b/.test(lowered)) {
      response = 'It sounds like this relationship or gesture matters to you. Naming the specific thing you value keeps the gratitude personal, not just a vague “I should be thankful.”';
      next = 'A small next step could be sending a thank-you message, when and if that feels right.';
    }
    return `<div class="companion-content"><p>${response}</p><p class="next-step"><b>If you’d like:</b> ${next}</p></div>`;
  }
  const pattern = guessThinkingPattern(text);
  const feeling = Number(entry.intensity) >= 8 ? 'This sounds especially intense to carry right now.' : 'It makes sense to give this some room instead of rushing past it.';
  const patternHtml = pattern ? `<span class="thinking-pattern">A possibility to check: ${escapeHTML(pattern)}</span>` : '';
  const goalLine = goal ? ` You mentioned “${goal}”; we can keep that in mind when choosing a next step.` : '';
  let shortTerm = 'For right now, try placing both feet on the floor and letting your exhale grow a little longer. If it feels okay, step outside for a gentle five-minute walk or reach out to someone you trust.';
  let longTerm = 'When you have a little more space, write down what you know happened, what you are afraid it means, and one piece you can influence. Choose one doable action or one person to ask for help.';
  if (/\b(work|job|boss|manager|interview|coworker|colleague|shift)\b/.test(lowered)) {
    shortTerm = 'For the next few minutes, step away from the work screen if you can. Take a slow breath or a short walk, then give yourself permission to pause before deciding what this means.';
    longTerm = 'When you feel ready, separate the event from the story you’re telling about it. Identify one work-related question you still need answered; you could ask a manager or trusted colleague for a clear expectation or specific feedback.';
  } else if (/\b(study|class|exam|grade|school|assignment|homework|professor|teacher)\b/.test(lowered)) {
    shortTerm = 'Give your mind a brief reset: get a glass of water, stretch, or take a short walk if that feels comfortable. You can return to the problem after a pause.';
    longTerm = 'Next, identify the exact part of studying or school that felt difficult. Break it into one small task, then consider asking a teacher, classmate, or campus support service for help with that part.';
  } else if (/\b(family|mother|mom|father|dad|partner|friend|relationship|argument|fight|texted|ignored)\b/.test(lowered)) {
    shortTerm = 'For right now, let the conversation rest if you can. Try a few slow breaths, a comforting activity, or checking in with someone who helps you feel grounded.';
    longTerm = 'When things feel calmer, decide what you want from the relationship moment: to be heard, to set a boundary, or to understand what happened. You might plan one clear sentence about that need.';
  }
  const patternSection = pattern ? `<p class="pattern-question">A possible thinking pattern to explore (only if it fits): ${escapeHTML(pattern)}</p>` : '';
  return `<div class="companion-content"><p>${feeling} What happened matters, and it does not have to define your worth.${category ? ` I hear that it connects to your ${category} life.` : ''}${goalLine}</p>${patternSection}<p class="care-step"><b>For right now</b>${shortTerm}</p><p class="next-step"><b>For a next step</b>${longTerm}</p></div>`;
}

function localReflectionText(entry) {
  const container = document.createElement('div');
  container.innerHTML = companionReflection(entry);
  return Array.from(container.children).map(node => node.textContent.trim()).filter(Boolean).join('\n\n');
}

function renderConversation(entry) {
  const panel = document.getElementById('conversation-panel');
  if (!entry?.conversation?.length) { panel.hidden = true; activeConversationEntryId = null; return; }
  activeConversationEntryId = entry.id;
  panel.hidden = false;
  document.getElementById('conversation-title').textContent = `${KIND[entry.kind].title} · ${formatDate(entry.date, { month: 'long', day: 'numeric', year: 'numeric' })}`;
  const messages = document.getElementById('conversation-messages');
  messages.innerHTML = entry.conversation.map(item => `<article class="chat-message ${item.role === 'user' ? 'from-user' : 'from-companion'}"><span>${item.role === 'user' ? 'You' : 'Daylight companion'}${item.source === 'live' ? ' · OpenAI' : item.role === 'assistant' ? ' · local demo' : ''}</span><p>${escapeHTML(item.text).replace(/\n/g, '<br>')}</p></article>`).join('');
  document.getElementById('conversation-mode').textContent = 'Your conversation stays in this journal';
}

async function requestLiveReflection(entry, message = '') {
  const response = await fetch('/api/companion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ consent: true, kind: entry.kind, text: entry.text, category: entry.category, goal: entry.goal, intensity: entry.currentIntensity ?? entry.intensity, history: message ? (entry.conversation || []).slice(0, -1) : (entry.conversation || []), message })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `AI request failed (${response.status}).`);
  if (!payload.text) throw new Error('The AI service returned an empty response.');
  return payload.text;
}

function editEntry(entry) {
  openComposer(entry.kind);
  editingEntryId = entry.id;
  document.getElementById('composer-title').textContent = `Edit ${KIND[entry.kind].title}`;
  document.getElementById('entry-text').value = entry.text;
  document.getElementById('entry-date').value = entry.date;
  renderCategoryOptions(entry.category || '');
  document.getElementById('entry-goal').value = entry.goal || '';
  document.getElementById('entry-intensity').value = String(entry.currentIntensity ?? entry.intensity ?? 5);
  document.getElementById('intensity-value').textContent = `${document.getElementById('entry-intensity').value} / 10`;
  document.getElementById('ask-companion').checked = false;
  document.getElementById('save-entry-button').innerHTML = 'Save changes <span>✦</span>';
}

function localFollowupText(entry, question) {
  const snippet = question.length > 180 ? `${question.slice(0, 177)}…` : question;
  const pattern = entry.kind === 'hard' ? guessThinkingPattern(`${entry.text} ${question}`) : '';
  return `Thank you for staying with this. I hear that you’re wondering about: “${snippet}”\n\n${pattern ? `One possibility to gently check—not a conclusion—is: ${pattern} ` : ''}What feels like the smallest next step that would be kind to yourself and useful for what matters to you?`;
}

async function sendFollowup(event) {
  event.preventDefault();
  const entry = data.entries.find(item => item.id === activeConversationEntryId);
  const input = document.getElementById('followup-input');
  const question = input.value.trim();
  const useLocal = document.getElementById('followup-local').checked;
  const useLive = document.getElementById('followup-live-consent').checked;
  if (!entry || !question || (!useLocal && !useLive)) { announce('Choose a local reply or explicitly consent to a live AI reply.'); return; }
  const button = document.getElementById('followup-send');
  button.disabled = true; button.textContent = useLive ? 'Asking OpenAI…' : 'Thinking…';
  entry.conversation ||= [];
  entry.conversation.push({ role: 'user', text: question });
  input.value = '';
  let answer; let source = 'local';
  if (useLive) {
    try { answer = await requestLiveReflection(entry, question); source = 'live'; }
    catch (error) {
      announce(`Live AI is unavailable: ${error.message}`);
      if (useLocal) answer = localFollowupText(entry, question);
    }
  } else answer = localFollowupText(entry, question);
  if (answer) entry.conversation.push({ role: 'assistant', text: answer, source });
  await persist();
  renderConversation(entry);
  document.getElementById('followup-live-consent').checked = false;
  button.disabled = false; button.innerHTML = 'Send follow-up <span>↗</span>';
  document.getElementById('conversation-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function saveEntry(event) {
  event.preventDefault();
  const text = document.getElementById('entry-text').value.trim();
  if (!text) return;
  const now = new Date();
  let entry = editingEntryId ? data.entries.find(item => item.id === editingEntryId) : null;
  if (entry) {
    entry.text = text;
    entry.category = selectedCategory();
    entry.goal = document.getElementById('entry-goal').value.trim();
    entry.date = document.getElementById('entry-date').value || selectedDate;
    if (entry.kind === 'hard') entry.currentIntensity = Number(document.getElementById('entry-intensity').value);
  } else {
    entry = {
      id: globalThis.crypto?.randomUUID?.() || `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
      kind: activeKind,
      text,
      category: selectedCategory(),
      goal: document.getElementById('entry-goal').value.trim(),
      date: document.getElementById('entry-date').value || selectedDate,
      createdAt: now.toISOString(),
      intensity: activeKind === 'hard' ? Number(document.getElementById('entry-intensity').value) : null,
      currentIntensity: activeKind === 'hard' ? Number(document.getElementById('entry-intensity').value) : null,
      lighterCount: 0,
      resolved: false,
      conversation: []
    };
    data.entries.unshift(entry);
  }
  const askLocal = document.getElementById('ask-companion').checked;
  const askLive = document.getElementById('ask-live-ai').checked;
  document.getElementById('save-entry-button').disabled = true;
  document.getElementById('save-entry-button').textContent = askLive ? 'Saving & asking OpenAI…' : 'Saving…';
  await persist();
  selectedDate = entry.date;
  document.getElementById('entry-composer').hidden = true;
  renderAll();
  let shouldShowConversation = false;
  if (askLive) {
    try {
      const reflection = await requestLiveReflection(entry);
      entry.conversation ||= [];
      entry.conversation.push({ role: 'assistant', text: reflection, source: 'live' });
      shouldShowConversation = true;
    }
    catch (error) {
      if (askLocal) { entry.conversation ||= []; entry.conversation.push({ role: 'assistant', text: localReflectionText(entry), source: 'local' }); shouldShowConversation = true; }
      announce(`Your note was saved. ${error.message}`);
    }
  } else if (askLocal) { entry.conversation ||= []; entry.conversation.push({ role: 'assistant', text: localReflectionText(entry), source: 'local' }); shouldShowConversation = true; }
  else {
    renderConversation(null);
    announce('Saved. Your moment is here whenever you want to revisit it.');
  }
  await persist();
  if (shouldShowConversation) renderConversation(entry);
  else renderConversation(entry.conversation?.length ? entry : null);
  document.getElementById('save-entry-button').disabled = false;
  renderAll();
  if (shouldShowConversation) document.getElementById('conversation-panel').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  editingEntryId = null;
  document.getElementById('jar-hotspot').classList.remove('pulled-out', 'bottle-open');
}

const FRUIT_POSITIONS = [
  [41, 61], [57, 53], [72, 61], [32, 72], [49, 76], [67, 74], [83, 75], [43, 42],
  [62, 40], [26, 58], [78, 48], [53, 63], [35, 48], [70, 54], [58, 83], [20, 68],
  [88, 64], [46, 33], [73, 34], [31, 82], [63, 69], [24, 43], [84, 84], [51, 52]
];
function entryDateLabel(entry) {
  const date = fromDateKey(entry.date);
  return new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}
function entryStoryNumber(entry, kind) {
  const dayEntries = data.entries.filter(item => item.kind === kind && item.date === entry.date).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  return dayEntries.findIndex(item => item.id === entry.id) + 1;
}
function entryMarkerLabel(entry, kind, index) {
  const names = { bright: 'Bright Find', hard: 'Unburdening story', thanks: 'Gratitude note' };
  if (kind === 'hard') {
    const shortDate = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(fromDateKey(entry.date));
    const summary = String(entry.text || '').replace(/\s+/g, ' ').trim();
    const excerpt = summary.length > 64 ? `${summary.slice(0, 61).trimEnd()}…` : summary;
    return `${shortDate} · ${excerpt || `${names[kind]} ${index}`}`;
  }
  return `${names[kind]} ${index} · ${entryDateLabel(entry)}`;
}
function openEntryDetail(entryId) {
  const entry = data.entries.find(item => item.id === entryId);
  if (!entry) return;
  selectedDate = entry.date;
  cursorDate = fromDateKey(entry.date);
  activeConversationEntryId = entry.conversation?.length ? entry.id : null;
  renderAll();
  const card = [...document.querySelectorAll('[data-review-entry]')].find(node => node.dataset.reviewEntry === entry.id);
  card?.classList.add('scene-entry-selected');
  requestAnimationFrame(() => {
    card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}
function installSceneTooltips() {
  document.querySelectorAll('#tree-fruits [data-entry-id],#pool-mementos [data-entry-id],#bottle-stars [data-entry-id]').forEach(marker => {
    const reveal = () => {
      const landscape = document.getElementById('landscape');
      let tooltip = landscape.querySelector('.story-tooltip');
      if (!tooltip) { tooltip = document.createElement('div'); tooltip.className = 'story-tooltip'; tooltip.id = 'story-tooltip'; tooltip.setAttribute('role', 'tooltip'); landscape.appendChild(tooltip); }
      tooltip.textContent = marker.dataset.tooltip || marker.getAttribute('aria-label')?.replace(/^Review /, '') || 'Saved journal entry';
      marker.setAttribute('aria-describedby', tooltip.id);
      const scene = landscape.getBoundingClientRect();
      const box = marker.getBoundingClientRect();
      const x = Math.max(92, Math.min(scene.width - 92, box.left + box.width / 2 - scene.left));
      const top = box.top - scene.top < 48 ? box.bottom - scene.top + 10 : box.top - scene.top - 10;
      tooltip.style.left = `${x}px`;
      tooltip.style.top = `${Math.max(8, Math.min(scene.height - 44, top))}px`;
      tooltip.classList.add('visible');
    };
    const hide = () => document.getElementById('story-tooltip')?.classList.remove('visible');
    marker.addEventListener('pointerenter', reveal);
    marker.addEventListener('pointerleave', hide);
    marker.addEventListener('focus', reveal);
    marker.addEventListener('blur', hide);
  });
}
function renderLandscape() {
  const brightEntries = data.entries.filter(entry => entry.kind === 'bright');
  const brightCount = brightEntries.length;
  const hardEntries = data.entries.filter(entry => entry.kind === 'hard');
  const gratitudeCount = data.entries.filter(entry => entry.kind === 'thanks').length;
  document.getElementById('tree-total').textContent = `${brightCount} ${brightCount === 1 ? 'fruit' : 'fruits'}`;
  document.getElementById('pool-total').textContent = `${hardEntries.length} ${hardEntries.length === 1 ? 'story' : 'stories'} in the tidepool`;
  document.getElementById('jar-total').textContent = `${gratitudeCount} gratitude ${gratitudeCount === 1 ? 'star' : 'stars'}`;
  document.getElementById('tree-scene-count').textContent = `${brightCount} ${brightCount === 1 ? 'win' : 'wins'} grown`;
  document.getElementById('pool-scene-count').textContent = `${hardEntries.length} hard ${hardEntries.length === 1 ? 'moment' : 'moments'} held`;
  const tree = document.querySelector('.tree-art');
  tree.dataset.growth = brightCount > 11 ? 'lush' : brightCount > 5 ? 'leafy' : brightCount > 0 ? 'growing' : 'resting';
  const fruits = document.getElementById('tree-fruits');
  fruits.innerHTML = brightEntries.map((entry, index) => {
    const fallback = [16 + ((index * 37) % 73), 30 + ((index * 23) % 55)];
    const [sourceX, sourceY] = FRUIT_POSITIONS[index] || fallback;
    // Keep entry fruit inside the painted canopy on both landscape crops.
    const x = Math.max(10, Math.min(36, 6 + sourceX * 0.34));
    // Keep fruit comfortably below the headline and within the lower canopy.
    const y = 19 + sourceY * 0.27;
    const shades = ['#d77855', '#e3a450', '#ce7256', '#d98e55'];
    const number = entryStoryNumber(entry, 'bright');
    const label = entryMarkerLabel(entry, 'bright', number);
    const gradientId = `fruit-glaze-${index}`;
    return `<button type="button" class="fruit" data-entry-id="${escapeHTML(entry.id)}" data-tooltip="${escapeHTML(label)}" style="left:${x}%;top:${y}%;--fruit-delay:0s" aria-label="Review ${escapeHTML(label)}"><svg viewBox="0 0 32 38" aria-hidden="true" focusable="false"><defs><linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffb477"/><stop offset=".44" stop-color="${shades[index % shades.length]}"/><stop offset="1" stop-color="#ad4e47"/></linearGradient></defs><path class="fruit-skin" d="M16 12.8C11.3 7.1 3.3 10.5 3.9 19.1c.6 9.1 5.6 15.2 11.1 14.4 1.1-.2 1.8-.7 2.7-.7s1.7.5 2.8.7c5.5.8 10.3-5.3 10.7-14.4.4-8.4-7.3-12-12.2-6.5-.8.8-1.6.9-3 .2Z" fill="url(#${gradientId})"/><path class="fruit-glint" d="M7.6 17.2c.4-3.3 2.3-5 4.4-4.6"/><path class="fruit-stem" d="M16.2 12.7c-.1-2.6.6-4.5 2.1-6"/><path class="fruit-leaf" d="M17.3 8.5c2.5-4.2 6.7-4.8 9.3-3.1-1.3 3.8-4.7 5.4-9.3 3.1Z"/></svg></button>`;
  }).join('');
  const tokens = document.getElementById('pool-mementos');
  const pool = document.querySelector('.pool-art');
  pool.style.setProperty('--wave-count', hardEntries.length);
  const waveSpacing = Math.min(4, 20 / Math.max(1, hardEntries.length - 1));
  const shiftByStory = (intensity, index) => Math.max(-12, Math.min(20, intensity * 2.2 + index * 2));
  const waveEntriesMarkup = hardEntries.map((entry, index) => {
    const intensity = Math.max(1, Math.min(10, Number(entry.currentIntensity ?? entry.intensity ?? 5)));
    const number = entryStoryNumber(entry, 'hard');
    const label = entryMarkerLabel(entry, 'hard', number);
    const opacity = entry.resolved ? 0.18 : Math.min(0.9, 0.34 + intensity * 0.055);
    const shoreReach = shiftByStory(intensity, index);
    const crestCoords = Array.from({ length: 49 }, (_, point) => {
      const t = point / 48;
      // Long surf bands span the full painted coast and bend like a shoreline,
      // rather than forming short isolated ripples over the sea.
      const x = (190 - shoreReach * 2.2 + t * 835).toFixed(1);
      const y = (28 + t * 100 + index * waveSpacing + Math.max(0, intensity - 1) * 0.5 + Math.sin(t * Math.PI * 2 + index * 0.53) * 3.5 + Math.sin(t * Math.PI) * (8 + intensity * 0.18) + Math.sin(t * Math.PI * 5 + index) * 1).toFixed(1);
      return { x, y };
    });
    const crestPoints = crestCoords.map(({ x, y }, point) => `${point ? 'L' : 'M'}${x} ${y}`).join(' ');
    const trailingPoints = crestCoords.slice().reverse().map(({ x, y }) => `L${x} ${(Number(y) + 24 + intensity * 0.35).toFixed(1)}`).join(' ');
    const bodyPath = `${crestPoints} ${trailingPoints} Z`;
    const delay = (index % 6) * -0.9;
    return `<g class="wave-memory${entry.resolved ? ' memory-settled' : ''}" data-entry-id="${escapeHTML(entry.id)}" data-tooltip="${escapeHTML(label)}" role="button" tabindex="0" aria-label="Review ${escapeHTML(label)} · intensity ${intensity} out of 10" style="--wave-opacity:${opacity};--wave-delay:${delay}s"><path class="wave-body" d="${bodyPath}"/><path class="wave-hit" d="${crestPoints}"/><path class="wave-crest" d="${crestPoints}"/><path class="wave-foam" d="${crestPoints}"/></g>`;
  }).join('');
  tokens.innerHTML = `<defs><clipPath id="ocean-surf-zone"><path d="M0 0H1000V190 C870 176 760 158 620 133 C440 102 250 72 0 46Z"/></clipPath></defs><g clip-path="url(#ocean-surf-zone)">${waveEntriesMarkup}</g>`;
  const stars = document.getElementById('bottle-stars');
  const starColors = ['#f5d65b', '#f8df78', '#eebf38', '#ffdf68', '#f2c64d', '#ffe58a', '#e8b52e'];
  const starMarks = ['✦', '✧', '★', '⋆', '✶'];
  const gratitudeEntries = data.entries.filter(entry => entry.kind === 'thanks');
  stars.style.setProperty('--star-count', gratitudeEntries.length);
  stars.style.fontSize = `${Math.max(5, 11 - Math.floor(gratitudeEntries.length / 6))}px`;
  stars.style.gap = gratitudeEntries.length > 18 ? '1px' : gratitudeEntries.length > 8 ? '2px' : '4px';
  stars.innerHTML = gratitudeEntries.map((entry, index) => {
    const number = entryStoryNumber(entry, 'thanks');
    const label = entryMarkerLabel(entry, 'thanks', number);
    return `<button type="button" class="bottle-star" data-entry-id="${escapeHTML(entry.id)}" data-tooltip="${escapeHTML(label)}" style="color:${starColors[index % starColors.length]}" aria-label="Review ${escapeHTML(label)}">${starMarks[index % starMarks.length]}</button>`;
  }).join('');
  installSceneTooltips();
}

function renderTodaySummary() {
  const day = selectedDate;
  const mood = data.moods[day];
  const heading = document.getElementById('checkin-title');
  heading.textContent = day === localToday() ? 'How are you feeling today?' : `How were you feeling on ${formatDate(day, { month: 'short', day: 'numeric' })}?`;
  document.getElementById('checkin-date-note').textContent = day === localToday() ? 'Your mood is saved to today.' : `Your mood is saved to ${formatDate(day, { month: 'long', day: 'numeric', year: 'numeric' })}.`;
  document.querySelectorAll('.mood-choice').forEach(button => {
    const selected = button.dataset.mood === mood;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  const dayEntries = entriesFor(day).length;
  document.getElementById('today-entry-count').textContent = dayEntries ? `${dayEntries} ${dayEntries === 1 ? 'moment' : 'moments'} gathered ${day === localToday() ? 'today' : 'that day'}` : 'No moments gathered yet';
  if (mood) announce(MOODS[mood].message);
}

function startOfWeek(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  result.setDate(result.getDate() - result.getDay());
  return result;
}
function changeDate(date, amount, unit) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
  if (unit === 'year') next.setFullYear(next.getFullYear() + amount);
  else if (unit === 'week') next.setDate(next.getDate() + amount * 7);
  else next.setMonth(next.getMonth() + amount);
  return next;
}
function dayButton(date, options = {}) {
  const key = dateKey(date);
  const mood = data.moods[key];
  const face = mood ? MOODS[mood].face : (entriesFor(key).length ? '✧' : '·');
  const moodClass = mood ? MOODS[mood].className : '';
  const classes = ['calendar-day', moodClass, mood ? 'has-mood' : 'no-mood', key === selectedDate ? 'selected' : '', key === localToday() ? 'today' : '', options.otherMonth ? 'other-month' : ''].filter(Boolean).join(' ');
  const ariaMood = mood ? `, mood ${mood}` : ', no mood check-in';
  const entryCount = entriesFor(key).length;
  return `<button type="button" class="${classes}" data-date="${key}" aria-label="${formatDate(key, { weekday: 'long', month: 'long', day: 'numeric' })}${ariaMood}${entryCount ? `, ${entryCount} journal ${entryCount === 1 ? 'entry' : 'entries'}` : ''}"><span class="day-number">${date.getDate()}</span><span class="day-face" aria-hidden="true">${face}</span></button>`;
}
function monthMarkup(year, month, compact = false) {
  const first = new Date(year, month, 1, 12);
  const offset = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0, 12).getDate();
  const previousDays = new Date(year, month, 0, 12).getDate();
  const weeks = Math.ceil((offset + daysInMonth) / 7);
  const cells = [];
  for (let index = 0; index < weeks * 7; index++) {
    if (index < offset) cells.push(dayButton(new Date(year, month - 1, previousDays - offset + index + 1, 12), { otherMonth: true }));
    else if (index >= offset + daysInMonth) cells.push(dayButton(new Date(year, month + 1, index - offset - daysInMonth + 1, 12), { otherMonth: true }));
    else cells.push(dayButton(new Date(year, month, index - offset + 1, 12)));
  }
  return `<div class="month-grid${compact ? ' compact-grid' : ''}"><span class="weekday">S</span><span class="weekday">M</span><span class="weekday">T</span><span class="weekday">W</span><span class="weekday">T</span><span class="weekday">F</span><span class="weekday">S</span>${cells.join('')}</div>`;
}
function renderCalendar() {
  const content = document.getElementById('calendar-content');
  const label = document.getElementById('calendar-label');
  if (view === 'month') {
    label.textContent = new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric' }).format(cursorDate);
    content.innerHTML = monthMarkup(cursorDate.getFullYear(), cursorDate.getMonth());
  } else if (view === 'week') {
    const start = startOfWeek(cursorDate);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    const sameYear = start.getFullYear() === end.getFullYear();
    label.textContent = sameYear
      ? `${new Intl.DateTimeFormat('en', { month: 'short' }).format(start)} ${start.getDate()} – ${new Intl.DateTimeFormat('en', { month: 'short' }).format(end)} ${end.getDate()}, ${end.getFullYear()}`
      : `${formatDate(dateKey(start), { month: 'short', day: 'numeric', year: 'numeric' })} – ${formatDate(dateKey(end), { month: 'short', day: 'numeric', year: 'numeric' })}`;
    content.innerHTML = `<div class="week-view">${Array.from({ length: 7 }, (_, index) => {
      const date = new Date(start); date.setDate(start.getDate() + index);
      const key = dateKey(date); const mood = data.moods[key];
      return `<div class="week-column"><span class="week-label">${new Intl.DateTimeFormat('en', { weekday: 'short' }).format(date)}</span>${dayButton(date)}<span class="week-entry-count">${entriesFor(key).length ? `${entriesFor(key).length} ${entriesFor(key).length === 1 ? 'note' : 'notes'}` : ''}</span></div>`;
    }).join('')}</div>`;
  } else {
    const year = cursorDate.getFullYear();
    label.textContent = String(year);
    content.innerHTML = `<div class="year-grid">${Array.from({ length: 12 }, (_, month) => `<div class="year-month"><strong>${new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(year, month, 1))}</strong>${monthMarkup(year, month, true)}</div>`).join('')}</div>`;
  }
  content.querySelectorAll('.calendar-day').forEach(button => button.addEventListener('click', () => {
    selectedDate = button.dataset.date;
    cursorDate = fromDateKey(selectedDate);
    activeConversationEntryId = null;
    renderAll();
  }));
}

function renderSelectedDay() {
  const entriesNode = document.getElementById('selected-day-entries');
  const mood = data.moods[selectedDate];
  document.getElementById('selected-date-label').textContent = selectedDate === localToday() ? `Today · ${formatDate(selectedDate)}` : formatDate(selectedDate);
  document.getElementById('selected-day-mood').textContent = mood ? `${MOODS[mood].face} ${mood}` : 'No mood check-in';
  const entries = entriesFor(selectedDate);
  if (!entries.length) {
    entriesNode.innerHTML = '<p class="review-empty">No notes for this day yet. You can keep this day just as it was.</p>';
    renderConversation(null);
    return;
  }
  entriesNode.innerHTML = entries.map(entry => {
    const type = KIND[entry.kind]?.title || 'Journal note';
    const time = new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(entry.createdAt));
    const category = entry.category ? `<span class="review-entry-category">${escapeHTML(entry.category)}</span>` : '';
    const goal = entry.goal ? `<div class="review-entry-goal">↗ ${escapeHTML(entry.goal)}</div>` : '';
    const current = entry.currentIntensity ?? entry.intensity;
    const checkin = entry.kind === 'hard' ? `<div class="intensity-meter"><span>Intensity</span><progress data-intensity-progress="${entry.id}" value="${current}" max="10" aria-label="Current feeling intensity ${current} out of 10"></progress><output data-intensity-value="${entry.id}">${current}/10</output></div><label class="review-intensity-control" for="intensity-${entry.id}">Update how it feels now</label><input class="review-intensity-slider" id="intensity-${entry.id}" data-intensity="${entry.id}" type="range" min="1" max="10" value="${current}" aria-label="Update intensity for this hard moment"><div class="hard-actions">${entry.resolved ? '<span class="resolved-label">♡ Resolved for now</span>' : `<button class="lighten-button" type="button" data-lighter="${entry.id}">Feels a little lighter</button><button class="resolve-button" type="button" data-resolve="${entry.id}">Resolved for now</button>`}</div>` : '';
    return `<article class="review-entry" data-review-entry="${escapeHTML(entry.id)}"><div class="review-entry-top"><span class="review-entry-type">${escapeHTML(type)}</span>${category}</div><p>${escapeHTML(entry.text)}</p>${goal}<div class="entry-footer"><time>${time}</time><span class="entry-controls"><button type="button" data-edit="${entry.id}">Edit</button>${entry.conversation?.length ? `<button type="button" data-chat="${entry.id}">Continue chat</button>` : ''}<button class="delete-entry-button" type="button" data-delete="${entry.id}" aria-label="Delete ${escapeHTML(type)} entry">Delete</button></span></div>${checkin}</article>`;
  }).join('');
  if (activeConversationEntryId) {
    const active = entries.find(entry => entry.id === activeConversationEntryId);
    renderConversation(active || null);
  } else renderConversation(null);
  entriesNode.querySelectorAll('[data-lighter]').forEach(button => button.addEventListener('click', () => {
    const entry = data.entries.find(item => item.id === button.dataset.lighter);
    if (!entry) return;
    entry.lighterCount = (entry.lighterCount || 0) + 1;
    entry.currentIntensity = Math.max(1, (entry.currentIntensity ?? entry.intensity ?? 5) - 1);
    persist().then(renderAll);
  }));
  entriesNode.querySelectorAll('[data-resolve]').forEach(button => button.addEventListener('click', () => {
    const entry = data.entries.find(item => item.id === button.dataset.resolve);
    if (!entry) return;
    entry.resolved = true;
    persist().then(renderAll);
  }));
  entriesNode.querySelectorAll('[data-intensity]').forEach(slider => {
    const entry = data.entries.find(item => item.id === slider.dataset.intensity);
    if (!entry) return;
    slider.addEventListener('input', () => {
      const value = Number(slider.value);
      entry.currentIntensity = value;
      if (entry.resolved) entry.resolved = false;
      entriesNode.querySelector(`[data-intensity-value="${entry.id}"]`).textContent = `${value}/10`;
      entriesNode.querySelector(`[data-intensity-progress="${entry.id}"]`).value = value;
      renderLandscape();
    });
    slider.addEventListener('change', () => persist().then(renderAll));
  });
  entriesNode.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
    const entry = data.entries.find(item => item.id === button.dataset.edit);
    if (entry) editEntry(entry);
  }));
  entriesNode.querySelectorAll('[data-chat]').forEach(button => button.addEventListener('click', () => {
    const entry = data.entries.find(item => item.id === button.dataset.chat);
    if (entry) { renderConversation(entry); document.getElementById('conversation-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }));
  entriesNode.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    const entry = data.entries.find(item => item.id === button.dataset.delete);
    if (!entry || !window.confirm('Delete this journal note? This cannot be undone.')) return;
    data.entries = data.entries.filter(item => item.id !== entry.id);
    if (entry.id === activeConversationEntryId) renderConversation(null);
    await persist(); renderAll(); announce('The note was deleted from this journal.');
  }));
}

function renderAll() {
  renderLandscape();
  renderTodaySummary();
  renderCalendar();
  renderSelectedDay();
}

document.querySelectorAll('.mood-choice').forEach(button => button.addEventListener('click', () => setMood(button.dataset.mood)));
function activateHotspot(id, kind) {
  const hotspot = document.getElementById(id);
  hotspot.addEventListener('click', event => { if (event.target.closest('[data-entry-id]')) return; openComposer(kind); });
  hotspot.addEventListener('keydown', event => {
    if (event.target !== hotspot) return;
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openComposer(kind); }
  });
}
activateHotspot('tree-hotspot', 'bright');
activateHotspot('tide-hotspot', 'hard');
for (const id of ['tree-fruits', 'pool-mementos', 'bottle-stars']) {
  const markers = document.getElementById(id);
  markers.addEventListener('click', event => {
    const marker = event.target.closest('[data-entry-id]');
    if (!marker) return;
    event.stopPropagation();
    openEntryDetail(marker.dataset.entryId);
  });
  markers.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && event.target.matches('[data-entry-id]')) {
      event.preventDefault(); event.stopPropagation(); openEntryDetail(event.target.dataset.entryId);
    }
  });
}
document.getElementById('jar-hotspot').addEventListener('click', () => {
  const bottle = document.getElementById('jar-hotspot');
  bottle.classList.add('pulled-out');
  window.setTimeout(() => { bottle.classList.add('bottle-open'); openComposer('thanks'); }, 260);
});
document.getElementById('entry-composer').addEventListener('submit', saveEntry);
document.getElementById('followup-form').addEventListener('submit', sendFollowup);
document.getElementById('entry-category').addEventListener('change', event => {
  const custom = document.getElementById('entry-category-custom');
  custom.hidden = event.target.value !== '__other';
  if (!custom.hidden) custom.focus(); else custom.value = '';
});
document.querySelectorAll('[data-create-entry]').forEach(button => button.addEventListener('click', () => openComposer(button.dataset.createEntry)));
document.getElementById('close-composer').addEventListener('click', () => { document.getElementById('entry-composer').hidden = true; document.getElementById('jar-hotspot').classList.remove('pulled-out', 'bottle-open'); });
document.getElementById('entry-intensity').addEventListener('input', event => { document.getElementById('intensity-value').textContent = `${event.target.value} / 10`; });
document.querySelectorAll('.view-switch button').forEach(button => button.addEventListener('click', () => {
  view = button.dataset.view;
  document.querySelectorAll('.view-switch button').forEach(item => item.classList.toggle('selected', item === button));
  renderCalendar();
}));
document.getElementById('calendar-prev').addEventListener('click', () => {
  cursorDate = changeDate(cursorDate, -1, view === 'year' ? 'year' : view === 'week' ? 'week' : 'month');
  renderCalendar();
});
document.getElementById('calendar-next').addEventListener('click', () => {
  cursorDate = changeDate(cursorDate, 1, view === 'year' ? 'year' : view === 'week' ? 'week' : 'month');
  renderCalendar();
});
document.getElementById('calendar-today').addEventListener('click', () => {
  cursorDate = new Date(); selectedDate = localToday(); renderCalendar(); renderSelectedDay();
});
document.getElementById('jump-today').addEventListener('click', () => {
  cursorDate = new Date(); selectedDate = localToday(); renderAll(); document.getElementById('checkin-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
});

const todayKey = localToday();
document.getElementById('today-date').textContent = formatDate(todayKey, { weekday: 'long', month: 'long', day: 'numeric' }).toUpperCase();
document.getElementById('export-journal').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...data }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `daylight-journal-${localToday()}.json`; link.click();
  URL.revokeObjectURL(url);
});
document.getElementById('preferences-form').addEventListener('submit', event => {
  event.preventDefault();
  const labels = document.getElementById('mood-labels-setting').value.split(',').map(item => item.trim()).filter(Boolean);
  const categories = [...new Set(document.getElementById('categories-setting').value.split(',').map(item => item.trim()).filter(Boolean))];
  if (labels.length !== 5 || !categories.length) { document.getElementById('settings-message').textContent = 'Enter five mood labels and at least one category.'; return; }
  settings.moodLabels = Object.fromEntries(Object.keys(MOODS).map((key, index) => [key, labels[index]]));
  settings.categories = categories;
  settings.prompts = { bright: document.getElementById('prompt-bright-setting').value.trim() || DEFAULT_SETTINGS.prompts.bright, thanks: document.getElementById('prompt-thanks-setting').value.trim() || DEFAULT_SETTINGS.prompts.thanks, hard: document.getElementById('prompt-hard-setting').value.trim() || DEFAULT_SETTINGS.prompts.hard };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); applySettings(); renderAll();
  document.getElementById('settings-message').textContent = 'Your preferences are saved on this device.';
});
document.getElementById('encrypt-form').addEventListener('submit', async event => {
  event.preventDefault();
  const input = document.getElementById('encrypt-passphrase');
  if (input.value.length < 12) return;
  const salt = crypto.getRandomValues(new Uint8Array(16));
  encryptionKey = await deriveEncryptionKey(input.value, salt); encryptionSalt = salt;
  await persist(); input.value = ''; document.getElementById('encrypted-controls').hidden = false;
  document.getElementById('settings-message').textContent = 'Journal notes are encrypted on this device.';
});
document.getElementById('disable-encryption').addEventListener('click', async () => {
  if (!window.confirm('Turn off encryption and store this journal as readable data in this browser?')) return;
  encryptionKey = null; encryptionSalt = null; await persist();
  document.getElementById('encrypted-controls').hidden = true;
  document.getElementById('settings-message').textContent = 'Encryption is off. Notes remain in this browser.';
});
document.getElementById('lock-now').addEventListener('click', () => {
  encryptionKey = null; encryptionSalt = null;
  data = { entries: [], moods: {} };
  document.getElementById('entry-composer').hidden = true;
  document.getElementById('conversation-panel').hidden = true;
  document.getElementById('conversation-messages').textContent = '';
  activeConversationEntryId = null;
  renderAll();
  document.getElementById('lock-overlay').hidden = false;
  document.getElementById('unlock-passphrase').value = '';
  document.getElementById('unlock-message').textContent = '';
  document.getElementById('unlock-passphrase').focus();
});
document.getElementById('unlock-form').addEventListener('submit', async event => {
  event.preventDefault();
  const message = document.getElementById('unlock-message'); message.textContent = 'Unlocking…';
  try { await unlockJournal(document.getElementById('unlock-passphrase').value); applySettings(); }
  catch { message.textContent = 'That passphrase did not unlock this journal.'; }
});
initializeJournal().catch(() => announce('This journal could not be loaded from browser storage.'));
