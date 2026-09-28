const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
try {
  const envFile = fs.readFileSync(path.join(root, '.env'), 'utf8');
  for (const line of envFile.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^(["'])(.*)\1$/, '$2');
  }
} catch {}
const port = Number(process.env.PORT || 4173);
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.json': 'application/json; charset=utf-8' };

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 32000) throw new Error('Request is too large.');
  }
  return JSON.parse(body || '{}');
}

function outputText(response) {
  return (response.output || []).flatMap(item => item.content || [])
    .filter(item => item.type === 'output_text' || item.type === 'text')
    .map(item => item.text || '').join('\n').trim();
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; base-uri 'self'; frame-ancestors 'none'");

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname === '/api/companion') {
    if (req.method !== 'POST') return send(res, 405, { error: 'Use POST for companion reflections.' });
    let body;
    try { body = await readJson(req); } catch { return send(res, 400, { error: 'The request is not valid JSON or is too large.' }); }
    if (body.consent !== true) return send(res, 400, { error: 'Consent is required before sending a note to the AI service.' });
    if (!['bright', 'thanks', 'hard'].includes(body.kind) || typeof body.text !== 'string' || !body.text.trim() || body.text.length > 2000) {
      return send(res, 400, { error: 'Please provide a valid journal note (up to 2,000 characters).' });
    }
    if (!process.env.OPENAI_API_KEY) return send(res, 503, { error: 'Live AI is not configured. Set OPENAI_API_KEY in your local environment.' });

    const isHard = body.kind === 'hard';
    const instructions = `You are a warm, non-clinical journaling companion. Be specific to the note, concise (about 120-200 words), validating, and never diagnose, shame, promise outcomes, or invent statistics. Do not claim one hard event is secretly good. For a win, celebrate evidence in the user's own story and suggest a small useful next step. For gratitude, reflect what the person values without pressuring them to feel positive. For a hard moment, validate first, optionally offer a cognitive thinking pattern as a gentle question (never label as fact), include one immediate soothing action and one practical longer-term step, tailored to the situation and their goal if given. When conversation history and a follow-up are present, answer the latest question directly and carry forward relevant context without repeating the whole first reflection. If the note suggests imminent self-harm or danger, encourage contacting emergency services or a trusted person now. You are not therapy or crisis care.`;
    const history = Array.isArray(body.history) ? body.history.slice(-12).map(message => ({ role: message.role === 'user' ? 'user' : 'assistant', text: String(message.text || '').slice(0, 1500) })) : [];
    const input = JSON.stringify({ kind: body.kind, note: body.text.slice(0, 2000), lifeArea: typeof body.category === 'string' ? body.category.slice(0, 100) : '', goal: typeof body.goal === 'string' ? body.goal.slice(0, 500) : '', intensity: isHard ? Math.min(10, Math.max(1, Number(body.intensity) || 5)) : null, conversation: history, followUp: typeof body.message === 'string' ? body.message.slice(0, 1200) : '' });
    try {
      const upstream = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-6-astra', store: false, instructions, input })
      });
      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return send(res, 502, { error: upstream.status === 401 ? 'The server AI key was rejected. Check its configuration.' : 'The AI service could not complete this reflection right now.' });
      const text = outputText(result);
      if (!text) return send(res, 502, { error: 'The AI service returned no reflection.' });
      return send(res, 200, { text });
    } catch {
      return send(res, 502, { error: 'Could not reach the AI service. Your saved note is still in this browser.' });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed.' });
  let filePath = path.resolve(root, `.${decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)}`);
  if (!filePath.startsWith(root + path.sep) || path.basename(filePath).startsWith('.')) return send(res, 404, { error: 'Not found.' });
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(port, '127.0.0.1', () => console.log(`Daylight is available at http://127.0.0.1:${port}`));
