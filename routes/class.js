const express = require('express');
const router = express.Router();
const content = require('../data/content.json');

// Helper: get class data safely
function getClassData(classNum) {
  return content.content[classNum] || null;
}

// Class landing page — shows all subjects
router.get('/:class', (req, res) => {
  const classNum = req.params.class;
  if (!content.classes.includes(parseInt(classNum))) {
    return res.status(404).render('404', { title: 'Class Not Found' });
  }
  const classData = getClassData(classNum);
  res.render('class', {
    title: `Class ${classNum} – StudyNest`,
    classNum,
    subjects: content.subjects,
    subjectNames: content.subjectNames,
    subjectIcons: content.subjectIcons,
    classData,
  });
});

// Subject page — shows all chapters
router.get('/:class/:subject', (req, res) => {
  const { class: classNum, subject } = req.params;
  if (!content.classes.includes(parseInt(classNum))) {
    return res.status(404).render('404', { title: 'Class Not Found' });
  }
  if (!content.subjects.includes(subject)) {
    return res.status(404).render('404', { title: 'Subject Not Found' });
  }

  const classData = getClassData(classNum);
  const subjectData = classData ? classData[subject] : null;
  const chapters = subjectData ? subjectData.chapters : [];

  res.render('subject', {
    title: `${content.subjectNames[subject]} – Class ${classNum} – StudyNest`,
    classNum,
    subject,
    subjectName: content.subjectNames[subject],
    subjectIcon: content.subjectIcons[subject],
    chapters,
  });
});

// Chapter page — shows notes, PYQs, book PDF options
router.get('/:class/:subject/:chapterId', (req, res) => {
  const { class: classNum, subject, chapterId } = req.params;
  const tab = req.query.tab || 'notes';

  if (!content.classes.includes(parseInt(classNum))) {
    return res.status(404).render('404', { title: 'Class Not Found' });
  }

  const classData = getClassData(classNum);
  const subjectData = classData ? classData[subject] : null;
  const chapters = subjectData ? subjectData.chapters : [];
  const chapter = chapters.find(c => c.id === parseInt(chapterId));

  if (!chapter) {
    return res.status(404).render('404', { title: 'Chapter Not Found' });
  }

  res.render('chapter', {
    title: `${chapter.title} – StudyNest`,
    classNum,
    subject,
    subjectName: content.subjectNames[subject],
    subjectIcon: content.subjectIcons[subject],
    chapter,
    tab,
  });
});

module.exports = router;
