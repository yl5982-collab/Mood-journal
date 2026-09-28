# Daylight ☀️

Daylight is a local-first daily mood check-in and self-care journal demo. Its connected landscape gives little wins, gratitude, and difficult feelings their own place, then brings them together in a calendar.

## Run locally

Install [Node.js 18 or newer](https://nodejs.org/), then run from this folder:

```bash
npm start
```

Open <http://127.0.0.1:4173>. The small server serves the static demo and holds the optional AI API key outside browser code. It binds to your own computer only.

## Features

- Daily check-in, plus week, month, and year calendar review.
- Tap the tree to record a **Bright Find** and grow a fruit; tap the drift bottle for a colorful gratitude star; tap the tidepool for **The Unburdening**.
- Hover or select an apple, gratitude star, or existing water-side surf edge to review its matching entry. Surf hit areas stay clipped to the ocean; they appear as a soft highlight only on hover.
- Select any calendar day to update its mood, add a dated note, or revisit and continue an earlier companion conversation.
- Rate hard-moment intensity, mark it lighter, or mark it resolved for now while keeping the original story.
- Continue a conversation below the painting. Bright Finds get affirmations and ways to build on progress; hard moments get an immediate comfort idea and a practical longer-term step. Local follow-up reflections are scripted; live follow-ups require separate consent.
- Edit, delete, and export journal entries as JSON.
- Customize five mood labels, life-area categories, and writing prompts.
- Optional AES-GCM encryption of journal data stored in this browser.

## Optional live AI setup

Live responses use the OpenAI Responses API from `server.js`. Copy `.env.example` to `.env`, then replace its placeholder with your API key. `.env` is ignored by Git; never put a real key in `script.js`, commit it, or share it in a chat. Alternatively, set the environment variable in your terminal:

```powershell
$env:OPENAI_API_KEY = "your-key"
$env:OPENAI_MODEL = "gpt-6-astra"
npm start
```

The live-AI box is unchecked for each note. When checked, the app discloses that the note, its life-area tag, and goal will be sent to OpenAI; consent is sent with the request. The server sets `store: false` and does not log journal text. OpenAI states API data is not used to train models by default, but abuse-monitoring logs may retain content for up to 30 days. Review [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data). Without a configured key, local reflections continue and the live call reports that it is unavailable.

This endpoint is intended for a local class demo. A public deployment needs appropriate user authentication, request limits, secret management, privacy disclosures, and operational safeguards before users can submit private journal content.

## Local storage and privacy

Journal content is stored in this browser profile and is not synced to an account. Browser storage can be cleared. Export creates a readable JSON file, even if the browser copy is encrypted, so store exports carefully.

Encryption is optional and uses a passphrase-derived AES-GCM key in this browser. The passphrase is not stored; if it is forgotten, the encrypted journal cannot be recovered. This is a small demo feature, not a security audit. No account-based sync is implemented.

## Design and care note

The page uses a continuous, soft-pastel Japanese anime coastline. The landscape starts its subtle loop automatically: canopy light and apples sway, sea light and the near-shore wash move, and the half-buried drift bottle rocks gently. Positive stories appear as fruit in the tree canopy; hard-moment entries map to existing surf edges and highlight only on hover. Daylight is a reflection tool, not a therapist, crisis service, or replacement for professional care. Companion replies are supportive suggestions, not diagnosis or treatment. If someone may be in immediate danger, contact local emergency services or a trusted person who can help now.

## Project files

- `index.html` — interface and forms
- `styles.css` and `styles-overrides.css` — responsive layout and landscape painting
- `script.js` — check-in, local data, encryption, calendar, and reflections
- `assets/anime-coast-wide.png` and `assets/anime-coast-mobile.png` — responsive anime-coast backgrounds
- `server.js` — static server and private AI proxy endpoint
- `package.json` — local start script and Node.js requirement
- `.env.example` and `.gitignore` — safe AI setup template and local-file exclusions
- `AGENTS.md` — work-session instructions

## Similar products to explore

- [Daylio](https://daylio.net/) — mood and activity logging, statistics, goals, and customization.
- [Finch](https://finchcare.com/about-finch) — self-care goals, journaling, and a virtual companion.
- [How We Feel](https://www.howwefeel.org/) — emotion check-ins and strategies for emotional regulation.
- [Reflectly](https://apps.apple.com/gb/app/reflectly-journal-ai-diary/id1241229134) — an AI-oriented journaling product.

## GitHub

The project is connected to [yl5982-collab/Mood-journal](https://github.com/yl5982-collab/Mood-journal). To publish changes from this folder:

```bash
git status
git add README.md index.html script.js styles.css styles-overrides.css package.json server.js .gitignore .env.example AGENTS.md assets/anime-coast-wide.png assets/anime-coast-mobile.png
git commit -m "Describe your changes"
git push origin main
```

The real `.env` file is ignored and should never be committed; `.env.example` contains placeholders and is safe to share.

## Reflections

I had a hard time realizing the interface design I had in mind, so I kept revising the visual style and testing different ways to communicate with Codex. I uploaded reference images, switched to my mother tongue, and also used ChatGPT to make my prompts clearer and more understandable to AI. I experimented with different functions and even fed some of the future ideas suggested in the README back into Codex, because I wanted to explore what it could and could not do. Some results exceeded my expectations. For example, Codex successfully built the mood-tracking calendar and intensity-level adjustments, and even added a disclaimer encouraging users to seek professional help when necessary.

AI also helped me brainstorm ideas, find references to similar self-care applications, and think of features I had not considered. However, I still needed to make my own design decisions rather than simply accept its suggestions. For example, Codex cautioned that counting fruits might make progress feel like a competition, but I decided to keep this feature because, in my design, fruits represent personal accomplishments rather than better mental health. 

Some technical questions remain unresolved. I wanted to add a live AI conversation space where users could share their feelings and receive real-time responses, as well as connect features such as soothing music and volume control, but I was not yet sure how to integrate these external applications. This is something I would like to understand and explore further.
