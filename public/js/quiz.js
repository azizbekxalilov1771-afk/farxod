// Quiz Management JavaScript

let currentQuiz = null;
let currentQuestionIndex = 0;
let userAnswers = {};
let quizQuestions = [];
let currentQuizId = null;

// Initialize quiz page
document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
    loadPublicQuizzes();
});

function checkAuth() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (token && user.id) {
        // User is logged in - show management interface
        document.getElementById('quiz-management').style.display = 'block';
        document.getElementById('quiz-list').style.display = 'none';
        loadMyQuizzes();
        updateAuthUI();
    } else {
        // Guest user - show public quizzes only
        document.getElementById('quiz-management').style.display = 'none';
        document.getElementById('quiz-list').style.display = 'block';
    }
}

function setupEventListeners() {
    // PDF file input
    document.getElementById('pdf-input').addEventListener('change', handleFileSelect);
    
    // Drag and drop
    const uploadArea = document.getElementById('upload-area');
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    uploadArea.addEventListener('click', () => document.getElementById('pdf-input').click());
    
    // Modal close buttons
    document.querySelectorAll('.close').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });
}

// File handling functions
function selectPDFFile() {
    document.getElementById('pdf-input').click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file && file.type === 'application/pdf') {
        uploadPDF(file);
    } else {
        showNotification('Iltimos, faqat PDF fayl tanlang!', 'error');
    }
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
}

function handleDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
        uploadPDF(files[0]);
    } else {
        showNotification('Iltimos, faqat PDF fayl tashlang!', 'error');
    }
}

