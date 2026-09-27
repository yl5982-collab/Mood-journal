# Daylight ☀️

Daylight is a small, browser-based e-mood journal demo for recording everyday wins, checking in with your mood, and making space for difficult feelings. It was created for a class project and inspired by the idea that small accomplishments deserve to be remembered alongside the hard parts of a day.

## Try the demo

No build tools or dependencies are required. Download or clone this repository, then open `index.html` in a modern browser. For a local web server, run `python -m http.server 8000` from the project folder and visit <http://localhost:8000>.

Entries are saved in the browser's `localStorage` for the current date. The demo resets its displayed journal on a new date. Data stays in that browser and is not synced.

## What’s included

- A mood check-in with five choices
- **Bright Finds**, a place to collect small wins and happy moments in a growing jar
- **The Unburdening**, a place to record what feels hard
- A guided perspective prompt with a few supportive, locally generated responses
- A daily glance at the moments collected
- Responsive layout for desktop and mobile

The reflection response is a scripted demo, not generative AI, therapy, or a clinical assessment. No AI service or account is connected. A future version could connect an AI API through a secure server, with clear consent and privacy controls.

## Design direction

The app treats difficult feelings as information worth listening to rather than waste to discard. It balances recognition of positive moments with room to reflect on painful ones, and keeps encouragement gentle instead of demanding constant positivity. “Bright Finds” names the wins collection; “The Unburdening” offers a softer name for the space to write about hard moments.

## Similar products to explore

- [Daylio](https://daylio.net/) — quick mood and activity logging, stats, goals, and customization.
- [Finch](https://finchcare.com/about-finch) — a self-care companion that combines small goals, journaling prompts, and playful progression.
- [How We Feel](https://www.howwefeel.org/) — emotion check-ins, reflection, and strategies for emotional regulation; its official App Store listing describes privacy controls and on-device data storage.
- [Reflectly](https://apps.apple.com/gb/app/reflectly-journal-ai-diary/id1241229134) — an AI-oriented journaling product positioned around working through negative thoughts and building positivity.

Potential ways Daylight can stand apart: pair a tangible “jar” of small wins with a structured thought reflection; make the positive and difficult sides equally easy to use; offer user-controlled, compassionate prompts instead of diagnosing; and make privacy and the limits of AI explicit. These are starting points for differentiation, not claims that other products lack these features.

## Project files

- `index.html` — page structure
- `styles.css` — visual design and responsive layout
- `script.js` — interactions and local demo state

## Connect to GitHub

This folder can be initialized as a Git repository locally. To publish it, create an empty repository on GitHub, then run these commands in this folder (replace the URL with your repository URL):

```bash
git init
git add index.html styles.css script.js README.md
git commit -m "Build Daylight mood journal demo"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

If you use GitHub CLI and are signed in, you can instead create and push the repository with `gh repo create YOUR-REPOSITORY --public --source=. --remote=origin --push` (use `--private` if you prefer a private class project).

## Future ideas

- Calendar and trends view across multiple days
- Export and delete controls for journal data
- User-chosen reflection styles and accessibility options
- Secure AI integration with explicit consent and a clear privacy policy
- A support and crisis-resource screen appropriate to the user’s location

## Care note

Daylight is a class demo for reflection and encouragement. It is not a therapist, crisis service, or replacement for professional mental health care. If you may be in immediate danger, contact local emergency services or a trusted person who can help now.
