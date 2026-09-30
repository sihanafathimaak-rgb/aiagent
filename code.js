'use strict';

const STORAGE_KEY = 'interviewmate.sessions.v1';
const QUESTION_LIMIT = 10;
const speechRecognitionAvailable = 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
let toastTimer;

const state = {
	page: 'dashboard', sessions: loadSessions(), currentId: null, busy: false, draftAnswer: '', voiceState: 'IDLE', recognition: null, speechToken: 0,
	microphoneStream: null, audioContext: null, vadFrame: null, speechMuted: false, voiceEnabled: false,
	silenceTimer: null, noSpeechTimer: null, startedAt: null, clockTimer: null,
};

function loadSessions() {
	try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); return Array.isArray(value) ? value : []; }
	catch { return []; }
}
function saveSessions() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.sessions)); }
function currentSession() { return state.sessions.find((session) => session.id === state.currentId); }
function escapeHtml(value = '') {
	return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}
function toastMessage(message, error = false) {
	toast.textContent = message; toast.classList.toggle('error', error); toast.classList.add('show');
	clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), 3800);
}
function setPage(page) {
	if (state.page === 'interview' && page !== 'interview') { stopVoice(); releaseMicrophone(); }
	state.page = page; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
}
function initials() {
	const name = localStorage.getItem('interviewmate.name') || '';
	return name.trim() ? name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase() : 'IM';
}
function renderShell(content, title, eyebrow = 'YOUR PERSONAL AI INTERVIEW COACH') {
	const navItems = [['dashboard', '⌂', 'Overview'], ['setup', '+', 'New interview'], ['history', '◷', 'Interview history']];
	app.innerHTML = `<div class="shell"><aside class="sidebar" id="sidebar"><div class="brand"><span class="brand-mark">i</span><div><div class="brand-name">InterviewMate AI</div><div class="brand-sub">Your Personal AI Interview Coach</div></div></div><div class="nav-label">WORKSPACE</div><nav class="nav" aria-label="Main navigation">${navItems.map(([id, icon, label]) => `<button data-page="${id}" class="${state.page === id ? 'active' : ''}"><span class="nav-icon">${icon}</span>${label}</button>`).join('')}</nav><div class="side-bottom"><div class="coach-note"><strong>Practice with purpose</strong><p>Your coach helps you find the words, structure, and confidence to make each answer yours.</p></div></div></aside><main class="main"><header class="topbar"><button class="mobile-menu" data-action="menu" aria-label="Open navigation">☰</button><div><div class="eyebrow">${escapeHtml(eyebrow)}</div><h1 class="page-title">${escapeHtml(title)}</h1></div><div class="top-actions"><span class="avatar-small" aria-label="Your profile">${escapeHtml(initials())}</span></div></header><div class="content">${content}</div></main></div>`;
	app.querySelectorAll('.nav [data-page]').forEach((button) => button.addEventListener('click', () => setPage(button.dataset.page)));
	app.querySelector('[data-action="menu"]')?.addEventListener('click', () => document.querySelector('#sidebar').classList.toggle('open'));
}
function render() {
	if (state.page === 'setup') return renderSetup();
	if (state.page === 'interview') return renderInterview();
	if (state.page === 'report') return renderReport();
	if (state.page === 'history') return renderHistory();
	renderDashboard();
}
function renderDashboard() {
	const completed = state.sessions.filter((session) => session.status === 'completed');
	const questions = state.sessions.reduce((count, session) => count + session.questions.length, 0);
	const attempts = state.sessions.reduce((count, session) => count + session.questions.reduce((total, item) => total + item.attempts.length, 0), 0);
	const recent = [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 3);
	const skills = aggregateSkills();
	renderShell(`<section class="welcome"><div class="welcome-copy"><div class="eyebrow">A better way to get interview-ready</div><h2>Practice interviews like you're talking to a real interviewer.</h2><p>Tell us the company and role. Your coach will help you prepare, listen to your answers, and show you how to make them stronger.</p><button class="button primary" data-action="start">Start an interview <span aria-hidden="true">→</span></button></div><div class="welcome-art" aria-hidden="true"><span>✳</span></div></section><div class="section-heading"><div><h2>Your practice at a glance</h2><p>Every attempt is a chance to get clearer and more confident.</p></div></div><section class="stats"><div class="stat"><div class="stat-label">Interviews completed</div><div class="stat-value">${completed.length}</div><div class="stat-foot">Your finished sessions</div></div><div class="stat"><div class="stat-label">Questions practiced</div><div class="stat-value">${questions}</div><div class="stat-foot">Across all sessions</div></div><div class="stat"><div class="stat-label">Answer attempts</div><div class="stat-value">${attempts}</div><div class="stat-foot">Retries count as progress</div></div><div class="stat"><div class="stat-label">Practice streak</div><div class="stat-value">${completed.length ? 'On' : '—'}</div><div class="stat-foot">Keep your momentum</div></div></section><div class="dashboard-grid"><section><div class="section-heading"><div><h2>Growth areas</h2><p>Based on your recent answer feedback</p></div></div><div class="panel"><div class="skill-list">${skills.map(([label, value]) => `<div class="skill-row"><span>${label}</span><div class="skill-track"><div class="skill-fill" style="width:${value}%"></div></div><span class="skill-score">${value ? `${value}%` : '—'}</span></div>`).join('')}</div></div></section><section><div class="section-heading"><div><h2>Recent sessions</h2><p>Your latest interview practice</p></div><button class="button ghost small" data-page="history">View all</button></div><div class="panel"><div class="recent-list">${recent.length ? recent.map((session) => `<div class="recent-item"><div><strong>${escapeHtml(session.company || session.role)}</strong><small>${escapeHtml(session.role)} · ${new Date(session.updatedAt).toLocaleDateString()}</small></div><button class="button ghost small" data-open-session="${session.id}">${session.status === 'completed' ? 'Report' : 'Resume'}</button></div>`).join('') : '<div class="empty">Your sessions will show up here after your first practice.</div>'}</div></div></section></div><div class="section-heading"><div><h2>Practice that teaches</h2><p>A thoughtful coach, not a right-or-wrong quiz.</p></div></div><section class="stats"><div class="stat"><div class="stat-label">01 · Real conversation</div><div class="stat-foot">Speak naturally, or type if you prefer.</div></div><div class="stat"><div class="stat-label">02 · Detailed coaching</div><div class="stat-foot">Know what landed and what to add.</div></div><div class="stat"><div class="stat-label">03 · Try it again</div><div class="stat-foot">Compare attempts and notice progress.</div></div><div class="stat"><div class="stat-label">04 · Your next steps</div><div class="stat-foot">Leave with a practice plan that fits.</div></div></section>`, 'Good to see you', 'INTERVIEWMATE AI');
	const momentum = app.querySelector('.stats:not(.feature-stats) .stat:last-child');
	momentum.querySelector('.stat-label').textContent = 'Practice momentum';
	momentum.querySelector('.stat-value').textContent = completed.length ? 'Building' : '—';
	momentum.querySelector('.stat-foot').textContent = 'Each session is a step forward';
	const featureCards = [
		['AI Mock Interviews', 'Practice realistic questions for your chosen role.'],
		['Real Voice Conversation', 'Speak naturally with automatic listening.'],
		['Answer Analysis', 'Understand what was clear and what was missing.'],
		['Personalized Teaching', 'Learn a structure that fits each question.'],
		['English Speaking Coach', 'Get gentle, useful language feedback.'],
		['Company & Role Preparation', 'Use the details you provide to prepare.'],
		['Progress Tracking', 'Keep attempts and growth areas together.'],
		['Interview Reports', 'Leave with strengths and practice steps.'],
	];
	const featureSection = [...app.querySelectorAll('.section-heading')].find((section) => section.textContent.includes('Practice that teaches'))?.nextElementSibling;
	featureSection?.classList.add('feature-stats');
	if (featureSection) featureSection.innerHTML = featureCards.map(([title, detail]) => `<div class="stat"><div class="stat-label">${title}</div><div class="stat-foot">${detail}</div></div>`).join('');
	const startButton = app.querySelector('[data-action="start"]');
	startButton.innerHTML = 'Start Interview <span aria-hidden="true">→</span>';
	const practiceButton = startButton.cloneNode(true);
	practiceButton.className = 'button secondary'; practiceButton.textContent = 'Practice with AI'; startButton.after(practiceButton);
	app.querySelectorAll('[data-action="start"]').forEach((button) => button.addEventListener('click', () => setPage('setup')));
	app.querySelectorAll('[data-open-session]').forEach((button) => button.addEventListener('click', () => openSession(button.dataset.openSession)));
	app.querySelectorAll('[data-page="history"]').forEach((button) => button.addEventListener('click', () => setPage('history')));
}
function aggregateSkills() {
	const feedback = state.sessions.flatMap((session) => session.questions.flatMap((item) => item.feedback || []));
	const keys = [['Answer structure', 'structure'], ['Communication', 'clarity'], ['Role relevance', 'relevance'], ['Speaking confidence', 'confidence']];
	return keys.map(([label, key]) => { const values = feedback.map((item) => Number(item.scores?.[key])).filter(Number.isFinite); return [label, values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 20) : 0]; });
}
function radioChips(name, values, selected) { return values.map((value) => `<label class="select-chip"><input type="radio" name="${name}" value="${escapeHtml(value)}" ${value === selected ? 'checked' : ''} /><span>${escapeHtml(value)}</span></label>`).join(''); }
function renderSetup() {
	renderShell(`<div class="setup-layout"><form class="panel form-panel" id="setup-form"><div class="section-heading" style="margin:0 0 20px"><div><h2>Make this interview yours</h2><p>We only use details you share to tailor your practice.</p></div></div><div class="form-grid"><div class="field"><label for="company">Company</label><input id="company" name="company" placeholder="e.g. Google" autocomplete="organization" /></div><div class="field"><label for="role">Job role <span aria-hidden="true">*</span></label><input id="role" name="role" placeholder="e.g. Software Developer" required autocomplete="organization-title" /></div><div class="field full"><label for="description">Job description <span class="field-hint">Optional</span></label><textarea id="description" name="description" placeholder="Paste the job description to tailor questions to the role."></textarea></div><div class="field full"><span class="field-label">Resume <span class="field-hint">Optional · PDF or DOCX · max 5 MB</span></span><label class="upload-box" for="resume"><span class="upload-icon">↑</span><span class="upload-copy"><strong id="resume-name">Choose a resume to personalize questions</strong><small>Your file is parsed for this session and not saved on the server.</small></span><input id="resume" name="resume" type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label></div><div class="field"><span class="field-label">Interview type</span><div class="select-row">${radioChips('type', ['Mixed interview', 'HR', 'Technical', 'Behavioral', 'Resume based'], 'Mixed interview')}</div></div><div class="field"><span class="field-label">Difficulty</span><div class="select-row">${radioChips('difficulty', ['Beginner', 'Intermediate', 'Advanced'], 'Intermediate')}</div></div><div class="field full"><span class="field-label">Coaching language</span><div class="select-row">${radioChips('language', ['Simple English', 'English + Tanglish', 'English + Tamil'], 'English + Tanglish')}</div><span class="field-hint">Interview questions stay in simple English. Coaching follows your preference.</span></div></div><div class="form-actions"><button class="button ghost" type="button" data-page="dashboard">Cancel</button><button class="button primary" type="submit">Prepare my interview <span>→</span></button></div></form><aside class="panel setup-aside"><h3>Your coach will prepare</h3><p>No company facts are guessed. Preparation is based on the role, job description, and resume you provide.</p><div class="prep-point"><span>✓</span><div>Role-focused questions and follow-ups</div></div><div class="prep-point"><span>✓</span><div>Supportive, detailed answer teaching</div></div><div class="prep-point"><span>✓</span><div>A personal report and practice plan</div></div></aside></div>`, 'Interview setup');
	document.querySelector('#resume').addEventListener('change', (event) => { document.querySelector('#resume-name').textContent = event.target.files[0]?.name || 'Choose a resume to personalize questions'; });
	document.querySelector('#setup-form').addEventListener('submit', createInterview);
	const voiceButton = document.querySelector('#setup-form [type="submit"]');
	voiceButton.name = 'mode'; voiceButton.value = 'voice'; voiceButton.textContent = 'Start AI Interview 🎙';
	const textButton = voiceButton.cloneNode(true);
	textButton.value = 'text'; textButton.className = 'button secondary'; textButton.textContent = 'Text Interview';
	voiceButton.before(textButton);
	app.querySelectorAll('[data-page="dashboard"]').forEach((button) => button.addEventListener('click', () => setPage('dashboard')));
}
async function api(path, options = {}) {
	const response = await fetch(path, options); const data = await response.json().catch(() => ({}));
	if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
	return data;
}
async function createInterview(event) {
	event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
	const role = String(data.get('role') || '').trim(); if (!role) return toastMessage('Add a job role to prepare your interview.', true);
	setBusy(form, true);
	try {
		if (event.submitter?.value === 'voice') {
			if (!speechRecognitionAvailable) throw new Error('Speech recognition is not supported in this browser. Choose Text Interview instead.');
			await ensureMicrophone();
		}
		else releaseMicrophone();
		let resumeText = ''; const resume = data.get('resume');
		if (resume?.size) {
			if (resume.size > 5 * 1024 * 1024) throw new Error('Choose a resume smaller than 5 MB.');
			const upload = new FormData(); upload.append('resume', resume); const parsed = await api('/api/resume', { method: 'POST', body: upload }); resumeText = parsed.text;
		}
		const setup = { company: String(data.get('company') || '').trim(), role, description: String(data.get('description') || '').trim(), resumeText, type: data.get('type'), difficulty: data.get('difficulty'), language: data.get('language') };
		const result = await api('/api/interview/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(setup) });
		const session = { id: crypto.randomUUID(), ...setup, profile: result.profile, questions: [{ text: result.question, attempts: [], feedback: [] }], status: 'active', createdAt: Date.now(), updatedAt: Date.now() };
		state.sessions.unshift(session); state.currentId = session.id; state.startedAt = Date.now(); state.draftAnswer = ''; saveSessions(); setPage('interview');
		if (event.submitter?.value === 'voice') speak(result.opening || result.question);
	} catch (error) { releaseMicrophone(); toastMessage(error.message || 'Unable to prepare your interview. Try again.', true); }
	finally { setBusy(form, false); }
}
function setBusy(element, busy) {
	element.classList.toggle('loading', busy); const submit = element.querySelector('[type="submit"]');
	if (submit) { if (busy) submit.dataset.previous = submit.textContent; submit.disabled = busy; submit.textContent = busy ? 'Preparing...' : (submit.dataset.previous || 'Submit'); }
}
function listItems(values) { const items = Array.isArray(values) ? values : [values || 'Add one specific detail to make your point clearer.']; return items.map((value) => `<li>${escapeHtml(value)}</li>`).join(''); }
function renderFeedback(feedback, item) {
	const scores = feedback.scores || {}; const scoreLabels = [['Relevance', 'relevance'], ['Structure', 'structure'], ['Clarity', 'clarity'], ['Confidence', 'confidence']];
	const compare = item.attempts.length > 1 ? `<section class="feedback-section"><h4>Attempt comparison</h4><p>${escapeHtml(feedback.comparison || 'Your retry gives you another chance to make the connection clearer.')}</p></section>` : '';
	return `<div class="feedback-section"><p>${escapeHtml(feedback.spokenResponse || 'Thanks for sharing that. Let’s make the next version even clearer.')}</p></div><div id="detailed-feedback"><section class="feedback-section"><h4>What you said</h4><p>${escapeHtml(feedback.summary || item.attempts.at(-1)?.text || '')}</p></section><div class="score-grid">${scoreLabels.map(([label, key]) => `<div class="score-chip"><span>${label}</span><strong>${escapeHtml(scores[key] ?? '—')}/5</strong></div>`).join('')}</div><section class="feedback-section"><h4>What you did well</h4><ul>${listItems(feedback.strengths)}</ul></section><section class="feedback-section"><h4>What needs improvement</h4><ul>${listItems(feedback.improvements)}</ul></section><section class="feedback-section"><h4>Why it matters</h4><p>${escapeHtml(feedback.why || '')}</p></section><section class="feedback-section"><h4>How to answer</h4><ol>${listItems(feedback.structure)}</ol></section><section class="feedback-section"><h4>Better answer template</h4><div class="answer-example">${escapeHtml(feedback.betterAnswer || '')}</div></section><section class="feedback-section"><h4>Easy speaking version</h4><p>${escapeHtml(feedback.easyVersion || '')}</p></section><section class="feedback-section"><h4>Speaking tip</h4><p>${escapeHtml(feedback.speakingTip || '')}</p></section>${compare}</div><div class="feedback-actions"><button class="button secondary small" data-action="retry">Try this question again</button><button class="button primary small" data-action="continue">Continue interview →</button></div>`;
}
function renderTranscript(item) {
	const lines = item.attempts.map((attempt, index) => `<div class="transcript-line user"><b>You${index ? ` · attempt ${index + 1}` : ''}:</b> ${escapeHtml(attempt.text)}</div>`).join('');
	return `<div class="transcript-line"><b>AI:</b> ${escapeHtml(item.text)}</div>${lines}`;
}
function renderInterview() {
	const previousDraft = document.querySelector('#answer')?.value;
	if (previousDraft !== undefined && !state.busy) state.draftAnswer = previousDraft;
	const session = currentSession(); if (!session) { state.page = 'dashboard'; return renderDashboard(); }
	const item = session.questions.at(-1); const feedback = item.feedback.at(-1); const activeQuestion = session.questions.length;
	renderShell(`<div class="interview-layout"><section class="panel interview-main"><div class="session-meta"><span>${escapeHtml(session.company || 'Interview practice')} · ${escapeHtml(session.role)}</span><span>Question ${activeQuestion} of 6 · <span id="duration">${formatDuration()}</span></span></div><div class="progress-track"><span style="width:${Math.min(100, activeQuestion / QUESTION_LIMIT * 100)}%"></span></div><div class="voice-stage"><div class="voice-orb ${state.voiceState.toLowerCase()}" id="voice-orb" aria-hidden="true">✳</div><strong>InterviewMate AI</strong><div class="voice-status" id="voice-status"><span class="live-indicator"></span>${voiceStatusLabel()}</div></div><div class="question-card"><small>YOUR QUESTION</small><p>${escapeHtml(item.text)}</p></div><div class="transcript" id="transcript" aria-live="polite">${renderTranscript(item)}</div><form class="answer-box" id="answer-form"><textarea id="answer" aria-label="Your answer" placeholder="Type your answer here, or use the microphone to speak…" ${state.busy ? 'disabled' : ''}></textarea><div class="answer-tools"><div class="answer-tool-group"><button class="button secondary small" type="button" data-action="mic" title="Speak your answer">${state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING' ? '■ Stop listening' : '🎙 Start speaking'}</button><button class="button ghost small" type="button" data-action="repeat">↻ Repeat question</button></div><button class="button primary small" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Coach is thinking…' : 'Send answer →'}</button></div><div class="answer-tools"><span class="answer-hint">Your answer stays private in this browser.</span><div class="answer-tool-group"><button class="button ghost small" type="button" data-action="mute">${state.speechMuted ? 'Speaker on' : 'Speaker off'}</button><button class="button ghost small" type="button" data-action="pause">${state.voiceState === 'PAUSED' ? 'Resume voice' : 'Pause voice'}</button><button class="button danger small" type="button" data-action="end">End interview</button></div></div></form></section><aside class="panel feedback-panel"><div class="feedback-header"><div><h3>Answer coaching</h3><div class="muted">Specific feedback that helps you improve.</div></div>${feedback ? `<span class="tag">${item.source === 'ai' ? 'AI coaching' : 'Local coaching'}</span>` : ''}</div><div class="feedback-content">${feedback ? renderFeedback(feedback, item) : '<div class="feedback-empty">After your answer, your coach will help you see what came through, what is missing, and how to try again.</div>'}</div></aside></div>`, 'Your mock interview', 'LIVE PRACTICE');
	renderShell(`<div class="interview-layout"><section class="panel interview-main"><div class="session-meta"><span>${escapeHtml(session.company || 'Interview practice')} · ${escapeHtml(session.role)}</span><span>Question ${activeQuestion} of 6 · <span id="duration">${formatDuration()}</span></span></div><div class="progress-track"><span style="width:${Math.min(100, activeQuestion / QUESTION_LIMIT * 100)}%"></span></div><div class="voice-stage"><div class="voice-orb ${state.voiceState.toLowerCase()}" id="voice-orb" aria-hidden="true">✳</div><strong>InterviewMate AI</strong><div class="voice-status" id="voice-status"><span class="live-indicator"></span>${voiceStatusLabel()}</div></div><div class="question-card"><small>YOUR QUESTION</small><p>${escapeHtml(item.text)}</p></div><div class="transcript" id="transcript" aria-live="polite">${renderTranscript(item)}</div><form class="answer-box" id="answer-form"><textarea id="answer" aria-label="Your answer" placeholder="Type your answer here, or use the microphone to speak…" ${state.busy ? 'disabled' : ''}></textarea><div class="answer-tools"><div class="answer-tool-group"><button class="button secondary small" type="button" data-action="mic" title="Speak your answer">${state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING' ? '■ Stop listening' : '🎙 Start speaking'}</button><button class="button ghost small" type="button" data-action="repeat">↻ Repeat question</button></div><button class="button primary small" type="submit" ${state.busy ? 'disabled' : ''}>${state.busy ? 'Coach is thinking…' : 'Send answer →'}</button></div><div class="answer-tools"><span class="answer-hint">Your answer stays private in this browser.</span><div class="answer-tool-group"><button class="button ghost small" type="button" data-action="mute">${state.speechMuted ? 'Speaker on' : 'Speaker off'}</button><button class="button ghost small" type="button" data-action="pause">${state.voiceState === 'PAUSED' ? 'Resume voice' : 'Pause voice'}</button><button class="button danger small" type="button" data-action="end">End interview</button></div></div></form></section><aside class="panel feedback-panel"><div class="feedback-header"><div><h3>Answer coaching</h3><div class="muted">Specific feedback that helps you improve.</div></div>${feedback ? `<span class="tag">${item.source === 'ai' ? 'AI coaching' : 'Local coaching'}</span>` : ''}</div><div class="feedback-content">${feedback ? renderFeedback(feedback, item) : '<div class="feedback-empty">After your answer, your coach will help you see what came through, what is missing, and how to try again.</div>'}</div></aside></div>`, 'Your mock interview', 'LIVE PRACTICE');
	const counter = app.querySelector('.session-meta span:last-child');
	counter.innerHTML = counter.innerHTML.replace('of 6 ·', `of ${QUESTION_LIMIT} ·`);
	const visualOrb = document.querySelector('#voice-orb');
	const microphoneButton = document.createElement('button');
	microphoneButton.type = 'button'; microphoneButton.id = 'voice-orb'; microphoneButton.dataset.action = 'mic';
	microphoneButton.className = `voice-orb ${voiceVisualState()}`; microphoneButton.title = 'Start or stop speaking'; microphoneButton.setAttribute('aria-label', 'Start speaking');
	microphoneButton.textContent = '🎙'; visualOrb.replaceWith(microphoneButton);
	const answerField = document.querySelector('#answer');
	answerField.value = state.draftAnswer;
	answerField.addEventListener('input', () => { state.draftAnswer = answerField.value; });
	document.querySelector('#answer-form').addEventListener('submit', submitAnswer);
	app.querySelectorAll('[data-action="mic"]').forEach((button) => button.addEventListener('click', toggleListening));
	app.querySelector('[data-action="repeat"]').addEventListener('click', () => speak(item.text));
	app.querySelector('[data-action="mute"]').addEventListener('click', () => {
		state.speechMuted = !state.speechMuted;
		if (state.speechMuted) { state.speechToken += 1; window.speechSynthesis?.cancel(); stopVAD(); state.voiceState = 'IDLE'; }
		renderInterview();
		if (state.speechMuted && state.voiceEnabled) startListening();
	});
	app.querySelector('[data-action="pause"]').addEventListener('click', togglePause);
	app.querySelector('[data-action="end"]').addEventListener('click', finishInterview);
	app.querySelector('[data-action="retry"]')?.addEventListener('click', () => { state.draftAnswer = ''; document.querySelector('#answer').focus(); document.querySelector('#answer').value = ''; stopVoice(); if (state.voiceEnabled) startListening(); });
	app.querySelector('[data-action="continue"]')?.addEventListener('click', continueInterview);
	if (!state.clockTimer) state.clockTimer = setInterval(updateDuration, 1000);
}
async function submitAnswer(event) {
	event.preventDefault(); const answerField = document.querySelector('#answer'); const answer = answerField.value.trim();
	if (!answer) return toastMessage('Share a little about your answer first.', true);
	state.draftAnswer = '';
	const session = currentSession(); const item = session.questions.at(-1); item.attempts.push({ text: answer, at: Date.now() }); session.updatedAt = Date.now();
	state.busy = true; stopVoice(); state.voiceState = 'PROCESSING'; renderInterview();
	try {
		const response = await api('/api/interview/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: item.text, answer, attempts: item.attempts.map((attempt) => attempt.text), setup: session, profile: session.profile }) });
		item.feedback.push(response.feedback); item.source = response.source; state.voiceState = 'IDLE'; state.busy = false; state.draftAnswer = ''; saveSessions(); renderInterview();
		if (state.voiceEnabled) speak(response.feedback.spokenResponse);
	} catch (error) { item.attempts.pop(); state.voiceState = 'IDLE'; state.busy = false; state.draftAnswer = answer; renderInterview(); toastMessage(error.message || 'Your answer could not be analyzed. Please try again.', true); }
}
async function continueInterview() {
	const session = currentSession(); const latest = session.questions.at(-1);
	if (!latest.feedback.length) return;
	if (session.questions.length >= QUESTION_LIMIT) return finishInterview();
	state.busy = true; const button = app.querySelector('[data-action="continue"]');
	if (button) { button.disabled = true; button.textContent = 'Preparing next question…'; }
	try {
		const result = await api('/api/interview/next', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setup: session, history: session.questions.map((question) => ({ question: question.text, attempts: question.attempts.map((attempt) => attempt.text) })) }) });
		session.questions.push({ text: result.question, attempts: [], feedback: [] }); session.updatedAt = Date.now(); state.voiceState = 'IDLE'; state.busy = false; state.draftAnswer = ''; saveSessions(); renderInterview();
		if (state.voiceEnabled) speak(result.question);
	} catch (error) { state.busy = false; renderInterview(); toastMessage(error.message || 'Could not prepare the next question.', true); }
}
function buildReport(session) {
	const feedback = session.questions.flatMap((item) => item.feedback);
	const categories = [['Communication', 'clarity'], ['Answer structure', 'structure'], ['Technical knowledge', 'accuracy'], ['English', 'grammar'], ['Confidence', 'confidence'], ['Role relevance', 'relevance'], ['Problem solving', 'problemSolving'], ['Project explanation', 'projectExplanation'], ['HR readiness', 'hrReadiness']];
	const scores = categories.map(([label, key]) => { const values = feedback.map((item) => item.scores?.[key]).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value))).map(Number); return { label, score: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length * 20) : null }; });
	const strengths = [...new Set(feedback.flatMap((item) => item.strengths || []))].slice(0, 4);
	const needs = [...new Set(feedback.flatMap((item) => item.improvements || []))].slice(0, 4);
	const plan = [['Day 1', 'Tell me about yourself; Why this role?'], ['Day 2', 'Explain one project using problem, action, and result.'], ['Day 3', 'Review role-specific technical fundamentals.'], ['Day 4', 'Practice a behavioral answer using STAR.'], ['Day 5', 'Complete a full mock interview and compare your answers.']];
	return { scores, strengths, needs, plan, summary: `You practiced ${session.questions.length} questions for ${session.role}. Keep the strongest parts of your answers and focus your next practice on the feedback below.` };
}
function renderReport() {
	const session = currentSession(); if (!session?.report) { state.page = 'dashboard'; return renderDashboard(); }
	const report = session.report;
	renderShell(`<div class="report-header"><div><div class="eyebrow">SESSION COMPLETE · ${new Date(session.updatedAt).toLocaleDateString()}</div><h2 class="page-title">A clear next step for your practice</h2><p class="muted">${escapeHtml(report.summary)}</p></div><button class="button primary" data-action="new">Start another interview →</button></div><section class="report-grid">${report.scores.map((score) => `<div class="panel report-score"><strong>${escapeHtml(score.label)}</strong><span>${score.score === null ? 'Not scored' : `${score.score}%`}</span></div>`).join('')}</section><div class="report-columns"><section class="panel"><h3>What is working</h3><ul class="report-list">${listItems(report.strengths.length ? report.strengths : ['You completed a full practice session and identified areas to build on.'])}</ul></section><section class="panel"><h3>Worth practicing next</h3><ul class="report-list">${listItems(report.needs.length ? report.needs : ['Add concrete examples and structure to your answers.'])}</ul></section></div><section class="panel" style="margin-top:14px"><h3>Your next practice plan</h3><div style="margin-top:10px">${report.plan.map(([day, task]) => `<div class="day-plan"><strong>${day}</strong> · ${escapeHtml(task)}</div>`).join('')}</div></section><div class="section-heading"><div><h2>Review your answers</h2><p>Return to the details and attempt comparisons from this session.</p></div><button class="button secondary small" data-action="review">Review coaching</button></div>`, 'Your interview report', 'A MOMENT TO REFLECT');
	app.querySelector('[data-action="new"]').addEventListener('click', () => setPage('setup'));
	app.querySelector('[data-action="review"]').addEventListener('click', () => { state.page = 'interview'; render(); });
}
function renderHistory() {
	const sessions = [...state.sessions].sort((a, b) => b.updatedAt - a.updatedAt);
	renderShell(`<div class="history-list">${sessions.length ? sessions.map((session) => `<div class="history-row"><div><strong>${escapeHtml(session.company || session.role)}</strong><small>${escapeHtml(session.role)} · ${escapeHtml(session.type)} · ${new Date(session.updatedAt).toLocaleDateString()} · ${session.questions.length} questions</small></div><button class="button secondary small" data-open-session="${session.id}">${session.status === 'completed' ? 'View report' : 'Resume interview'}</button></div>`).join('') : '<div class="panel empty">No interviews yet. Your completed practice sessions will appear here.</div>'}</div>`, 'Interview history');
	app.querySelectorAll('[data-open-session]').forEach((button) => button.addEventListener('click', () => openSession(button.dataset.openSession)));
}
function openSession(id) { state.currentId = id; const session = currentSession(); state.startedAt = session?.createdAt || Date.now(); state.page = session?.status === 'completed' ? 'report' : 'interview'; render(); }
function formatDuration() { const seconds = Math.max(0, Math.floor((Date.now() - (state.startedAt || Date.now())) / 1000)); return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`; }
function updateDuration() { const duration = document.querySelector('#duration'); if (duration) duration.textContent = formatDuration(); }
function voiceStatusLabel() { return ({ IDLE: 'Ready when you are', LISTENING: 'Listening · speak naturally', USER_SPEAKING: 'I’m listening to your answer', PROCESSING: 'Thinking through your answer…', AI_SPEAKING: 'Speaking · you can interrupt', PAUSED: 'Voice paused', ENDED: 'Interview ended' })[state.voiceState] || 'Ready when you are'; }
function updateVoiceState() {
	const status = document.querySelector('#voice-status'); const orb = document.querySelector('#voice-orb');
	if (status) status.innerHTML = `<span class="live-indicator"></span>${voiceStatusLabel()}`;
	if (orb) { orb.className = `voice-orb ${voiceVisualState()}`; orb.setAttribute('aria-label', state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING' ? 'Stop listening' : 'Start speaking'); }
	app.querySelectorAll('[data-action="mic"]').forEach((mic) => { if (mic.id !== 'voice-orb') mic.textContent = state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING' ? '■ Stop listening' : '🎙 Start speaking'; });
}
function voiceVisualState() {
	if (state.voiceState === 'AI_SPEAKING') return 'speaking';
	if (state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING') return 'listening';
	if (state.voiceState === 'PROCESSING') return 'thinking';
	return state.voiceState.toLowerCase();
}
async function ensureMicrophone() {
	if (!navigator.mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser. You can type your answer instead.');
	if (!state.microphoneStream) state.microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
	state.voiceEnabled = true;
}
async function toggleListening() {
	if (state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING') return stopListening();
	if (!speechRecognitionAvailable) return toastMessage('Speech recognition is not supported here. You can type your answer instead.', true);
	try { await ensureMicrophone(); startListening(); }
	catch (error) { toastMessage(error.message.includes('denied') ? 'Microphone permission is required for voice interviews. Allow access in your browser settings, then try again.' : error.message, true); }
}
function startListening() {
	if (!speechRecognitionAvailable) return;
	stopVAD(); const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition; const recognition = new Recognition();
	const language = currentSession()?.language || '';
	recognition.lang = language === 'English + Tamil' ? 'ta-IN' : language.includes('Tanglish') ? 'en-IN' : 'en-US';
	recognition.continuous = true; recognition.interimResults = true; state.recognition = recognition; state.voiceState = 'LISTENING';
	state.noSpeechTimer = setTimeout(() => { stopListening(); toastMessage('I did not hear any speech. Try again or type your answer.', true); }, 30_000);
	recognition.onstart = () => { state.voiceState = 'USER_SPEAKING'; updateVoiceState(); };
	recognition.onresult = (event) => {
		let interimTranscript = '';
		for (let index = event.resultIndex; index < event.results.length; index += 1) {
			const segment = event.results[index][0].transcript;
			if (event.results[index].isFinal) state.draftAnswer += `${segment} `;
			else interimTranscript += segment;
		}
		const transcript = `${state.draftAnswer}${interimTranscript}`.trim();
		const answer = document.querySelector('#answer'); if (answer) answer.value = transcript;
			const transcriptView = document.querySelector('#transcript');
			if (transcriptView) transcriptView.innerHTML = `${renderTranscript(currentSession().questions.at(-1))}<div class="transcript-line user"><b>You:</b> ${escapeHtml(transcript)}</div>`;
		state.voiceState = 'USER_SPEAKING'; updateVoiceState(); clearTimeout(state.silenceTimer); clearTimeout(state.noSpeechTimer);
		state.noSpeechTimer = setTimeout(() => { stopListening(); toastMessage('I did not hear any speech. Try again or type your answer.', true); }, 30_000);
		if (event.results[event.results.length - 1].isFinal) state.silenceTimer = setTimeout(submitRecognizedAnswer, 1200);
	};
	recognition.onerror = (event) => {
		if (event.error === 'not-allowed' || event.error === 'service-not-allowed') toastMessage('Microphone permission is required. Allow access, then try again.', true);
		else if (event.error === 'no-speech') toastMessage('I didn’t hear any speech. Try again or type your answer.', true);
		else if (event.error !== 'aborted') toastMessage('Speech recognition had a problem. You can type your answer instead.', true);
		stopListening();
	};
	recognition.onend = () => { if (state.recognition !== recognition) return; if (state.voiceState === 'USER_SPEAKING' && document.querySelector('#answer')?.value.trim()) submitRecognizedAnswer(); else if (state.voiceState === 'LISTENING') { state.voiceState = 'IDLE'; updateVoiceState(); } };
	try { recognition.start(); updateVoiceState(); } catch { toastMessage('Could not start speech recognition. Try again or type your answer.', true); state.voiceState = 'IDLE'; updateVoiceState(); }
}
function submitRecognizedAnswer() { const form = document.querySelector('#answer-form'); if (!form || state.busy) return; clearTimeout(state.silenceTimer); stopListening(); form.requestSubmit(); }
function stopListening() {
	clearTimeout(state.silenceTimer); clearTimeout(state.noSpeechTimer); const recognition = state.recognition; state.recognition = null;
	if (recognition) { recognition.onend = null; try { recognition.stop(); } catch { /* already stopped */ } }
	if (state.voiceState === 'LISTENING' || state.voiceState === 'USER_SPEAKING') state.voiceState = 'IDLE'; updateVoiceState();
}
async function speak(text) {
	if (!text || state.speechMuted) { state.voiceState = 'IDLE'; updateVoiceState(); if (state.voiceEnabled && state.page === 'interview') startListening(); return; }
	if (!('speechSynthesis' in window)) { state.voiceState = 'IDLE'; updateVoiceState(); toastMessage('Text-to-speech is unavailable. You can read the question and continue by voice or text.'); if (state.voiceEnabled && state.page === 'interview') startListening(); return; }
	await ensureMicrophone().catch(() => {}); window.speechSynthesis.cancel();
	const speechToken = ++state.speechToken;
	const speechText = String(text).replace(/[\p{Extended_Pictographic}*_#>`•]/gu, '').replace(/\s+/g, ' ').trim();
	const language = currentSession()?.language || '';
	const utterance = new SpeechSynthesisUtterance(speechText);
	utterance.rate = 0.94; utterance.pitch = 1; utterance.lang = /[\u0B80-\u0BFF]/.test(speechText) ? 'ta-IN' : language.includes('Tanglish') ? 'en-IN' : 'en-US';
	utterance.onstart = () => { if (speechToken !== state.speechToken) return; state.voiceState = 'AI_SPEAKING'; updateVoiceState(); startVAD(); };
	utterance.onend = () => { if (speechToken !== state.speechToken) return; stopVAD(); state.voiceState = 'IDLE'; updateVoiceState(); if (state.voiceEnabled && state.page === 'interview') startListening(); };
	utterance.onerror = () => { if (speechToken !== state.speechToken) return; stopVAD(); state.voiceState = 'IDLE'; updateVoiceState(); toastMessage('Voice playback is unavailable. You can continue by reading the coaching.'); };
	window.speechSynthesis.speak(utterance);
}
function startVAD() {
	stopVAD(); if (!state.microphoneStream) return;
	try {
		const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) return;
		state.audioContext ||= new AudioContextClass(); const source = state.audioContext.createMediaStreamSource(state.microphoneStream); const analyser = state.audioContext.createAnalyser();
		analyser.fftSize = 512; source.connect(analyser); const samples = new Uint8Array(analyser.fftSize); let loudSince = 0;
		const check = () => {
			if (state.voiceState !== 'AI_SPEAKING') return;
			analyser.getByteTimeDomainData(samples); let energy = 0; for (const sample of samples) energy += ((sample - 128) / 128) ** 2;
			const rms = Math.sqrt(energy / samples.length); if (rms > 0.13) loudSince ||= Date.now(); else loudSince = 0;
			if (loudSince && Date.now() - loudSince > 240) { state.speechToken += 1; window.speechSynthesis.cancel(); stopVAD(); state.voiceState = 'IDLE'; startListening(); return; }
			state.vadFrame = requestAnimationFrame(check);
		};
		state.vadFrame = requestAnimationFrame(check);
	} catch { stopVAD(); }
}
function stopVAD() { if (state.vadFrame) cancelAnimationFrame(state.vadFrame); state.vadFrame = null; }
function togglePause() {
	if (state.voiceState === 'PAUSED') { state.voiceState = 'IDLE'; updateVoiceState(); if (state.voiceEnabled) speak(currentSession()?.questions.at(-1)?.text); }
	else { state.speechToken += 1; stopListening(); stopVAD(); window.speechSynthesis?.cancel(); state.voiceState = 'PAUSED'; updateVoiceState(); }
	renderInterview();
}
function stopVoice() { state.speechToken += 1; stopListening(); stopVAD(); window.speechSynthesis?.cancel(); if (state.voiceState !== 'ENDED') state.voiceState = 'IDLE'; }
function releaseMicrophone() {
	state.microphoneStream?.getTracks().forEach((track) => track.stop());
	state.microphoneStream = null; state.voiceEnabled = false;
	if (state.audioContext) { state.audioContext.close().catch(() => {}); state.audioContext = null; }
}
function finishInterview() {
	stopVoice(); releaseMicrophone(); const session = currentSession(); if (!session) return;
	session.status = 'completed'; session.updatedAt = Date.now(); session.report = buildReport(session); saveSessions();
	clearInterval(state.clockTimer); state.clockTimer = null; state.page = 'report'; render();
}
function openSession(id) { state.currentId = id; state.draftAnswer = ''; const session = currentSession(); state.startedAt = session?.createdAt || Date.now(); state.page = session?.status === 'completed' ? 'report' : 'interview'; render(); }
document.addEventListener('click', (event) => {
	const button = event.target.closest('[data-open-session]'); if (button) openSession(button.dataset.openSession);
});
render();
