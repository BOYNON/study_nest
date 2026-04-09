const express = require('express');
const router = express.Router();

// ─────────────────────────────────────────────
// GET /api/messages — load chat history
// ─────────────────────────────────────────────
router.get('/messages', async (req, res) => {
  if (!req.session?.userId) {
    return res.status(401).json({ messages: [] });
  }

  try {
    const mongoose = require('mongoose');
    if (mongoose.connection.readyState !== 1) {
      return res.json({ messages: [] });
    }

    const Message = require('../models/Message');
    const room    = req.query.room  || 'general';
    const limit   = Math.min(Number(req.query.limit) || 200, 500);

    const messages = await Message
      .find({ room, deleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .limit(limit)
      .lean();

    res.json({ messages });
  } catch (err) {
    console.error('Failed to load messages:', err);
    res.status(500).json({ messages: [] });
  }
});

// ─────────────────────────────────────────────
// Gemini AI helper
// ─────────────────────────────────────────────
function buildPrompt(question, subject, classNum) {
  return `You are a helpful study assistant for Class ${classNum || 'school'} students. Answer clearly, simply and briefly. Subject: ${subject || 'general'}.

Question: ${question}`;
}

async function askGemini(question, subject, classNum) {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
  if (!apiKey) return null;

  const fetchFn = global.fetch || (await import('node-fetch')).default;
  const modelCandidates = [
    'gemini-2.5-flash',
    'gemini-2.5-flash-latest',
    'gemini-1.5-flash',
    'gemini-flash-latest',
  ];

  let lastError = null;
  for (const model of modelCandidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: buildPrompt(question, subject, classNum) }] }],
        generationConfig: { maxOutputTokens: 512, temperature: 0.7 },
      };

      const resp = await fetchFn(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await resp.json().catch(() => ({}));
      const answer = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('').trim();

      if (resp.ok && answer) {
        return { answer, model };
      }

      lastError = `${model}: ${data?.error?.message || `HTTP ${resp.status}`}`;
    } catch (err) {
      lastError = `${model}: ${err.message}`;
    }
  }

  throw new Error(lastError || 'Gemini request failed');
}

// POST /api/ask — AI Answer Helper
router.post('/ask', async (req, res) => {
  const { question, subject, classNum } = req.body;
  if (!question || question.trim().length < 3) {
    return res.json({ success: false, error: 'Please enter a valid question.' });
  }

  try {
    const result = await askGemini(question.trim(), subject, classNum);
    if (result?.answer) {
      return res.json({ success: true, answer: result.answer, provider: 'gemini', model: result.model });
    }
  } catch (err) {
    console.error('Gemini API error:', err.message);
    return res.status(502).json({
      success: false,
      error: 'Gemini API did not return a valid answer. Check the API key, project permissions, and model access.',
    });
  }

  const mocks = [
    `Great question! 🌟 For **"${question}"**, here's a simple explanation:\n\nBreak the problem into smaller parts and connect it to what you already know. Check your textbook's examples and practice similar questions.`,
    `Good thinking! 🧠 To answer **"${question}"**, focus on:\n\n1. Understanding the definition\n2. Learning examples\n3. Practicing similar questions`,
  ];
  res.json({ success: true, answer: mocks[Math.floor(Math.random() * mocks.length)], isMock: true });
});

module.exports = router;
