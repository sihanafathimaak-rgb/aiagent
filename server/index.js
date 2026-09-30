'use strict';

require('dotenv').config();
const path = require('node:path');
const express = require('express');
const multer = require('multer');
const { analyzeAnswer, nextQuestion, prepareInterview } = require('./coach');
const { extractResume } = require('./resume');

const app = express();
const port = Number(process.env.PORT) || 3000;
const host = process.env.HOST || '127.0.0.1';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } });

app.disable('x-powered-by');
app.use((req, res, next) => {
  res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cache-Control': 'no-store' });
  next();
});
app.use(express.json({ limit: '80kb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, aiConfigured: Boolean(process.env.AI_API_KEY), model: process.env.AI_MODEL || 'gpt-4o-mini', speechRecognition: 'browser-dependent', storage: 'browser-localStorage' }));

app.post('/api/resume', upload.single('resume'), async (req, res, next) => {
  try { res.json(await extractResume(req.file)); }
  catch (error) { next(error); }
});

app.post('/api/interview/start', async (req, res, next) => {
  try {
    const setup = req.body || {};
    if (typeof setup.role !== 'string' || !setup.role.trim()) return res.status(400).json({ error: 'A job role is required.' });
    res.json(await prepareInterview(setup));
  } catch (error) { next(error); }
});

app.post('/api/interview/analyze', async (req, res, next) => {
  try { res.json(await analyzeAnswer(req.body || {})); }
  catch (error) { next(error); }
});

app.post('/api/interview/next', async (req, res, next) => {
  try { res.json(await nextQuestion(req.body || {})); }
  catch (error) { next(error); }
});

const clientRoot = path.resolve(__dirname, '..');
app.get('/', (_req, res) => res.sendFile(path.join(clientRoot, 'code.html')));
app.get('/code.html', (_req, res) => res.sendFile(path.join(clientRoot, 'code.html')));
app.get('/code.css', (_req, res) => res.sendFile(path.join(clientRoot, 'code.css')));
app.get('/code.js', (_req, res) => res.sendFile(path.join(clientRoot, 'code.js')));

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Resume must be smaller than 5 MB.' : 'Resume upload could not be processed.' });
  const status = Number(error.status) || 500;
  if (status >= 500) console.error('[interviewmate]', error.message);
  res.status(status).json({ error: error.publicMessage || (status >= 500 ? 'The request could not be completed. Please try again.' : error.message) });
});

if (require.main === module) {
  app.listen(port, host, () => console.log(`InterviewMate AI listening at http://${host}:${port}`));
}

module.exports = app;