async function uploadPDF(file) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    const formData = new FormData();
    formData.append('pdf', file);
    
    const title = document.getElementById('quiz-title').value || `Quiz - ${new Date().toLocaleDateString()}`;
    const description = document.getElementById('quiz-description').value || 'PDF dan yaratilgan quiz';
    
    formData.append('title', title);
    formData.append('description', description);
    
    showLoading(true);
    
    try {
        const response = await fetch('/api/quiz/upload-pdf', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(`PDF muvaffaqiyatli yuklandi! ${result.questionsCount} ta savol topildi.`, 'success');
            
            // Clear form
            document.getElementById('quiz-title').value = '';
            document.getElementById('quiz-description').value = '';
            document.getElementById('pdf-input').value = '';
            
            // Reload quizzes
            loadMyQuizzes();
            
            // Show reward setup
            if (result.questions && result.questions.length > 0) {
                showRewardSetup(result.quizId, result.questions);
            }
        } else {
            showNotification(result.error || 'PDF yuklashda xatolik!', 'error');
        }
    } catch (error) {
        console.error('PDF upload error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

// Quiz management functions
async function loadMyQuizzes() {
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch('/api/quiz/my-quizzes', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const quizzes = await response.json();
        displayMyQuizzes(quizzes);
    } catch (error) {
        console.error('Load quizzes error:', error);
        showNotification('Quizlarni yuklashda xatolik!', 'error');
    }
}

function displayMyQuizzes(quizzes) {
    const grid = document.getElementById('quizzes-grid');
    
    if (quizzes.length === 0) {
        grid.innerHTML = '<p class="text-center">Hozircha quizlaringiz yo\'q. PDF fayl yuklang!</p>';
        return;
    }
    
    grid.innerHTML = quizzes.map(quiz => {
        const questions = JSON.parse(quiz.questions || '[]');
        const rewards = JSON.parse(quiz.rewards || '[]');
        const totalReward = rewards.reduce((sum, reward) => sum + (reward || 0), 0);
        
        return `
            <div class="quiz-card">
                <div class="quiz-card-header">
                    <div>
                        <div class="quiz-title">${quiz.title}</div>
                        <div class="quiz-meta">
                            <span><i class="fas fa-question-circle"></i> ${questions.length} ta savol</span>
                            <span><i class="fas fa-calendar"></i> ${new Date(quiz.created_at).toLocaleDateString()}</span>
                            <span><i class="fas fa-dollar-sign"></i> $${totalReward} mukofot</span>
                        </div>
                    </div>
                    <div class="quiz-status ${quiz.is_active ? 'active' : 'inactive'}">
                        <i class="fas fa-${quiz.is_active ? 'check' : 'times'}"></i>
                        ${quiz.is_active ? 'Faol' : 'Nofaol'}
                    </div>
                </div>
                <p>${quiz.description}</p>
                <div class="quiz-actions">
                    <button class="btn-primary btn-small" onclick="setupRewards(${quiz.id})">
                        <i class="fas fa-cog"></i> Mukofot
                    </button>
                    <button class="btn-secondary btn-small" onclick="viewResults(${quiz.id})">
                        <i class="fas fa-chart-bar"></i> Natijalar
                    </button>
                    <button class="btn-secondary btn-small" onclick="shareQuiz(${quiz.id})">
                        <i class="fas fa-share"></i> Ulashish
                    </button>
                    <button class="btn-secondary btn-small" onclick="deleteQuiz(${quiz.id})">
                        <i class="fas fa-trash"></i> O'chirish
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

async function loadPublicQuizzes() {
    try {
        const response = await fetch('/api/quiz/public');
        const quizzes = await response.json();
        displayPublicQuizzes(quizzes);
    } catch (error) {
        console.error('Load public quizzes error:', error);
        // Show sample quizzes if API fails
        displayPublicQuizzes([
            {
                id: 1,
                title: 'JavaScript Asoslari',
                description: 'JavaScript dasturlash tilining asosiy tushunchalari',
                questions_count: 15,
                total_reward: 50,
                difficulty: 'Oson'
            },
            {
                id: 2,
                title: 'Web Dizayn',
                description: 'HTML, CSS va responsive dizayn',
                questions_count: 20,
                total_reward: 75,
                difficulty: 'O\'rta'
            }
        ]);
    }
}

function displayPublicQuizzes(quizzes) {
    const grid = document.getElementById('public-quizzes-grid');
    
    if (quizzes.length === 0) {
        grid.innerHTML = '<p class="text-center">Hozircha ommaviy quizlar yo\'q.</p>';
        return;
    }
    
    grid.innerHTML = quizzes.map(quiz => `
        <div class="public-quiz-card">
            <div class="quiz-icon">
                <i class="fas fa-brain"></i>
            </div>
            <h3>${quiz.title}</h3>
            <p>${quiz.description}</p>
            <div class="quiz-stats">
                <div class="stat-item">
                    <div class="stat-value">${quiz.questions_count || 10}</div>
                    <div class="stat-label">Savollar</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">$${quiz.total_reward || 0}</div>
                    <div class="stat-label">Mukofot</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${quiz.difficulty || 'O\'rta'}</div>
                    <div class="stat-label">Dareja</div>
                </div>
            </div>
            <button class="btn-primary btn-full" onclick="startQuiz(${quiz.id})">
                <i class="fas fa-play"></i>
                Boshlaymiz
            </button>
        </div>
    `).join('');
}

// Quiz taking functions
async function startQuiz(quizId) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/quiz/${quizId}`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const quiz = await response.json();
        
        if (response.ok) {
            currentQuiz = quiz;
            currentQuizId = quizId;
            quizQuestions = quiz.questions || [];
            userAnswers = {};
            currentQuestionIndex = 0;
            
            showQuizInterface();
            displayQuestion();
        } else {
            showNotification(quiz.error || 'Quiz yuklashda xatolik!', 'error');
        }
    } catch (error) {
        console.error('Start quiz error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function showQuizInterface() {
    document.getElementById('quiz-list').style.display = 'none';
    document.getElementById('quiz-management').style.display = 'none';
    document.getElementById('quiz-taking').style.display = 'block';
    
    document.getElementById('quiz-title-display').textContent = currentQuiz.title;
}

function displayQuestion() {
    if (!quizQuestions[currentQuestionIndex]) return;
    
    const question = quizQuestions[currentQuestionIndex];
    const container = document.getElementById('question-container');
    
    // Update progress
    const progress = ((currentQuestionIndex + 1) / quizQuestions.length) * 100;
    document.getElementById('progress-fill').style.width = `${progress}%`;
    document.getElementById('progress-text').textContent = `${currentQuestionIndex + 1} / ${quizQuestions.length}`;
    
    // Generate question HTML
    let optionsHTML = '';
    
    if (question.type === 'multiple_choice' && question.options && question.options.length > 0) {
        optionsHTML = `
            <div class="answer-options">
                ${question.options.map((option, index) => `
                    <div class="answer-option" onclick="selectOption('${option.id}', this)">
                        <div class="option-letter">${option.id}</div>
                        <div class="option-text">${option.text}</div>
                    </div>
                `).join('')}
            </div>
        `;
    } else {
        // Text-based question
        optionsHTML = `
            <textarea class="text-answer" 
                      id="text-answer" 
                      placeholder="Javobingizni yozing..."
                      onchange="saveTextAnswer(this.value)">${userAnswers[question.id] || ''}</textarea>
        `;
    }
    
    container.innerHTML = `
        <div class="question-header">
            <div class="question-number">Savol ${currentQuestionIndex + 1}</div>
            <div class="question-points">+${question.points || 10} ball</div>
        </div>
        <div class="question-text">${question.question}</div>
        ${optionsHTML}
    `;
    
    // Restore selected answer if exists
    if (question.type === 'multiple_choice' && userAnswers[question.id]) {
        const selectedOption = container.querySelector(`[onclick="selectOption('${userAnswers[question.id]}', this)"]`);
        if (selectedOption) {
            selectedOption.classList.add('selected');
        }
    }
    
    // Update navigation buttons
    document.getElementById('prev-btn').style.display = currentQuestionIndex === 0 ? 'none' : 'block';
    document.getElementById('next-btn').style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'none' : 'block';
    document.getElementById('submit-btn').style.display = currentQuestionIndex === quizQuestions.length - 1 ? 'block' : 'none';
}

function selectOption(optionId, element) {
    // Remove previous selection
    document.querySelectorAll('.answer-option').forEach(opt => opt.classList.remove('selected'));
    
    // Add selection to clicked option
    element.classList.add('selected');
    
    // Save answer
    const question = quizQuestions[currentQuestionIndex];
    userAnswers[question.id] = optionId;
}

function saveTextAnswer(text) {
    const question = quizQuestions[currentQuestionIndex];
    userAnswers[question.id] = text;
}

function previousQuestion() {
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        displayQuestion();
    }
}

function nextQuestion() {
    if (currentQuestionIndex < quizQuestions.length - 1) {
        currentQuestionIndex++;
        displayQuestion();
    }
}

async function submitQuiz() {
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    // Check if all questions are answered
    const unansweredQuestions = quizQuestions.filter(q => !userAnswers[q.id]);
    if (unansweredQuestions.length > 0) {
        const proceed = confirm(`${unansweredQuestions.length} ta savolga javob bermadingiz. Baribir yakunlaysizmi?`);
        if (!proceed) return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch(`/api/quiz/${currentQuizId}/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ answers: userAnswers })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showResults(result);
        } else {
            showNotification(result.error || 'Natijalarni saqlashda xatolik!', 'error');
        }
    } catch (error) {
        console.error('Submit quiz error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function showResults(results) {
    document.getElementById('quiz-taking').style.display = 'none';
    document.getElementById('quiz-results').style.display = 'block';
    
    // Update score display
    const percentage = Math.round((results.correctAnswers / results.totalQuestions) * 100);
    document.getElementById('score-percentage').textContent = `${percentage}%`;
    document.getElementById('correct-answers').textContent = results.correctAnswers;
    document.getElementById('total-questions').textContent = results.totalQuestions;
    document.getElementById('reward-earned').textContent = `$${results.rewardEarned}`;
    
    // Display detailed results
    const detailedResults = document.getElementById('detailed-results');
    detailedResults.innerHTML = results.results.map((result, index) => {
        const question = quizQuestions.find(q => q.id == result.questionId) || quizQuestions[index];
        
        return `
            <div class="result-item ${result.isCorrect ? 'correct' : 'incorrect'}">
                <div class="result-header">
                    <div class="result-status ${result.isCorrect ? 'correct' : 'incorrect'}">
                        <i class="fas fa-${result.isCorrect ? 'check' : 'times'}"></i>
                        ${result.isCorrect ? 'To\'g\'ri' : 'Noto\'g\'ri'}
                    </div>
                    <div class="result-points">+${result.points} ball</div>
                </div>
                <div class="result-question">${question.question}</div>
                <div class="result-answers">
                    ${result.userAnswer ? `<div class="result-answer user">Sizning javobingiz: ${result.userAnswer}</div>` : ''}
                    ${result.correctAnswer ? `<div class="result-answer correct">To'g'ri javob: ${result.correctAnswer}</div>` : ''}
                </div>
            </div>
        `;
    }).join('');
    
    // Show appropriate notification
    if (results.rewardEarned > 0) {
        showNotification(`Tabriklaymiz! Siz $${results.rewardEarned} mukofot yutdingiz!`, 'success');
    }
}

function goBackToQuizList() {
    document.getElementById('quiz-results').style.display = 'none';
    checkAuth(); // This will show appropriate interface
}

function retakeQuiz() {
    if (currentQuizId) {
        startQuiz(currentQuizId);
    }
}

// Reward setup functions
async function setupRewards(quizId) {
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const quiz = await response.json();
        
        if (response.ok) {
            showRewardSetup(quizId, JSON.parse(quiz.questions || '[]'));
        } else {
            showNotification('Quiz ma\'lumotlarini olishda xatolik!', 'error');
        }
    } catch (error) {
        console.error('Setup rewards error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function showRewardSetup(quizId, questions) {
    const modal = document.getElementById('rewardModal');
    const questionsContainer = document.getElementById('reward-questions');
    
    questionsContainer.innerHTML = questions.map((question, index) => `
        <div class="reward-question">
            <div class="reward-question-text">
                ${index + 1}. ${question.question.substring(0, 100)}${question.question.length > 100 ? '...' : ''}
            </div>
            <div class="reward-input-group">
                <label>Mukofot: $</label>
                <input type="number" 
                       class="reward-input" 
                       data-question-id="${question.id || index}"
                       min="0" 
                       step="0.01" 
                       value="${question.reward || 0}"
                       onchange="updateTotalReward()">
            </div>
        </div>
    `).join('');
    
    modal.style.display = 'block';
    modal.setAttribute('data-quiz-id', quizId);
    updateTotalReward();
}

function updateTotalReward() {
    const inputs = document.querySelectorAll('.reward-input');
    let total = 0;
    
    inputs.forEach(input => {
        total += parseFloat(input.value) || 0;
    });
    
    document.getElementById('total-reward').textContent = total.toFixed(2);
}

async function saveRewards() {
    const modal = document.getElementById('rewardModal');
    const quizId = modal.getAttribute('data-quiz-id');
    const inputs = document.querySelectorAll('.reward-input');
    
    const rewards = [];
    inputs.forEach(input => {
        rewards.push(parseFloat(input.value) || 0);
    });
    
    try {
        const response = await fetch(`/api/quiz/${quizId}/rewards`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ rewards })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Mukofotlar saqlandi!', 'success');
            closeRewardModal();
            loadMyQuizzes(); // Reload to show updated rewards
        } else {
            showNotification(result.error || 'Mukofotlarni saqlashda xatolik!', 'error');
        }
    } catch (error) {
        console.error('Save rewards error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function closeRewardModal() {
    document.getElementById('rewardModal').style.display = 'none';
}

// Other functions
async function viewResults(quizId) {
    showNotification('Natijalar ko\'rish funksiyasi ishlab chiqilmoqda...', 'info');
}

function shareQuiz(quizId) {
    const shareUrl = `${window.location.origin}/quiz.html?id=${quizId}`;
    
    if (navigator.share) {
        navigator.share({
            title: 'Quiz - Universal Platform',
            text: 'Bu quizga qatnashing va mukofot yutib oling!',
            url: shareUrl
        });
    } else {
        // Fallback: copy to clipboard
        navigator.clipboard.writeText(shareUrl).then(() => {
            showNotification('Havolа nusxalandi!', 'success');
        });
    }
}

async function deleteQuiz(quizId) {
    if (!confirm('Haqiqatan ham bu quizni o\'chirmoqchimisiz?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/quiz/${quizId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Quiz o\'chirildi!', 'success');
            loadMyQuizzes();
        } else {
            showNotification(result.error || 'Quiz o\'chirishda xatolik!', 'error');
        }
    } catch (error) {
        console.error('Delete quiz error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function showLoading(show) {
    const spinner = document.getElementById('loading-spinner');
    spinner.style.display = show ? 'flex' : 'none';
}

// Check for quiz ID in URL parameters
const urlParams = new URLSearchParams(window.location.search);
const quizIdFromUrl = urlParams.get('id');
if (quizIdFromUrl) {
    startQuiz(quizIdFromUrl);
}