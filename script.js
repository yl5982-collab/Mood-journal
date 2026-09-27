const STORAGE_KEY = 'daylight-demo-v1';
const state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.date === new Date().toDateString()) return saved;
  } catch { /* Start with a fresh day if saved data is unavailable. */ }
  return { date: new Date().toDateString(), mood: '', bright: [], hard: [] };
}

function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function escapeHTML(value) { return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function addEntry(type, text) {
  state[type].unshift({ text, time: Date.now() });
  saveState();
  render();
}
function renderList(type, elementId, symbol) {
  const target = document.getElementById(elementId);
  if (!state[type].length) {
    target.innerHTML = `<div class="empty-state">${type === 'bright' ? 'Your little lights will gather here' : 'Your thoughts are safe to explore here'} <span>${type === 'bright' ? '✧' : '♡'}</span></div>`;
    return;
  }
  target.innerHTML = state[type].map(entry => `<div class="entry-item"><span class="entry-dot">${symbol}</span><span>${escapeHTML(entry.text)}</span></div>`).join('');
}
function render() {
  renderList('bright', 'bright-list', '✦');
  renderList('hard', 'hard-list', '☁');
  document.getElementById('bright-count').textContent = state.bright.length;
  document.getElementById('review-bright').textContent = state.bright.length;
  document.getElementById('review-hard').textContent = state.hard.length;
  document.getElementById('jar-fill').style.height = `${Math.min(92, state.bright.length * 18)}%`;
  document.getElementById('reflect-button').disabled = !state.hard.length;
  document.querySelectorAll('.mood-option').forEach(button => button.classList.toggle('selected', button.dataset.mood === state.mood));
  const note = state.bright.length ? `You noticed ${state.bright.length} bright ${state.bright.length === 1 ? 'moment' : 'moments'} today. Let that be part of the picture, too.` : 'Your day is still unfolding. You can add to it whenever you like.';
  document.getElementById('review-note').textContent = note;
  if (state.reflection) {
    const panel = document.getElementById('reflection');
    panel.hidden = false;
    panel.innerHTML = `<strong>A gentle check-in</strong>${escapeHTML(state.reflection)}<span class="prompt">What would you say to someone you care about in this same situation?</span>`;
  }
}

document.getElementById('bright-form').addEventListener('submit', event => {
  event.preventDefault(); const input = document.getElementById('bright-input');
  const text = input.value.trim(); if (text) { addEntry('bright', text); input.value = ''; }
});
document.getElementById('hard-form').addEventListener('submit', event => {
  event.preventDefault(); const input = document.getElementById('hard-input');
  const text = input.value.trim(); if (text) { addEntry('hard', text); input.value = ''; document.getElementById('reflection').hidden = true; }
});
document.querySelectorAll('.mood-option').forEach(button => button.addEventListener('click', () => {
  state.mood = button.dataset.mood; saveState(); render();
  document.getElementById('mood-message').textContent = `You’re feeling ${state.mood.toLowerCase()} today. Thanks for checking in with yourself.`;
}));
document.getElementById('reflect-button').addEventListener('click', () => {
  const text = state.hard[0]?.text || '';
  const responses = [
    `That sounds like a lot to hold. The thought “${text}” is one way your mind is making sense of this moment; it may not be the whole story. What parts do you know for certain, and what parts are you filling in?`,
    `It makes sense that this is weighing on you. You don’t have to turn it into a lesson right away. Is there one small piece you can influence, or would a pause and a conversation with someone you trust help first?`,
    `You’re allowed to find this difficult and still be capable. Try naming what happened separately from what it seems to say about you. What is one kind, realistic next step you could take?`
  ];
  state.reflection = responses[Math.floor(Math.random() * responses.length)]; saveState(); render();
});

const today = new Date();
const dateLabel = new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(today);
document.getElementById('today-date').textContent = dateLabel.toUpperCase();
document.getElementById('review-date').textContent = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(today);
render();
