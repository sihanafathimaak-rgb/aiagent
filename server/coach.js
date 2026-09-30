'use strict';

const MAX_CONTEXT_CHARS = 12_000;
const SKILLS = [
  'Python', 'JavaScript', 'TypeScript', 'Java', 'C++', 'C#', 'SQL', 'React', 'Node.js', 'Express',
  'HTML', 'CSS', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'Git', 'Linux', 'Machine Learning', 'Data Analysis',
  'Communication', 'Problem Solving', 'Leadership', 'Project Management', 'Customer Service',
];

const QUESTION_BANK = {
  HR: [
    'Tell me about yourself and what brings you to this role.',
    'What interests you about this role, based on what you know so far?',
    'Tell me about a time you received feedback and what you did with it.',
    'What is one strength you would bring to this team? Give me an example.',
    'Tell me about a challenge you worked through and what you learned.',
    'What would you like to ask about the role or team?',
    'How do you decide which tasks to prioritize when several are important?',
    'Tell me about a time you worked toward a shared team goal.',
    'What kind of feedback helps you do your best work?',
    'What would you hope to learn in your first few months in this role?',
  ],
  Technical: [
    'Walk me through a technical problem you have solved and the approach you chose.',
    'What is one technical concept you use often, and how would you explain it to a new teammate?',
    'How do you investigate a bug when the cause is not immediately clear?',
    'Tell me about a design or implementation trade-off you have considered.',
    'How would you test a change before releasing it?',
    'Describe a technical concept relevant to this role and give a practical example.',
    'How would you investigate a performance issue in an application?',
    'What trade-off would you consider when choosing between two implementation approaches?',
    'How do you decide what should be covered by an automated test?',
    'How would you explain a recent technical decision to a non-technical teammate?',
  ],
  Behavioral: [
    'Tell me about a time you worked with someone who had a different approach from yours.',
    'Describe a challenge you faced, what you were responsible for, and how it turned out.',
    'Tell me about a time you had to learn something quickly to finish a task.',
    'Describe a mistake or setback and how you responded.',
    'Tell me about a time you helped a team make progress.',
    'What is a piece of feedback that changed how you work?',
    'Tell me about a time you had to balance competing priorities.',
    'Describe a time you changed your approach after learning new information.',
    'How have you handled a disagreement while keeping work moving?',
    'What is a team contribution you are proud of, and why?',
  ],
  'Resume based': [
    'Walk me through a project or experience from your resume that is relevant to this role.',
    'What was your specific contribution to the project you listed?',
    'What challenge did you encounter in that experience, and how did you handle it?',
    'Which skill on your resume have you used most recently? Give me an example.',
    'What would you improve if you revisited one of your listed projects?',
    'How did your education or experience prepare you for this role?',
    'What was the most important decision you made in a listed project?',
    'How did you check whether the project worked as intended?',
    'What skill from your resume would you most like to demonstrate in this role?',
    'What did you learn from an experience on your resume that you still use?',
  ],
  'Mixed interview': [
    'Tell me about yourself and what interests you about this role.',
    'Choose a project or task you are proud of. What problem did it solve?',
    'Explain one skill relevant to this role and how you have used it.',
    'Tell me about a time you had to solve an unfamiliar problem.',
    'What is one strength you would bring to this team? Give me an example.',
    'What would you like to ask about the role?',
    'Explain a technical concept or tool that is useful in this field.',
    'Tell me about a time you received feedback and used it to improve.',
    'How would you approach an unfamiliar task with a tight deadline?',
    'What is one question you would ask to understand the team’s priorities?',
  ],
};

function text(value, limit = 2000) {
  return typeof value === 'string' ? value.slice(0, limit).trim() : '';
}

