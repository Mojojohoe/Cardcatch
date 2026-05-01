# Cardcatch

Two-player tabletop-style card duel with predator/prey framing, majors (power cards), optional desperation ladder, and local or networked play via PeerJS.

## Run locally

**Prerequisites:** Node.js

1. Install dependencies: `npm install`
2. Optional: copy `.env.example` to `.env` or `.env.local` and set `GEMINI_API_KEY` if your build uses Gemini for any features.
3. Start the dev server: `npm run dev`

## Build

```bash
npm run build
```

Output is emitted to `dist/` for static hosting.
