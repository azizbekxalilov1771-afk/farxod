const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const db = require('../config/database');

// Configure multer for PDF uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/pdfs/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9) + '.pdf';
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  }
});

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Token talab qilinadi' });
  }
  
  try {
    const jwt = require('jsonwebtoken');
    const config = require('../config/config');
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Yaroqsiz token' });
  }
};

// Upload PDF and extract questions
router.post('/upload-pdf', verifyToken, upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'PDF fayl talab qilinadi' });
    }

    const pdfPath = req.file.path;
    const pdfBuffer = fs.readFileSync(pdfPath);
    
    // Extract text from PDF
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // Extract questions using AI-like pattern matching
    const questions = extractQuestionsFromText(extractedText);

    // Save quiz to database
    const quizData = {
      title: req.body.title || `Quiz - ${new Date().toLocaleDateString()}`,
      description: req.body.description || 'PDF dan yaratilgan quiz',
      creator_id: req.user.id,
      pdf_file_path: pdfPath,
      questions: JSON.stringify(questions),
      rewards: JSON.stringify([]), // Will be set later
      is_active: 1
    };

    const result = await db.run(
      `INSERT INTO quizzes (title, description, creator_id, pdf_file_path, questions, rewards, is_active) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [quizData.title, quizData.description, quizData.creator_id, quizData.pdf_file_path, 
       quizData.questions, quizData.rewards, quizData.is_active]
    );

    res.json({
      success: true,
      quizId: result.id,
      questionsCount: questions.length,
      questions: questions,
      message: `${questions.length}ta savol topildi`
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    res.status(500).json({ error: 'PDF qayta ishlanmadi: ' + error.message });
  }
});

// Function to extract questions from PDF text
function extractQuestionsFromText(text) {
  const questions = [];
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  let currentQuestion = null;
  let questionCounter = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Detect question patterns
    if (isQuestionStart(line)) {
      // Save previous question if exists
      if (currentQuestion && currentQuestion.question && currentQuestion.options.length > 0) {
        currentQuestion.id = questions.length + 1;
        questions.push(currentQuestion);
      }
      
      // Start new question
      currentQuestion = {
        question: cleanQuestionText(line),
        options: [],
        correctAnswer: null,
        type: 'multiple_choice',
        points: 10 // Default points
      };
    }
    // Detect answer options
    else if (currentQuestion && isAnswerOption(line)) {
      const option = cleanOptionText(line);
      currentQuestion.options.push({
        id: String.fromCharCode(65 + currentQuestion.options.length), // A, B, C, D
        text: option.text,
        isCorrect: option.isCorrect
      });
      
      if (option.isCorrect) {
        currentQuestion.correctAnswer = String.fromCharCode(65 + currentQuestion.options.length - 1);
      }
    }
    // Add continuation text to current question
    else if (currentQuestion && line.length > 10 && !isAnswerOption(line)) {
      if (currentQuestion.question.length < 200) {
        currentQuestion.question += ' ' + line;
      }
    }
  }

  // Add last question
  if (currentQuestion && currentQuestion.question && currentQuestion.options.length > 0) {
    currentQuestion.id = questions.length + 1;
    questions.push(currentQuestion);
  }

  // If no structured questions found, create questions from paragraphs
  if (questions.length === 0) {
    return createQuestionsFromParagraphs(text);
  }

  return questions.slice(0, 50); // Limit to 50 questions
}

function isQuestionStart(line) {
  // Check for common question patterns
  const questionPatterns = [
    /^\d+[\.\)]\s*/,  // 1. or 1)
    /^[A-Z]\)\s*/,    // A)
    /^\?\s*/,         // Starting with ?
    /\?$/,            // Ending with ?
    /^(What|How|Why|When|Where|Which|Who)/i,
    /^(Qanday|Qachon|Qayer|Kim|Nima|Necha)/i // Uzbek question words
  ];
  
  return questionPatterns.some(pattern => pattern.test(line)) && line.length > 10;
}

function isAnswerOption(line) {
  const optionPatterns = [
    /^[A-Da-d][\)\.]?\s*/, // A) B) C) D)
    /^[1-4][\)\.]?\s*/,    // 1) 2) 3) 4)
    /^[•\-\*]\s*/,         // Bullet points
  ];
  
  return optionPatterns.some(pattern => pattern.test(line)) && line.length > 3;
}

function cleanQuestionText(text) {
  return text
    .replace(/^\d+[\.\)]\s*/, '') // Remove numbering
    .replace(/^[A-Z]\)\s*/, '')   // Remove A)
    .replace(/^\?\s*/, '')        // Remove leading ?
    .trim();
}

function cleanOptionText(text) {
  const cleaned = text
    .replace(/^[A-Da-d][\)\.]?\s*/, '') // Remove A) B) etc
    .replace(/^[1-4][\)\.]?\s*/, '')    // Remove 1) 2) etc
    .replace(/^[•\-\*]\s*/, '')         // Remove bullets
    .trim();

  // Check if this might be the correct answer (simple heuristics)
  const isCorrect = /^(correct|to'g'ri|right)/i.test(text) || 
                   text.includes('✓') || 
                   text.includes('*');

  return {
    text: cleaned,
    isCorrect: isCorrect
  };
}

function createQuestionsFromParagraphs(text) {
  const paragraphs = text.split('\n\n').filter(p => p.trim().length > 50);
  const questions = [];

  paragraphs.slice(0, 10).forEach((paragraph, index) => {
    const sentences = paragraph.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length >= 2) {
      const questionSentence = sentences[0].trim() + '?';
      const correctAnswer = sentences[1].trim();
      
      questions.push({
        id: index + 1,
        question: questionSentence,
        type: 'text',
        correctAnswer: correctAnswer,
        points: 15,
        options: [] // Text-based question
      });
    }
  });

  return questions;
}

// Get user's quizzes
router.get('/my-quizzes', verifyToken, async (req, res) => {
  try {
    const quizzes = await db.query(
      'SELECT * FROM quizzes WHERE creator_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json(quizzes);
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Quiz ma\'lumotlarini olishda xatolik' });
  }
});

// Get specific quiz
router.get('/:quizId', async (req, res) => {
  try {
    const quiz = await db.query(
      'SELECT * FROM quizzes WHERE id = ? AND is_active = 1',
      [req.params.quizId]
    );

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz topilmadi' });
    }

    const quizData = quiz[0];
    quizData.questions = JSON.parse(quizData.questions || '[]');
    quizData.rewards = JSON.parse(quizData.rewards || '[]');

    // Don't send correct answers to participants
    if (!req.user || req.user.id !== quizData.creator_id) {
      quizData.questions = quizData.questions.map(q => ({
        ...q,
        correctAnswer: undefined,
        options: q.options.map(opt => ({ id: opt.id, text: opt.text }))
      }));
    }

    res.json(quizData);
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Quiz ma\'lumotlarini olishda xatolik' });
  }
});

// Update quiz rewards
router.put('/:quizId/rewards', verifyToken, async (req, res) => {
  try {
    const { rewards } = req.body;

    // Verify quiz ownership
    const quiz = await db.query(
      'SELECT * FROM quizzes WHERE id = ? AND creator_id = ?',
      [req.params.quizId, req.user.id]
    );

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz topilmadi yoki ruxsat yo\'q' });
    }

    await db.run(
      'UPDATE quizzes SET rewards = ? WHERE id = ?',
      [JSON.stringify(rewards), req.params.quizId]
    );

    res.json({ success: true, message: 'Mukofotlar saqlandi' });
  } catch (error) {
    console.error('Update rewards error:', error);
    res.status(500).json({ error: 'Mukofotlarni saqlashda xatolik' });
  }
});

// Submit quiz answers
router.post('/:quizId/submit', verifyToken, async (req, res) => {
  try {
    const { answers } = req.body;
    const quizId = req.params.quizId;

    // Get quiz data
    const quiz = await db.query(
      'SELECT * FROM quizzes WHERE id = ? AND is_active = 1',
      [quizId]
    );

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz topilmadi' });
    }

    const quizData = quiz[0];
    const questions = JSON.parse(quizData.questions || '[]');
    const rewards = JSON.parse(quizData.rewards || '[]');

    // Calculate score and rewards
    let score = 0;
    let totalReward = 0;
    const results = [];

    questions.forEach((question, index) => {
      const userAnswer = answers[question.id] || answers[index];
      const isCorrect = checkAnswer(question, userAnswer);
      
      if (isCorrect) {
        score += question.points || 10;
        const reward = rewards[index] || 0;
        totalReward += reward;
      }

      results.push({
        questionId: question.id,
        userAnswer: userAnswer,
        correctAnswer: question.correctAnswer,
        isCorrect: isCorrect,
        points: isCorrect ? (question.points || 10) : 0,
        reward: isCorrect ? (rewards[index] || 0) : 0
      });
    });

    // Save attempt to database
    await db.run(
      `INSERT INTO quiz_attempts (quiz_id, user_id, answers, score, reward_earned) 
       VALUES (?, ?, ?, ?, ?)`,
      [quizId, req.user.id, JSON.stringify(answers), score, totalReward]
    );

    res.json({
      success: true,
      score: score,
      totalQuestions: questions.length,
      correctAnswers: results.filter(r => r.isCorrect).length,
      rewardEarned: totalReward,
      results: results
    });

  } catch (error) {
    console.error('Submit quiz error:', error);
    res.status(500).json({ error: 'Quiz natijalarini saqlashda xatolik' });
  }
});

function checkAnswer(question, userAnswer) {
  if (question.type === 'multiple_choice') {
    return question.correctAnswer && 
           userAnswer && 
           question.correctAnswer.toLowerCase() === userAnswer.toLowerCase();
  } else if (question.type === 'text') {
    if (!question.correctAnswer || !userAnswer) return false;
    
    // Fuzzy matching for text answers
    const correct = question.correctAnswer.toLowerCase().trim();
    const user = userAnswer.toLowerCase().trim();
    
    // Exact match
    if (correct === user) return true;
    
    // Partial match (at least 70% similarity)
    const similarity = calculateSimilarity(correct, user);
    return similarity >= 0.7;
  }
  
  return false;
}

function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// Get quiz attempts/results
router.get('/:quizId/results', verifyToken, async (req, res) => {
  try {
    // Verify quiz ownership
    const quiz = await db.query(
      'SELECT * FROM quizzes WHERE id = ? AND creator_id = ?',
      [req.params.quizId, req.user.id]
    );

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz topilmadi yoki ruxsat yo\'q' });
    }

    const attempts = await db.query(`
      SELECT qa.*, u.username, u.email 
      FROM quiz_attempts qa
      JOIN users u ON qa.user_id = u.id
      WHERE qa.quiz_id = ?
      ORDER BY qa.completed_at DESC
    `, [req.params.quizId]);

    res.json(attempts);
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Natijalarni olishda xatolik' });
  }
});

// Delete quiz
router.delete('/:quizId', verifyToken, async (req, res) => {
  try {
    // Verify quiz ownership
    const quiz = await db.query(
      'SELECT * FROM quizzes WHERE id = ? AND creator_id = ?',
      [req.params.quizId, req.user.id]
    );

    if (quiz.length === 0) {
      return res.status(404).json({ error: 'Quiz topilmadi yoki ruxsat yo\'q' });
    }

    // Delete PDF file
    const pdfPath = quiz[0].pdf_file_path;
    if (pdfPath && fs.existsSync(pdfPath)) {
      fs.unlinkSync(pdfPath);
    }

    // Delete from database
    await db.run('DELETE FROM quiz_attempts WHERE quiz_id = ?', [req.params.quizId]);
    await db.run('DELETE FROM quizzes WHERE id = ?', [req.params.quizId]);

    res.json({ success: true, message: 'Quiz o\'chirildi' });
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Quiz o\'chirishda xatolik' });
  }
});

module.exports = router;