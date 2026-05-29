// Portfolio JavaScript

let currentCategory = 'all';
let currentPage = 1;
let isLoading = false;
let allCategories = [];
let editingProjectId = null;

// Initialize portfolio page
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    loadPortfolioItems();
    checkAdminAccess();
    setupEventListeners();
});

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchPortfolio();
        }
    });
    
    // Image upload preview
    const imageInput = document.getElementById('project-image');
    imageInput.addEventListener('change', handleImagePreview);
    
    // Project form submission
    const projectForm = document.getElementById('project-form');
    projectForm.addEventListener('submit', handleProjectSubmit);
}

// Load portfolio categories
async function loadCategories() {
    try {
        const response = await fetch('/api/portfolio/categories');
        const categories = await response.json();
        
        allCategories = categories;
        updateCategoryTabs(categories);
        updateCategoryFilter(categories);
        
    } catch (error) {
        console.error('Load categories error:', error);
    }
}

function updateCategoryTabs(categories) {
    const tabsContainer = document.getElementById('category-tabs');
    
    // Keep "All" button and add category buttons
    let tabsHTML = `
        <button class="category-tab active" data-category="all" onclick="selectCategory('all', this)">
            Barchasi
        </button>
    `;
    
    categories.forEach(cat => {
        const categoryName = getCategoryDisplayName(cat.category);
        tabsHTML += `
            <button class="category-tab" data-category="${cat.category}" onclick="selectCategory('${cat.category}', this)">
                ${categoryName} (${cat.count})
            </button>
        `;
    });
    
    tabsContainer.innerHTML = tabsHTML;
}

function updateCategoryFilter(categories) {
    const filterSelect = document.getElementById('category-filter');
    
    let optionsHTML = '<option value="all">Barcha kategoriyalar</option>';
    categories.forEach(cat => {
        const categoryName = getCategoryDisplayName(cat.category);
        optionsHTML += `<option value="${cat.category}">${categoryName} (${cat.count})</option>`;
    });
    
    filterSelect.innerHTML = optionsHTML;
}

function getCategoryDisplayName(category) {
    const categoryNames = {
        'web': 'Web Saytlar',
        'app': 'Mobil Ilovalar',
        'design': 'Dizayn',
        'other': 'Boshqa'
    };
    return categoryNames[category] || category;
}

