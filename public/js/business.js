// Business JavaScript

let allServices = [];
let allCategories = [];
let currentServiceId = null;
let editingServiceId = null;

// Initialize business page
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    loadServices();
    checkAdminAccess();
    setupEventListeners();
});

function setupEventListeners() {
    // Service form submission
    const serviceForm = document.getElementById('service-form');
    serviceForm.addEventListener('submit', handleServiceSubmit);
    
    // Order form submission
    const orderForm = document.getElementById('order-form');
    orderForm.addEventListener('submit', handleOrderSubmit);
    
    // Contact form submission
    const contactForm = document.getElementById('contact-form');
    contactForm.addEventListener('submit', handleContactSubmit);
}

// Load service categories
async function loadCategories() {
    try {
        const response = await fetch('/api/business/categories');
        const categories = await response.json();
        
        allCategories = categories;
        displayCategories(categories);
        updateCategoryFilter(categories);
        
    } catch (error) {
        console.error('Load categories error:', error);
    }
}

function displayCategories(categories) {
    const grid = document.getElementById('category-grid');
    
    grid.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterServicesByCategory('${category.id}')">
            <div class="category-icon">
                <i class="${category.icon}"></i>
            </div>
            <h3>${category.name}</h3>
            <p>Professional ${category.name.toLowerCase()} xizmatlari</p>
        </div>
    `).join('');
}

function updateCategoryFilter(categories) {
    const filterSelect = document.getElementById('category-filter');
    
    let optionsHTML = '<option value="">Barcha kategoriyalar</option>';
    categories.forEach(category => {
        optionsHTML += `<option value="${category.id}">${category.name}</option>`;
    });
    
    filterSelect.innerHTML = optionsHTML;
}

// Load services
async function loadServices(categoryFilter = '') {
    try {
        showLoading(true);
        
        const params = new URLSearchParams();
        if (categoryFilter) {
            params.append('category', categoryFilter);
        }
        
        const response = await fetch(`/api/business/services?${params}`);
        const services = await response.json();
        
        if (response.ok) {
            allServices = services;
            displayServices(services);
        } else {
            showNotification('Xizmatlar ma\'lumotlarini yuklashda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Load services error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function displayServices(services) {
    const grid = document.getElementById('services-grid');
    
    if (services.length === 0) {
        grid.innerHTML = '<p class="text-center" style="grid-column: 1 / -1;">Hozircha xizmatlar yo\'q.</p>';
        return;
    }
    
    grid.innerHTML = services.map(service => {
        const categoryName = getCategoryName(service.category);
        const isFeatured = service.price > 1000; // Example condition for featured
        
        return `
            <div class="service-card ${isFeatured ? 'featured' : ''}" onclick="viewService(${service.id})">
                ${isFeatured ? '<div class="service-badge">Mashhur</div>' : ''}
                
                <div class="service-image">
                    <img src="${service.image_url || 'https://via.placeholder.com/350x200?text=Service'}" 
                         alt="${service.name}" loading="lazy">
                    <div class="service-overlay">
                        <button>Batafsil ko'rish</button>
                    </div>
                </div>
                
                <div class="service-content">
                    <div class="service-category">${categoryName}</div>
                    <h3 class="service-title">${service.name}</h3>
                    <p class="service-description">${service.description}</p>
                    <div class="service-price">
                        $${service.price} <small>dan</small>
                    </div>
                    
                    ${service.features.length > 0 ? `
                        <ul class="service-features">
                            ${service.features.slice(0, 3).map(feature => 
                                `<li><i class="fas fa-check"></i> ${feature}</li>`
                            ).join('')}
                            ${service.features.length > 3 ? '<li><i class="fas fa-plus"></i> Ko\'proq...</li>' : ''}
                        </ul>
                    ` : ''}
                    
                    <div class="service-actions">
                        <button class="btn-primary btn-full" onclick="event.stopPropagation(); orderService(${service.id})">
                            Buyurtma berish
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

function getCategoryName(categoryId) {
    const category = allCategories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
}

// Filter functions
function filterServicesByCategory(categoryId) {
    document.getElementById('category-filter').value = categoryId;
    loadServices(categoryId);
    
    // Scroll to services section
    document.getElementById('services-section').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

function filterServices() {
    const categoryFilter = document.getElementById('category-filter').value;
    loadServices(categoryFilter);
}

function clearFilters() {
    document.getElementById('category-filter').value = '';
    loadServices();
}

function scrollToServices() {
    document.getElementById('services-section').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// View service details
async function viewService(serviceId) {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/business/services/${serviceId}`);
        const service = await response.json();
        
        if (response.ok) {
            showServiceDetail(service);
        } else {
            showNotification('Xizmat ma\'lumotlarini yuklashda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('View service error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function showServiceDetail(service) {
    const modal = document.getElementById('serviceModal');
    const detailContainer = document.getElementById('service-detail');
    
    const categoryName = getCategoryName(service.category);
    
    const adminActions = isAdmin() ? `
        <div class="service-actions" style="margin-top: 1rem;">
            <button class="btn-secondary" onclick="editService(${service.id})">
                <i class="fas fa-edit"></i> Tahrirlash
            </button>
            <button class="btn-danger" onclick="deleteService(${service.id})">
                <i class="fas fa-trash"></i> O'chirish
            </button>
        </div>
    ` : '';
    
    detailContainer.innerHTML = `
        <div class="service-hero">
            <img src="${service.image_url || 'https://via.placeholder.com/800x300?text=Service'}" 
                 alt="${service.name}">
        </div>
        
        <div class="service-meta">
            <div class="service-info">
                <h1>${service.name}</h1>
                <span class="service-category-badge">${categoryName}</span>
                ${adminActions}
            </div>
            <div class="service-price-display">
                <div class="price">$${service.price}</div>
                <small>dan boshlab</small>
            </div>
        </div>
        
        <div class="service-description-full">
            ${service.description}
        </div>
        
        ${service.features.length > 0 ? `
            <div class="service-features-list">
                <h3>Xizmat xususiyatlari:</h3>
                <ul class="features-list">
                    ${service.features.map(feature => `<li><i class="fas fa-check"></i> ${feature}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        <div class="service-cta">
            <h3>Tayyor xizmatni buyurtma qilishga?</h3>
            <p>Biz bilan bog'laning va loyihangizni muhokama qilaylik</p>
            <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
                <button class="btn-primary btn-large" onclick="orderService(${service.id})">
                    <i class="fas fa-shopping-cart"></i> Buyurtma berish
                </button>
                <button class="btn-outline btn-large" onclick="showContactModal()">
                    <i class="fas fa-phone"></i> Bog'lanish
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'block';
}

function closeServiceModal() {
    document.getElementById('serviceModal').style.display = 'none';
}

// Order service
function orderService(serviceId) {
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    currentServiceId = serviceId;
    const service = allServices.find(s => s.id === serviceId);
    
    if (service) {
        const summaryContainer = document.getElementById('order-service-summary');
        summaryContainer.innerHTML = `
            <div class="summary-item">
                <span>Xizmat:</span>
                <span>${service.name}</span>
            </div>
            <div class="summary-item">
                <span>Kategoriya:</span>
                <span>${getCategoryName(service.category)}</span>
            </div>
            <div class="summary-item">
                <span>Boshlang'ich narx:</span>
                <span>$${service.price}</span>
            </div>
        `;
        
        document.getElementById('orderModal').style.display = 'block';
        closeServiceModal();
    }
}

async function handleOrderSubmit(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    const formData = new FormData(event.target);
    const orderData = {
        serviceId: currentServiceId,
        message: formData.get('message'),
        contactInfo: {
            phone: formData.get('phone'),
            timeline: formData.get('timeline')
        }
    };
    
    try {
        const response = await fetch('/api/business/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(orderData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Buyurtma muvaffaqiyatli yuborildi!', 'success');
            closeOrderModal();
            
            // Optionally redirect to payment
            const service = allServices.find(s => s.id === currentServiceId);
            if (service) {
                // Show payment option
                const payNow = confirm('Hoziroq to\'lov qilmoqchimisiz?');
                if (payNow) {
                    payForService(service.id, service.name, service.price);
                }
            }
        } else {
            showNotification(result.error || 'Buyurtma yuborishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Order submit error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function closeOrderModal() {
    document.getElementById('orderModal').style.display = 'none';
    document.getElementById('order-form').reset();
    currentServiceId = null;
}

// Contact functions
function showContactModal() {
    document.getElementById('contactModal').style.display = 'block';
}

async function handleContactSubmit(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const contactData = Object.fromEntries(formData);
    
    try {
        const response = await fetch('/api/business/contact', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(contactData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Xabaringiz yuborildi! Tez orada javob beramiz.', 'success');
            closeContactModal();
        } else {
            showNotification(result.error || 'Xabar yuborishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Contact submit error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function closeContactModal() {
    document.getElementById('contactModal').style.display = 'none';
    document.getElementById('contact-form').reset();
}

// Admin functionality
function checkAdminAccess() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    if (user.role === 'admin') {
        document.getElementById('admin-panel').style.display = 'block';
        loadAdminStats();
    }
    
    updateAuthUI();
}

function isAdmin() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    return user.role === 'admin';
}

async function loadAdminStats() {
    try {
        const token = localStorage.getItem('token');
        if (!token) return;
        
        const response = await fetch('/api/business/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const stats = await response.json();
        
        if (response.ok) {
            displayAdminStats(stats);
        }
        
    } catch (error) {
        console.error('Load admin stats error:', error);
    }
}

function displayAdminStats(stats) {
    const statsContainer = document.getElementById('admin-stats');
    
    statsContainer.innerHTML = `
        <div class="admin-stat-card">
            <div class="admin-stat-number">${stats.totalServices}</div>
            <div class="admin-stat-label">Jami xizmatlar</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-number">${stats.activeServices}</div>
            <div class="admin-stat-label">Faol xizmatlar</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-number">${stats.totalOrders}</div>
            <div class="admin-stat-label">Jami buyurtmalar</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-number">${stats.pendingOrders}</div>
            <div class="admin-stat-label">Kutilayotgan</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-number">$${stats.totalRevenue.toFixed(2)}</div>
            <div class="admin-stat-label">Jami daromad</div>
        </div>
    `;
}

// Add/Edit service
function showAddServiceModal() {
    editingServiceId = null;
    document.getElementById('service-form-title').textContent = 'Xizmat qo\'shish';
    document.getElementById('service-submit-text').textContent = 'Saqlash';
    document.getElementById('service-form').reset();
    document.getElementById('addServiceModal').style.display = 'block';
}

async function editService(serviceId) {
    try {
        const response = await fetch(`/api/business/services/${serviceId}`);
        const service = await response.json();
        
        if (response.ok) {
            editingServiceId = serviceId;
            document.getElementById('service-form-title').textContent = 'Xizmatni tahrirlash';
            document.getElementById('service-submit-text').textContent = 'Yangilash';
            
            // Fill form
            document.getElementById('service-name').value = service.name;
            document.getElementById('service-category').value = service.category;
            document.getElementById('service-price').value = service.price;
            document.getElementById('service-active').value = service.is_active;
            document.getElementById('service-description').value = service.description;
            document.getElementById('service-features').value = service.features.join(', ');
            
            document.getElementById('addServiceModal').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Edit service error:', error);
        showNotification('Xizmatni yuklashda xatolik!', 'error');
    }
}

async function handleServiceSubmit(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Kirish talab qilinadi!', 'error');
        return;
    }
    
    const formData = new FormData(event.target);
    const submitBtn = event.target.querySelector('[type="submit"]');
    
    // Show loading
    document.getElementById('service-form-spinner').style.display = 'inline-block';
    document.getElementById('service-submit-text').textContent = 'Saqlanmoqda...';
    submitBtn.disabled = true;
    
    try {
        const url = editingServiceId 
            ? `/api/business/services/${editingServiceId}`
            : '/api/business/services';
        
        const method = editingServiceId ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(
                editingServiceId ? 'Xizmat yangilandi!' : 'Xizmat qo\'shildi!', 
                'success'
            );
            closeAddServiceModal();
            loadServices();
            loadAdminStats();
        } else {
            showNotification(result.error || 'Xatolik yuz berdi!', 'error');
        }
        
    } catch (error) {
        console.error('Submit service error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        // Reset loading state
        document.getElementById('service-form-spinner').style.display = 'none';
        document.getElementById('service-submit-text').textContent = editingServiceId ? 'Yangilash' : 'Saqlash';
        submitBtn.disabled = false;
    }
}

async function deleteService(serviceId) {
    if (!confirm('Haqiqatan ham bu xizmatni o\'chirmoqchimisiz?')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`/api/business/services/${serviceId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Xizmat o\'chirildi!', 'success');
            closeServiceModal();
            loadServices();
            loadAdminStats();
        } else {
            showNotification(result.error || 'O\'chirishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Delete service error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function closeAddServiceModal() {
    document.getElementById('addServiceModal').style.display = 'none';
    editingServiceId = null;
}

function showOrdersModal() {
    // This would show orders management modal
    showNotification('Buyurtmalar boshqaruvi ishlab chiqilmoqda...', 'info');
}

// Utility functions
function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const modals = ['serviceModal', 'orderModal', 'addServiceModal', 'contactModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Global functions
window.filterServicesByCategory = filterServicesByCategory;
window.filterServices = filterServices;
window.clearFilters = clearFilters;
window.scrollToServices = scrollToServices;
window.viewService = viewService;
window.closeServiceModal = closeServiceModal;
window.orderService = orderService;
window.closeOrderModal = closeOrderModal;
window.showContactModal = showContactModal;
window.closeContactModal = closeContactModal;
window.showAddServiceModal = showAddServiceModal;
window.editService = editService;
window.deleteService = deleteService;
window.closeAddServiceModal = closeAddServiceModal;
window.showOrdersModal = showOrdersModal;