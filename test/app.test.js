'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const app = require('../server');
const { analyzeAnswer, analyzeLocally, buildProfile, chooseQuestion, prepareInterview } = require('../server/coach');

test('profile uses only supplied role materials and does not invent company facts', () => {
  const profile = buildProfile({ company: 'Example Co', role: 'Developer', description: 'Python and SQL required', resumeText: 'Built a Python project' });
  assert.equal(profile.company, 'Example Co');
  assert.deepEqual(profile.skills, ['Python', 'SQL']);
  assert.match(profile.projects[0], /Built a Python project/);
  assert.equal(Object.hasOwn(profile, 'companyFacts'), false);
});

test('resume-based setup asks about a supplied project', () => {
  const result = chooseQuestion({ type: 'Resume based' }, []);
  assert.match(result, /resume|project|experience/i);
	assert.match(chooseQuestion({ type: 'Mixed interview', resumeText: 'Built an inventory app' }, []), /resume|project|experience/i);
	assert.match(chooseQuestion({ type: 'Mixed interview' }, [{ question: 'Tell me about yourself', attempts: ['I am learning'] }]), /skill|learning/i);
});

test('local coach returns teaching, example, and comparison for weak answers', () => {
  const feedback = analyzeLocally({
    question: 'Why do you want this role?',
    answer: 'I want to join because your company is good and I want to learn.',
    attempts: ['I want this job because I like coding.', 'I want to join because your company is good and I want to learn.'],
    setup: { role: 'Software Developer', language: 'English + Tanglish' },
  });
  assert.ok(feedback.summary.length > 0);
  assert.ok(feedback.strengths.length > 0);
  assert.ok(feedback.improvements.length > 0);
  assert.match(feedback.why, /example|evaluate/i);
  assert.ok(feedback.structure.length >= 3);
  assert.ok(feedback.betterAnswer.length > 50);
  assert.ok(feedback.easyVersion.length > 20);
	assert.match(feedback.easyVersion, /\[your reason\]/);
  assert.match(feedback.spokenResponse, /Seri|Unga/);
  assert.ok(feedback.comparison.length > 0);
  assert.ok(['relevance', 'structure', 'clarity', 'confidence'].every((key) => feedback.scores[key] >= 1 && feedback.scores[key] <= 5));
  assert.equal(feedback.scores.accuracy, null);
  assert.equal(feedback.scores.grammar, null);
});

test('analysis rejects an empty answer and uses local coach without a key', async () => {
  await assert.rejects(analyzeAnswer({ question: 'Why this role?' }), { status: 400 });
  const result = await analyzeAnswer({ question: 'Tell me about yourself.', answer: 'I study computer science and built a small web app.', setup: { role: 'Developer' } }, {});
  assert.equal(result.source, 'local');
  assert.ok(result.feedback.betterAnswer);
});

test('health, interview preparation, coaching, and next question work over HTTP', async (context) => {
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const healthResponse = await fetch(`${base}/api/health`);
  assert.equal(healthResponse.status, 200);
  assert.equal((await healthResponse.json()).ok, true);

  const startResponse = await fetch(`${base}/api/interview/start`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: 'Software Developer', type: 'Mixed interview' }) });
  assert.equal(startResponse.status, 200);
  const started = await startResponse.json();
  assert.ok(started.question);
  assert.equal(started.profile.role, 'Software Developer');

  const analyzeResponse = await fetch(`${base}/api/interview/analyze`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question: started.question, answer: 'I am studying computer science and built a small project.', setup: { role: 'Software Developer' } }) });
  assert.equal(analyzeResponse.status, 200);
  const analyzed = await analyzeResponse.json();
  assert.equal(analyzed.source, 'local');
  assert.ok(analyzed.feedback.spokenResponse);
  assert.ok(analyzed.feedback.betterAnswer);

  const nextResponse = await fetch(`${base}/api/interview/next`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ setup: { type: 'Mixed interview', role: 'Software Developer' }, history: [{ question: started.question, attempts: ['I built a project'] }] }) });
  assert.equal(nextResponse.status, 200);
  assert.ok((await nextResponse.json()).question);
});

test('static UI is served with secure response headers', async (context) => {
  const server = app.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once('listening', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /InterviewMate AI/);
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
	assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/server/coach.js`)).status, 404);
  assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/package.json`)).status, 404);
  const upload = new FormData();
  upload.append('resume', new Blob(['not a resume format']), 'resume.txt');
  const unsupportedResume = await fetch(`http://127.0.0.1:${server.address().port}/api/resume`, { method: 'POST', body: upload });
  assert.equal(unsupportedResume.status, 415);
  const malformedUpload = new FormData();
  malformedUpload.append('resume', new Blob(['not a PDF']), 'resume.pdf');
  const malformedResume = await fetch(`http://127.0.0.1:${server.address().port}/api/resume`, { method: 'POST', body: malformedUpload });
  assert.equal(malformedResume.status, 422);
});

test('configured AI provider returns normalized structured coaching', async (context) => {
  const provider = http.createServer((_req, res) => {
    const feedback = { summary: 'You explained your reason.', strengths: ['Your goal is clear.'], improvements: ['Add a specific example.'], why: 'Examples give the interviewer evidence.', structure: ['Name a skill', 'Give evidence', 'Connect it to the role'], betterAnswer: 'I am interested in this role because…', easyVersion: 'I want this role because it fits my interests.', speakingTip: 'Pause between points.', spokenResponse: 'Your main idea is clear. Add one example and try again.', scores: { relevance: 4, accuracy: 4, completeness: 3, structure: 3, clarity: 4, grammar: 4, vocabulary: 3, confidence: 4 }, comparison: '', followUpQuestion: null };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(feedback) } }] }));
  });
  provider.listen(0, '127.0.0.1');
  context.after(() => new Promise((resolve) => provider.close(resolve)));
  await new Promise((resolve) => provider.once('listening', resolve));
  const result = await analyzeAnswer({ question: 'Why this role?', answer: 'I like this role.', setup: { role: 'Developer' } }, { AI_API_KEY: 'test-only-key', AI_MODEL: 'test-model', AI_API_BASE_URL: `http://127.0.0.1:${provider.address().port}/v1` });
  assert.equal(result.source, 'ai');
  assert.equal(result.feedback.scores.accuracy, 4);
  assert.match(result.feedback.betterAnswer, /interested in this role/);
});

test('each local interview track offers ten unique questions', () => {
  for (const type of ['HR', 'Technical', 'Behavioral', 'Resume based', 'Mixed interview']) {
    const history = [];
    for (let index = 0; index < 10; index += 1) {
      const question = chooseQuestion({ type }, history);
      assert.ok(!history.some((item) => item.question === question), `${type} repeated a question at ${index + 1}`);
      history.push({ question, attempts: [] });
    }
  }
});