// Load portfolio items
async function loadPortfolioItems(append = false) {
    if (isLoading) return;
    
    isLoading = true;
    showLoading(true);
    
    try {
        const params = new URLSearchParams({
            category: currentCategory,
            limit: 12
        });
        
        const response = await fetch(`/api/portfolio?${params}`);
        const items = await response.json();
        
        if (response.ok) {
            displayPortfolioItems(items, append);
            
            // Show/hide load more button
            const loadMoreContainer = document.getElementById('load-more-container');
            loadMoreContainer.style.display = items.length === 12 ? 'block' : 'none';
        } else {
            showNotification('Portfolio ma\'lumotlarini yuklashda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Load portfolio error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        isLoading = false;
        showLoading(false);
    }
}

function displayPortfolioItems(items, append = false) {
    const grid = document.getElementById('portfolio-grid');
    const noResults = document.getElementById('no-results');
    
    if (items.length === 0 && !append) {
        grid.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    noResults.style.display = 'none';
    
    const itemsHTML = items.map(item => `
        <div class="portfolio-item" onclick="viewProject(${item.id})">
            <div class="portfolio-image">
                <img src="${item.image_url || 'https://via.placeholder.com/350x250?text=No+Image'}" 
                     alt="${item.title}" loading="lazy">
                <div class="portfolio-overlay">
                    <div class="overlay-content">
                        <h3>${item.title}</h3>
                        <p>${getCategoryDisplayName(item.category)}</p>
                        <button class="view-btn">
                            <i class="fas fa-eye"></i> Ko'rish
                        </button>
                    </div>
                </div>
            </div>
            <div class="portfolio-content">
                <div class="portfolio-category">${getCategoryDisplayName(item.category)}</div>
                <h3 class="portfolio-title">${item.title}</h3>
                <p class="portfolio-description">${item.description}</p>
                <div class="portfolio-technologies">
                    ${item.technologies.slice(0, 3).map(tech => 
                        `<span class="tech-tag">${tech}</span>`
                    ).join('')}
                    ${item.technologies.length > 3 ? `<span class="tech-tag">+${item.technologies.length - 3}</span>` : ''}
                </div>
            </div>
        </div>
    `).join('');
    
    if (append) {
        grid.insertAdjacentHTML('beforeend', itemsHTML);
    } else {
        grid.innerHTML = itemsHTML;
    }
}

// Category selection
function selectCategory(category, element) {
    // Update active tab
    document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
    element.classList.add('active');
    
    // Update filter select
    document.getElementById('category-filter').value = category;
    
    // Load items
    currentCategory = category;
    currentPage = 1;
    loadPortfolioItems();
}

function filterByCategory() {
    const select = document.getElementById('category-filter');
    const category = select.value;
    
    // Update category tab
    document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
    const categoryTab = document.querySelector(`[data-category="${category}"]`);
    if (categoryTab) categoryTab.classList.add('active');
    
    currentCategory = category;
    currentPage = 1;
    loadPortfolioItems();
}

// Search functionality
function searchPortfolio() {
    const query = document.getElementById('search-input').value.trim();
    
    if (query.length === 0) {
        loadPortfolioItems();
        return;
    }
    
    performSearch(query);
}

async function performSearch(query) {
    showLoading(true);
    
    try {
        const params = new URLSearchParams({
            category: currentCategory !== 'all' ? currentCategory : ''
        });
        
        const response = await fetch(`/api/portfolio/search/${encodeURIComponent(query)}?${params}`);
        const items = await response.json();
        
        if (response.ok) {
            displayPortfolioItems(items);
        } else {
            showNotification('Qidirishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Search error:', error);
        showNotification('Qidirishda xatolik!', 'error');
    } finally {
        showLoading(false);
    }
}

// Clear filters
function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = 'all';
    
    // Reset to "All" category
    document.querySelectorAll('.category-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector('[data-category="all"]').classList.add('active');
    
    currentCategory = 'all';
    currentPage = 1;
    loadPortfolioItems();
}

// Load more items
function loadMoreItems() {
    currentPage++;
    loadPortfolioItems(true);
}

// View project details
async function viewProject(projectId) {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/portfolio/${projectId}`);
        const project = await response.json();
        
        if (response.ok) {
            showProjectDetail(project);
        } else {
            showNotification('Loyiha ma\'lumotlarini yuklashda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('View project error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function showProjectDetail(project) {
    const modal = document.getElementById('projectModal');
    const detailContainer = document.getElementById('project-detail');
    
    const adminActions = isAdmin() ? `
        <div class="project-actions">
            <button class="btn-secondary" onclick="editProject(${project.id})">
                <i class="fas fa-edit"></i> Tahrirlash
            </button>
            <button class="btn-danger" onclick="deleteProject(${project.id})">
                <i class="fas fa-trash"></i> O'chirish
            </button>
        </div>
    ` : '';
    
    detailContainer.innerHTML = `
        <div class="project-hero">
            <img src="${project.image_url || 'https://via.placeholder.com/800x300?text=No+Image'}" 
                 alt="${project.title}">
        </div>
        
        <div class="project-meta">
            <div>
                <h1>${project.title}</h1>
                <span class="project-category-badge">${getCategoryDisplayName(project.category)}</span>
            </div>
            ${adminActions}
        </div>
        
        <div class="project-description-full">
            ${project.description}
        </div>
        
        ${project.technologies.length > 0 ? `
            <div class="project-technologies">
                <h3>Ishlatilgan texnologiyalar:</h3>
                <div class="project-tech-list">
                    ${project.technologies.map(tech => `<span class="tech-badge">${tech}</span>`).join('')}
                </div>
            </div>
        ` : ''}
        
        ${project.project_url ? `
            <div style="text-align: center; margin-top: 2rem;">
                <a href="${project.project_url}" target="_blank" class="btn-primary btn-large">
                    <i class="fas fa-external-link-alt"></i> Loyihani ko'rish
                </a>
            </div>
        ` : ''}
    `;
    
    modal.style.display = 'block';
}

function closeProjectModal() {
    document.getElementById('projectModal').style.display = 'none';
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
        
        const response = await fetch('/api/portfolio/admin/stats', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const stats = await response.json();
        
        if (response.ok) {
            document.getElementById('total-projects').textContent = stats.totalItems;
            document.getElementById('total-categories').textContent = stats.categories.length;
        }
        
    } catch (error) {
        console.error('Load admin stats error:', error);
    }
}

// Add/Edit project
function showAddProjectModal() {
    editingProjectId = null;
    document.getElementById('project-form-title').textContent = 'Loyiha qo\'shish';
    document.getElementById('submit-text').textContent = 'Saqlash';
    document.getElementById('project-form').reset();
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('addProjectModal').style.display = 'block';
}

async function editProject(projectId) {
    try {
        const response = await fetch(`/api/portfolio/${projectId}`);
        const project = await response.json();
        
        if (response.ok) {
            editingProjectId = projectId;
            document.getElementById('project-form-title').textContent = 'Loyihani tahrirlash';
            document.getElementById('submit-text').textContent = 'Yangilash';
            
            // Fill form
            document.getElementById('project-title').value = project.title;
            document.getElementById('project-category').value = project.category;
            document.getElementById('project-description').value = project.description;
            document.getElementById('project-url').value = project.project_url || '';
            document.getElementById('project-technologies').value = project.technologies.join(', ');
            
            // Show current image
            if (project.image_url) {
                document.getElementById('preview-img').src = project.image_url;
                document.getElementById('image-preview').style.display = 'block';
            }
            
            document.getElementById('addProjectModal').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Edit project error:', error);
        showNotification('Loyihani yuklashda xatolik!', 'error');
    }
}

async function handleProjectSubmit(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Kirish talab qilinadi!', 'error');
        return;
    }
    
    const formData = new FormData(event.target);
    const submitBtn = event.target.querySelector('[type="submit"]');
    
    // Show loading
    document.getElementById('form-spinner').style.display = 'inline-block';
    document.getElementById('submit-text').textContent = 'Saqlanmoqda...';
    submitBtn.disabled = true;
    
    try {
        const url = editingProjectId 
            ? `/api/portfolio/${editingProjectId}`
            : '/api/portfolio';
        
        const method = editingProjectId ? 'PUT' : 'POST';
        
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
                editingProjectId ? 'Loyiha yangilandi!' : 'Loyiha qo\'shildi!', 
                'success'
            );
            closeAddProjectModal();
            loadPortfolioItems();
            loadCategories();
            loadAdminStats();
        } else {
            showNotification(result.error || 'Xatolik yuz berdi!', 'error');
        }
        
    } catch (error) {
        console.error('Submit project error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        // Reset loading state
        document.getElementById('form-spinner').style.display = 'none';
        document.getElementById('submit-text').textContent = editingProjectId ? 'Yangilash' : 'Saqlash';
        submitBtn.disabled = false;
    }
}

async function deleteProject(projectId) {
    if (!confirm('Haqiqatan ham bu loyihani o\'chirmoqchimisiz?')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`/api/portfolio/${projectId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Loyiha o\'chirildi!', 'success');
            closeProjectModal();
            loadPortfolioItems();
            loadCategories();
            loadAdminStats();
        } else {
            showNotification(result.error || 'O\'chirishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Delete project error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function closeAddProjectModal() {
    document.getElementById('addProjectModal').style.display = 'none';
    editingProjectId = null;
}

// Image preview
function handleImagePreview(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('preview-img').src = e.target.result;
            document.getElementById('image-preview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function removeImage() {
    document.getElementById('project-image').value = '';
    document.getElementById('image-preview').style.display = 'none';
}

// Utility functions
function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const projectModal = document.getElementById('projectModal');
    const addProjectModal = document.getElementById('addProjectModal');
    
    if (event.target === projectModal) {
        closeProjectModal();
    }
    
    if (event.target === addProjectModal) {
        closeAddProjectModal();
    }
});

// Global functions
window.selectCategory = selectCategory;
window.filterByCategory = filterByCategory;
window.searchPortfolio = searchPortfolio;
window.clearFilters = clearFilters;
window.loadMoreItems = loadMoreItems;
window.viewProject = viewProject;
window.closeProjectModal = closeProjectModal;
window.showAddProjectModal = showAddProjectModal;
window.editProject = editProject;
window.deleteProject = deleteProject;
window.closeAddProjectModal = closeAddProjectModal;
window.removeImage = removeImage;