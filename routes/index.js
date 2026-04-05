const express = require('express');
const router = express.Router();
const content = require('../data/content.json');

// Homepage
router.get('/', (req, res) => {
  res.render('index', {
    title: 'StudyNest – Your Learning Companion',
    classes: content.classes,
  });
});

// About
router.get('/about', (req, res) => {
  res.render('about', { title: 'About StudyNest' });
});

// AI Helper page
router.get('/ai-helper', (req, res) => {
  res.render('ai-helper', { title: 'AI Answer Helper – StudyNest' });
});

module.exports = router;
// Not overwriting - adding this note: index.js already has no search redirect
// The search_secret_chat redirect is handled client-side in main.js