function buildProfile(setup = {}) {
  const resumeText = text(setup.resumeText, 12_000);
  const description = text(setup.description, 5000);
  const sourceText = `${resumeText}\n${description}`;
  const skills = SKILLS.filter((skill) => new RegExp(`(^|[^a-z0-9])${escapeRegex(skill)}([^a-z0-9]|$)`, 'i').test(sourceText));
  const projects = resumeText.split(/\n+/).filter((line) => /project|built|developed|created|implemented/i.test(line)).slice(0, 4);
  const likelyAreas = new Set();
  const interviewType = text(setup.type, 40);
  if (interviewType === 'Mixed interview' || interviewType === 'Technical') likelyAreas.add('Role-related technical fundamentals');
  if (interviewType === 'Mixed interview' || interviewType === 'HR') likelyAreas.add('Motivation and role fit');
  if (interviewType === 'Mixed interview' || interviewType === 'Behavioral') likelyAreas.add('Behavioral examples and collaboration');
  if (interviewType === 'Resume based' || resumeText) likelyAreas.add('Resume projects and experience');
  if (description) likelyAreas.add('Responsibilities named in the job description');
  return {
    company: text(setup.company, 120) || null,
    role: text(setup.role, 160),
    skills,
    projects,
    likelyAreas: [...likelyAreas],
    suppliedExperience: resumeText.length > 0,
    basis: [description && 'user-provided job description', resumeText && 'user-provided resume'].filter(Boolean),
  };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function answerShape(question, answer) {
  const lower = question.toLowerCase();
	if (/tell me about yourself|introduce yourself/.test(lower) && /interest|role/.test(lower)) return ['Present situation or education', 'Relevant skills and one real example', 'Why this role is a good next step'];
  if (/tell me about yourself|introduce yourself/.test(lower)) return ['Present situation or education', 'Relevant skills', 'A project or example', 'Why this role is a good next step'];
  if (/why (do you want|are you interested)|why this (company|role)/.test(lower)) return ['A specific reason based on information provided', 'Why this role fits your interests or skills', 'One contribution you could make'];
  if (/why should we hire|what (would|can) you bring/.test(lower)) return ['Relevant skill', 'Evidence from a real example', 'How that skill could help in this role'];
  if (/strength/.test(lower)) return ['Name one relevant strength', 'Give a specific example', 'Describe the result or lesson'];
  if (/weakness/.test(lower)) return ['Choose a genuine, manageable area', 'Explain what you are doing to improve', 'Share a concrete sign of progress'];
  if (/project|built|developed/.test(lower)) return ['Problem or goal', 'Your specific role', 'Approach and tools', 'Result and what you learned'];
  if (/tell me about a time|describe a time|challenge|feedback|collaborat/.test(lower)) return ['Situation and task', 'Actions you personally took', 'Result and reflection (STAR)'];
  if (/what is|explain|how does|difference between/.test(lower)) return ['Clear definition', 'Plain-language explanation', 'Example', 'Practical use or trade-off'];
  if (/how would you/.test(lower)) return ['Clarify the goal', 'Explain an ordered approach', 'Mention a check or trade-off'];
  if (answer.length < 45) return ['State your main point', 'Add one specific example or reason', 'Connect it to the role'];
  return ['Lead with the main point', 'Support it with a specific example', 'Explain the outcome or relevance to the role'];
}

function analyzeLocally({ question, answer, attempts = [], setup = {} }) {
  const cleanAnswer = text(answer, 5000);
  const words = cleanAnswer.split(/\s+/).filter(Boolean);
  const sentences = cleanAnswer.split(/[.!?]+/).filter((part) => part.trim());
  const hasExample = /\b(for example|for instance|such as|I (built|created|led|worked|developed|solved|learned)|we (built|created|implemented))\b/i.test(cleanAnswer);
  const hasReasoning = /\b(because|so that|therefore|as a result|which meant|this helped)\b/i.test(cleanAnswer);
  const hasOutcome = /\b(result|improv|reduc|increas|learn|completed|success|impact|achiev|user|customer)\w*\b/i.test(cleanAnswer);
  const hasRoleConnection = /\b(role|position|team|company|job|skill|contribut|relevant)\w*\b/i.test(cleanAnswer);
  const questionWords = new Set(text(question, 300).toLowerCase().match(/[a-z]{4,}/g) || []);
  const answerWords = new Set(cleanAnswer.toLowerCase().match(/[a-z]{4,}/g) || []);
  const overlap = [...questionWords].filter((word) => answerWords.has(word)).length;
  const relevance = Math.min(5, Math.max(2, 2 + Number(overlap > 0) + Number(overlap > 2) + Number(answer.length > 90)));
  const structure = Math.min(5, Math.max(1, 1 + Number(sentences.length >= 2) + Number(hasExample) + Number(hasOutcome) + Number(words.length > 65)));
  const clarity = Math.min(5, Math.max(2, 3 + Number(sentences.length >= 2) - Number(words.length > 115) - Number(/\b(umm+|like like|you know you know)\b/i.test(cleanAnswer))));
  const confidence = Math.min(5, Math.max(2, 2 + Number(words.length >= 25) + Number(words.length >= 55) + Number(!/\b(i don't know|not sure)\b/i.test(cleanAnswer))));
  const scores = { relevance, structure, clarity, confidence, accuracy: null, grammar: null, problemSolving: null, projectExplanation: null, hrReadiness: null };
  const strengths = [];
  const improvements = [];
  if (answer.length < 25) {
    strengths.push('You gave a starting point instead of staying silent.');
    improvements.push('This answer is very brief; add one reason and a concrete example to show what you mean.');
  } else {
    strengths.push('Your main idea is understandable.');
    if (hasExample) strengths.push('You included an example, which makes the answer more specific.');
    if (hasReasoning) strengths.push('You explained some of your reasoning.');
    if (hasOutcome) strengths.push('You mentioned an outcome or what you learned.');
    if (!hasExample) improvements.push('Add one real example so the interviewer can see how you applied this.');
    if (!hasOutcome) improvements.push('Explain the result, impact, or what you learned.');
    if (!hasRoleConnection) improvements.push('Connect your point to the responsibilities or skills in this role.');
    if (words.length > 115) improvements.push('Tighten the answer to a few clear points so your main idea stands out.');
    if (!improvements.length) improvements.push('Make the example more concrete by naming your own action and the result.');
  }
  const summary = `Your answer says: “${cleanAnswer.replace(/[.!?]+$/, '')}.”`;
  const structureSteps = answerShape(question, cleanAnswer);
  const betterAnswer = buildExample(question, setup, cleanAnswer, structureSteps);
  const easyVersion = buildEasyVersion(question, setup);
  const previous = attempts.length > 1 ? text(attempts.at(-2), 1000) : '';
  const comparison = previous
    ? `Your first answer was ${previous.split(/\s+/).length} words; this one is ${words.length} words. ${hasExample && !/for example|for instance|I built|I worked/i.test(previous) ? 'You added a concrete example, which makes your point easier to trust.' : 'Keep the clearest part of your first answer and add one specific action or result.'}`
    : '';
  const isTanglish = String(setup.language || '').includes('Tanglish');
  const spokenResponse = isTanglish
    ? `${words.length < 25 ? 'Seri, unga main idea puriyudhu.' : 'Unga answer understandable-ah irukku.'} ${improvements[0] ? 'One important point miss aayirukku. ' : ''}Screen-la detailed feedback irukku. Same question once more try pannunga.`
    : `${words.length < 25 ? 'You have a clear starting point.' : 'Your main idea is understandable.'} ${improvements[0] ? 'One detail can make it stronger.' : ''} I have added a better structure and example on screen. Try this question once more.`;
  return {
    summary,
    strengths: strengths.slice(0, 3),
    improvements: improvements.slice(0, 3),
    why: 'Interviewers need to understand not only what you think, but how you applied it and what changed. A specific example makes your contribution easier to evaluate.',
    structure: structureSteps,
    betterAnswer,
    easyVersion,
    speakingTip: 'Do not memorize the sample. Pause after your main point, use your own example, and finish with what changed or what you learned.',
    spokenResponse,
    scores,
    comparison,
    followUpQuestion: hasExample ? 'What was the most challenging part of that example, and what did you do?' : null,
  };
}

function buildExample(question, setup, answer, structure) {
  if (/what is|explain|how does|difference between/i.test(question)) {
    return `A [concept] is [clear definition]. In simple terms, [plain-language explanation]. For example, [accurate example]. It is useful when [use case].`;
  }
  if (/project|built|developed/i.test(question)) {
    return `One example is [a project or task you actually worked on]. The goal was [problem]. I was responsible for [your contribution]. I used [tool or method], and the result was [outcome]. I learned [lesson relevant to this role].`;
  }
  if (/tell me about yourself|introduce yourself/i.test(question)) {
    return `I am currently [your education or current role]. I have been developing [relevant skills], which I practiced in [a real project or example]. I am interested in this ${setup.role ? `${setup.role} ` : ''}role because [specific reason based on the role].`;
  }
  if (/why (do you want|are you interested)|why this (company|role)/i.test(question)) {
    return `I am interested in this role because [specific reason based on information you have about the role]. I would like to contribute [a relevant skill or experience], and I am keen to keep learning through the work.`;
  }
  return `My main point is [your answer]. One example is [a real situation]. I was responsible for [your action], which led to [result]. I learned [lesson relevant to this role].`;
}

function buildEasyVersion(question, setup) {
  if (/tell me about yourself|introduce yourself/.test(question) && /interest|role/.test(question)) return `I am [your education or current role]. I know [relevant skill]. I practiced it in [real example]. I am interested in this ${setup.role || 'role'} because [your reason].`;
  if (/why (do you want|are you interested)|why this (company|role)/i.test(question)) return 'I want this role because [your reason]. I can contribute [relevant skill]. I also want to keep learning.';
  if (/project|built|developed/i.test(question)) return 'My project was about [problem]. I worked on [your part]. I used [tool or method]. The result was [outcome].';
  if (/what is|explain|how does|difference between/i.test(question)) return '[Concept] means [simple definition]. For example, [short example]. It is useful when [use case].';
  if (/tell me about a time|describe a time|challenge|feedback|collaborat/i.test(question)) return 'The situation was [context]. I needed to [task]. I [action], and the result was [outcome].';
  return 'My main point is [your answer]. One example is [real example]. The result was [outcome].';
}

function chooseQuestion(setup = {}, history = []) {
  const previous = history.map((item) => text(item.question, 300).toLowerCase());
  if (text(setup.resumeText, 20) && !previous.some((question) => /resume|project|experience/.test(question))) {
    return 'Walk me through a project or experience from your resume that is relevant to this role.';
  }
  const type = QUESTION_BANK[setup.type] ? setup.type : 'Mixed interview';
  const questions = QUESTION_BANK[type];
  const lastAnswer = text(history.at(-1)?.attempts?.at(-1), 3000);
  const answerWords = lastAnswer.split(/\s+/).filter(Boolean).length;
  if (history.length && answerWords > 0 && answerWords < 12) {
	return type === 'Technical'
		? 'In simple terms, what is one technical concept you have learned recently?'
		: 'What is one skill you are learning, and where have you practiced it?';
  }
  if (/project|built|developed|created|implemented/i.test(lastAnswer) && !previous.some((question) => question.includes('challenging part'))) {
    return 'What was the most challenging part of that project, and what did you do?';
  }
  if (answerWords > 85 && /for example|for instance|as a result|which led to/i.test(lastAnswer)) {
	return 'Looking back at that example, what would you improve or approach differently next time?';
  }
  const next = questions.find((question) => !previous.includes(question.toLowerCase()));
  return next || questions[history.length % questions.length];
}

function getAiConfig(env = process.env) {
  return { key: env.AI_API_KEY || '', model: env.AI_MODEL || 'gpt-4o-mini', baseUrl: (env.AI_API_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '') };
}

async function requestJson(system, payload, env = process.env) {
  const config = getAiConfig(env);
  if (!config.key) return null;
  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: config.model, temperature: 0.35, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: JSON.stringify(payload) }] }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    const error = new Error(response.status === 401 ? 'The AI provider rejected AI_API_KEY. Check the server environment configuration.' : `The AI provider returned ${response.status}. ${detail.slice(0, 180)}`);
    error.status = 502;
  	if (response.status === 401) error.publicMessage = 'The AI provider rejected AI_API_KEY. Check the server environment configuration.';
    throw error;
  }
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw Object.assign(new Error('The AI provider returned an empty response.'), { status: 502 });
  try { return JSON.parse(content); }
  catch { throw Object.assign(new Error('The AI provider response was not valid JSON. Please try again.'), { status: 502 }); }
}

function normalizeFeedback(data, fallback) {
  const list = (key, alternative) => Array.isArray(data[key]) && data[key].length ? data[key].map((item) => text(item, 500)).filter(Boolean).slice(0, 5) : fallback[alternative];
  const rawScores = data.scores || {};
  const scores = {};
  for (const key of ['relevance', 'accuracy', 'completeness', 'structure', 'clarity', 'grammar', 'vocabulary', 'confidence', 'problemSolving', 'projectExplanation', 'hrReadiness']) {
    if (rawScores[key] === null || rawScores[key] === undefined) scores[key] = fallback.scores[key] ?? null;
    else {
      const score = Number(rawScores[key]);
      scores[key] = Number.isFinite(score) ? Math.max(1, Math.min(5, Math.round(score))) : fallback.scores[key] ?? null;
    }
  }
  return {
    summary: text(data.summary, 1000) || fallback.summary,
    strengths: list('strengths', 'strengths'), improvements: list('improvements', 'improvements'),
    why: text(data.why, 1200) || fallback.why, structure: list('structure', 'structure'),
    betterAnswer: text(data.betterAnswer, 1800) || fallback.betterAnswer,
    easyVersion: text(data.easyVersion, 1000) || fallback.easyVersion,
    speakingTip: text(data.speakingTip, 600) || fallback.speakingTip,
    spokenResponse: text(data.spokenResponse, 280) || fallback.spokenResponse,
    scores, comparison: text(data.comparison, 900) || fallback.comparison,
    followUpQuestion: text(data.followUpQuestion, 300) || fallback.followUpQuestion,
  };
}

async function analyzeAnswer(input, env = process.env) {
  const question = text(input.question, 1000);
  const answer = text(input.answer, 5000);
  if (!question || !answer) throw Object.assign(new Error('A question and answer are required.'), { status: 400 });
  const setup = input.setup && typeof input.setup === 'object' ? input.setup : {};
  const attempts = Array.isArray(input.attempts) ? input.attempts.map((attempt) => text(attempt, 5000)).filter(Boolean).slice(-3) : [answer];
  const fallback = analyzeLocally({ question, answer, attempts, setup });
  const system = `You are InterviewMate AI, a supportive interview teacher, not a grader. Analyze meaning, accuracy, relevance, completeness, structure, clarity, important grammar, vocabulary, confidence cues in wording, examples, and role relevance. Never shame or invent a user's experience or facts about a company. Be honest, kind, specific, and use simple language. Coaching language is ${text(setup.language, 50) || 'Simple English'}; use natural short Tanglish sentences when requested and simple conversational Tamil when requested. Teach the relevant structure (STAR for behavioral stories; definition, explanation, example, use for technical answers). Compare earlier attempts when supplied. Detailed feedback is for the screen; spokenResponse must be under 35 words and have no markdown. Return only a JSON object with keys: summary (string), strengths (string array), improvements (string array), why (string), structure (string array), betterAnswer (string), easyVersion (string), speakingTip (string), spokenResponse (string), scores (integers 1-5 for relevance, accuracy, completeness, structure, clarity, grammar, vocabulary, confidence, problemSolving, projectExplanation, hrReadiness), comparison (string), followUpQuestion (string or null). Keep examples grounded in supplied answer/profile; use clearly framed illustrative wording if no personal example exists. Do not claim to know company information not supplied by the user.`;
  const payload = { question, answer, earlierAttempts: attempts.slice(0, -1), setup: { company: text(setup.company, 120), role: text(setup.role, 160), description: text(setup.description, 3000), type: text(setup.type, 60), difficulty: text(setup.difficulty, 40), language: text(setup.language, 50), resumeSummary: text(setup.resumeText, 3000) }, profile: buildProfile(setup) };
  if (JSON.stringify(payload).length > MAX_CONTEXT_CHARS) {
    payload.setup.description = payload.setup.description.slice(0, 1200);
    payload.setup.resumeSummary = payload.setup.resumeSummary.slice(0, 1800);
  }
  const result = await requestJson(system, payload, env);
  return { feedback: result ? normalizeFeedback(result, fallback) : fallback, source: result ? 'ai' : 'local' };
}

async function prepareInterview(setup = {}, env = process.env) {
  const profile = buildProfile(setup);
  const fallbackQuestion = chooseQuestion(setup, []);
  const system = 'Create one realistic, concise interview opening question based only on details supplied by the user. Never infer company facts. Return JSON with keys question and opening. The opening should welcome the candidate briefly and ask the question.';
  const result = await requestJson(system, { company: profile.company, role: profile.role, interviewType: text(setup.type, 50), difficulty: text(setup.difficulty, 30), description: text(setup.description, 3000), resume: text(setup.resumeText, 3000), fallbackQuestion }, env);
  return { profile, question: text(result?.question, 500) || fallbackQuestion, opening: text(result?.opening, 250) };
}

async function nextQuestion({ setup = {}, history = [] }, env = process.env) {
  const safeHistory = Array.isArray(history) ? history.slice(-8).map((item) => ({ question: text(item.question, 500), attempts: Array.isArray(item.attempts) ? item.attempts.slice(-2).map((answer) => text(answer, 1000)) : [] })) : [];
  const fallbackQuestion = chooseQuestion(setup, safeHistory);
  const system = 'Act as a thoughtful interview interviewer. Continue naturally from the conversation: ask one specific follow-up if the candidate mentioned a concrete project, decision, or experience; otherwise ask the next relevant question. If recent answers are short or incomplete, use a simpler question; if they are specific, complete, and supported with examples, increase the challenge. Respect the selected difficulty. Do not repeat prior questions. Do not invent resume details or company facts. Return only JSON with question.';
  const result = await requestJson(system, { role: text(setup.role, 160), type: text(setup.type, 50), difficulty: text(setup.difficulty, 30), suppliedResume: text(setup.resumeText, 2000), history: safeHistory }, env);
  return { question: text(result?.question, 500) || fallbackQuestion };
}

module.exports = { analyzeAnswer, analyzeLocally, buildProfile, chooseQuestion, nextQuestion, prepareInterview };