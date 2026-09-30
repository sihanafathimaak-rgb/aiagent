'use strict';

async function extractResume(file) {
  if (!file) throw Object.assign(new Error('Choose a resume file first.'), { status: 400 });
  const filename = String(file.originalname || '').toLowerCase();
  let text;
  try {
    if (filename.endsWith('.pdf')) {
      const parsePdf = require('pdf-parse');
      const result = await parsePdf(file.buffer);
      text = result.text;
    } else if (filename.endsWith('.docx')) {
      const mammoth = require('mammoth');
      const result = await mammoth.extractRawText({ buffer: file.buffer });
      text = result.value;
    } else {
      throw Object.assign(new Error('Only PDF and DOCX resumes are supported.'), { status: 415 });
    }
  } catch (error) {
    if (error.status) throw error;
    throw Object.assign(new Error('Could not read this resume. Try a valid text-based PDF or DOCX file.'), { status: 422 });
  }
  const cleaned = String(text || '').replace(/\u0000/g, '').replace(/[\t ]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 12_000);
  if (cleaned.length < 20) throw Object.assign(new Error('Could not extract readable text. Try a text-based PDF or DOCX file.'), { status: 422 });
  return { text: cleaned, filename: file.originalname };
}

module.exports = { extractResume };