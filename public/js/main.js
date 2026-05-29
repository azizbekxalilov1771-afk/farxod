// DOM Elements
const navbar = document.getElementById('navbar');
const navToggle = document.getElementById('nav-toggle');
const navMenu = document.getElementById('nav-menu');
const navLinks = document.querySelectorAll('.nav-link');

// Mobile Navigation Toggle
navToggle.addEventListener('click', () => {
    navMenu.classList.toggle('active');
});

// Close mobile menu when clicking on a link
navLinks.forEach(link => {
    link.addEventListener('click', () => {
        navMenu.classList.remove('active');
    });
});

// Navbar Scroll Effect
window.addEventListener('scroll', () => {
    if (window.scrollY > 100) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

// Smooth Scrolling for Navigation
function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        const offsetTop = element.offsetTop - 80;
        window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
        });
    }
}

// Update Active Navigation Link
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section[id]');
    const scrollPosition = window.scrollY + 150;

    sections.forEach(section => {
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const sectionId = section.getAttribute('id');
        const navLink = document.querySelector(`a[href="#${sectionId}"]`);

        if (scrollPosition >= sectionTop && scrollPosition < sectionTop + sectionHeight) {
            navLinks.forEach(link => link.classList.remove('active'));
            if (navLink) navLink.classList.add('active');
        }
    });
});

// Modal Functions
function showLogin() {
    document.getElementById('loginModal').style.display = 'block';
}

function showRegister() {
    document.getElementById('registerModal').style.display = 'block';
}

// Close Modals
document.querySelectorAll('.close').forEach(closeBtn => {
    closeBtn.addEventListener('click', function() {
        this.closest('.modal').style.display = 'none';
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
    }
});

// Quiz Functions
function uploadPDF() {
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.pdf';
    fileInput.style.display = 'none';
    
    fileInput.onchange = function(e) {
        const file = e.target.files[0];
        if (file && file.type === 'application/pdf') {
            uploadPDFFile(file);
        } else {
            showNotification('Iltimos, faqat PDF fayl yuklang!', 'error');
        }
    };
    
    document.body.appendChild(fileInput);
    fileInput.click();
    document.body.removeChild(fileInput);
}

async function uploadPDFFile(file) {
    const formData = new FormData();
    formData.append('pdf', file);
    
    try {
        showNotification('PDF fayl yuklanmoqda...', 'info');
        
        const response = await fetch('/api/quiz/upload-pdf', {
            method: 'POST',
            body: formData,
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('PDF muvaffaqiyatli yuklandi!', 'success');
            // Redirect to quiz setup page or show quiz creation form
            showQuizSetupModal(result.quizId);
        } else {
            showNotification(result.error || 'Xatolik yuz berdi!', 'error');
        }
    } catch (error) {
        console.error('PDF upload error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function setupRewards() {
    showNotification('Mukofot sozlash tizimi ishlab chiqilmoqda...', 'info');
    // This will be implemented with the quiz system
}

function manageQuizzes() {
    showNotification('Quiz boshqaruv paneli ishlab chiqilmoqda...', 'info');
    // This will redirect to quiz management page
}

// Portfolio Filter Functions
document.addEventListener('DOMContentLoaded', function() {
    const filterBtns = document.querySelectorAll('.filter-btn');
    const portfolioItems = document.querySelectorAll('.portfolio-item');
    
    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all buttons
            filterBtns.forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            btn.classList.add('active');
            
            const filter = btn.getAttribute('data-filter');
            
            portfolioItems.forEach(item => {
                if (filter === 'all' || item.getAttribute('data-category') === filter) {
                    item.style.display = 'block';
                } else {
                    item.style.display = 'none';
                }
            });
        });
    });
});

// Shop Category Filter
document.addEventListener('DOMContentLoaded', function() {
    const categoryBtns = document.querySelectorAll('.category-btn');
    
    categoryBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const category = btn.getAttribute('data-category');
            loadProducts(category);
        });
    });
    
    // Load initial products
    loadProducts('all');
});

async function loadProducts(category) {
    try {
        const response = await fetch(`/api/shop/products?category=${category}`);
        const products = await response.json();
        
        displayProducts(products);
    } catch (error) {
        console.error('Error loading products:', error);
        showNotification('Mahsulotlarni yuklashda xatolik!', 'error');
    }
}

