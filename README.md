# InterviewMate AI

InterviewMate AI is a personal interview coach for realistic text and browser-voice practice. It teaches answer structure, explains strengths and gaps, provides a natural example and an easier version, and keeps attempt history so candidates can notice improvement.

## Project structure

```text
code.html                  Browser entry point
code.css                   Responsive application styles
code.js                    Views, interview flow, browser speech, local session storage
server/
  index.js                 Express API and static app server
  coach.js                 Interview profile, question flow, AI prompt, local coaching fallback
  resume.js                In-memory PDF/DOCX text extraction
test/
  app.test.js              Coach and HTTP integration tests
.env.example               Environment variable template
```

## Technologies

- Node.js 20+ and Express 4
- Plain JavaScript and responsive CSS (no frontend build step)
- OpenAI-compatible Chat Completions API, called only from the backend
- Browser `SpeechRecognition`/`webkitSpeechRecognition`, `speechSynthesis`, and Web Audio voice activity detection
- Browser `localStorage` for session history and feedback
- `pdf-parse` and `mammoth` for PDF and DOCX resume extraction

## Requirements and setup

Install Node.js 20 or newer. From this folder:

```sh
npm install
```

Copy `.env.example` to `.env`. The app runs without an AI provider key using its transparent local coaching engine. To enable generated AI feedback, set:

```dotenv
AI_API_KEY=your-provider-api-key
AI_MODEL=gpt-4o-mini
AI_API_BASE_URL=https://api.openai.com/v1
```

`AI_API_BASE_URL` must be an OpenAI-compatible API base URL; the server appends `/chat/completions`. Keep `.env` private. Keys are never sent to the browser. The selected provider may process the interview context sent for answer coaching, so avoid sharing sensitive personal information. Resume text is uploaded for parsing in memory and is not written to disk; the browser saves interview transcripts locally.

Optional server settings are `PORT` (default `3000`) and `HOST` (default `127.0.0.1`). For remote hosting, choose a suitable host and add deployment-grade authentication, rate limiting, and privacy controls before exposing the service publicly.

## Run the app

Start the backend and frontend together:

```sh
npm start
```

Open <http://127.0.0.1:3000>. For automatic restart during development:

```sh
npm run dev
```

The browser app is served by Express, so there is no separate frontend process. HTTPS or `localhost` is required for browser microphone permissions. Speech recognition availability and language support depend on the browser; use current Chrome or Edge for the most complete voice path. Other browsers can use the full text interview mode.

## How answer coaching works

The browser sends the question, answer, earlier attempts, selected language, and user-supplied role materials to `POST /api/interview/analyze`. When `AI_API_KEY` is configured, the backend asks the configured model for structured feedback: summary, strengths, improvements, why, answer structure, improved and easy versions, speaking tip, scores, attempt comparison, and an optional follow-up. Spoken feedback is kept short and is stripped to plain text before TTS.

Without a key, the backend uses a local heuristic coach that considers answer length, examples, outcomes, role connections, and attempt changes. It is useful for a key-free demo, but it is not an LLM and cannot establish technical correctness reliably. The UI/API marks this path as `local`; the AI-configured path is marked `ai`.

## How voice practice works

Voice is opt-in from the microphone control. The browser requests microphone permission, transcribes speech into the same answer field used by text mode, and submits after a short final-speech pause. The backend response is shown in full and read with browser text-to-speech. Once a candidate enables voice, speech playback returns to listening automatically. While the coach is speaking, Web Audio monitors microphone level for an interruption; detected speech cancels playback and opens recognition. A manual text answer remains available throughout.

Browser speech services can require network access and may behave differently by OS/provider. Permission denial, unavailable recognition, no speech, API failures, and TTS errors leave the text path available with an on-screen message.

## Persistence and privacy

Interview sessions, answers, feedback, and reports are saved in the current browser's `localStorage`; there is no user account or server database in this MVP. Clearing site data removes that history. The server does not persist resume files or interview requests. When an AI provider is configured, submitted context is sent to that provider under its terms.

## Testing checklist

Automated checks:

```sh
npm test
```

The suite covers profile grounding, teaching feedback, attempt comparison, input validation, health/start/analyze/next API calls, static serving, and security headers.

Manual browser checks:

- Create an interview in each mode and difficulty; verify questions reflect the supplied role and materials.
- Submit a typed answer, read every coaching section, retry, compare, continue, and finish to inspect the report.
- Upload a text-based PDF and DOCX; try an unsupported file and a file over 5 MB.
- Allow microphone access, speak an answer, confirm transcription and automatic listen/speak transitions, then interrupt a spoken response.
- Deny microphone access or use a browser without speech recognition; verify text mode still works.
- Verify mute, pause, repeat, end interview, local session history, and responsive layouts at mobile and desktop widths.
- With an AI key configured, verify valid feedback; with an invalid key, verify an actionable error and successful text retry.