function displayProducts(products) {
    const productsGrid = document.getElementById('products-grid');
    
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="text-center">Mahsulotlar topilmadi</p>';
        return;
    }
    
    productsGrid.innerHTML = products.map(product => `
        <div class="product-card">
            <div class="product-image">
                <img src="${product.image_url || 'https://via.placeholder.com/300x200'}" alt="${product.name}">
                ${product.is_new ? '<div class="product-badge">Yangi</div>' : ''}
            </div>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p class="product-description">${product.description}</p>
                <div class="product-price">
                    <span class="current-price">$${product.price}</span>
                    ${product.old_price ? `<span class="old-price">$${product.old_price}</span>` : ''}
                </div>
                <div class="product-rating">
                    <div class="stars">
                        ${generateStars(product.rating || 5)}
                    </div>
                    <span>(${product.rating || 5})</span>
                </div>
                <button class="btn-primary btn-full" onclick="addToCart(${product.id})">
                    Savatga qo'shish
                </button>
            </div>
        </div>
    `).join('');
}

function generateStars(rating) {
    const fullStars = Math.floor(rating);
    const halfStar = rating % 1 >= 0.5;
    let stars = '';
    
    for (let i = 0; i < fullStars; i++) {
        stars += '<i class="fas fa-star"></i>';
    }
    
    if (halfStar) {
        stars += '<i class="fas fa-star-half-alt"></i>';
    }
    
    const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        stars += '<i class="far fa-star"></i>';
    }
    
    return stars;
}

async function addToCart(productId) {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            showLogin();
            return;
        }
        
        // For demo purposes, let's directly show payment modal
        // In a real app, you would first add to cart, then checkout
        const cartItems = [
            {
                productId: productId,
                quantity: 1
            }
        ];
        
        // Show payment modal for immediate purchase
        payForProducts(cartItems);
        
    } catch (error) {
        console.error('Add to cart error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

// Contact Form
document.getElementById('contact-form').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Xabaringiz yuborildi!', 'success');
            this.reset();
        } else {
            showNotification(result.error || 'Xatolik yuz berdi!', 'error');
        }
    } catch (error) {
        console.error('Contact form error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
});

// Authentication Forms
document.getElementById('loginForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            localStorage.setItem('token', result.token);
            localStorage.setItem('user', JSON.stringify(result.user));
            showNotification('Muvaffaqiyatli kirdingiz!', 'success');
            document.getElementById('loginModal').style.display = 'none';
            updateAuthUI();
        } else {
            showNotification(result.error || 'Kirish xatosi!', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
});

document.getElementById('registerForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Ro\'yxatdan muvaffaqiyatli o\'tdingiz!', 'success');
            document.getElementById('registerModal').style.display = 'none';
            showLogin();
        } else {
            showNotification(result.error || 'Ro\'yxatdan o\'tish xatosi!', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
});

// Utility Functions
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        </div>
    `;
    
    // Add styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 16px 24px;
                border-radius: 8px;
                color: white;
                z-index: 3000;
                animation: slideInRight 0.3s ease;
                max-width: 400px;
            }
            .notification-success { background: #28a745; }
            .notification-error { background: #dc3545; }
            .notification-info { background: #17a2b8; }
            .notification-content {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 1rem;
            }
            .notification-close {
                background: none;
                border: none;
                color: white;
                font-size: 1.2rem;
                cursor: pointer;
            }
            @keyframes slideInRight {
                from { transform: translateX(100%); }
                to { transform: translateX(0); }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 5000);
    
    // Manual close
    notification.querySelector('.notification-close').addEventListener('click', () => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    });
}

function updateAuthUI() {
    const token = localStorage.getItem('token');
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (token && user.id) {
        // Update navigation to show user menu
        const navActions = document.querySelector('.nav-actions');
        navActions.innerHTML = `
            <span>Salom, ${user.username}!</span>
            <button class="btn-primary" onclick="logout()">Chiqish</button>
        `;
    }
}

function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showNotification('Muvaffaqiyatli chiqdingiz!', 'success');
    updateAuthUI();
    location.reload();
}

function updateCartCount() {
    // This will be implemented with the shopping cart functionality
}

function clearCart() {
    // Clear shopping cart after successful payment
    showNotification('Savat tozalandi!', 'success');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    updateAuthUI();
    
    // Add smooth scrolling to all anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                scrollToSection(target.id);
            }
        });
    });
});