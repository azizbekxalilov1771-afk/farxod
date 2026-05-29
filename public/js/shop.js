// Shop JavaScript

let allProducts = [];
let allCategories = [];
let cart = [];
let currentProductId = null;
let editingProductId = null;
let currentPage = 0;
let currentFilters = {
    category: 'all',
    search: '',
    sort: 'created_at_desc'
};
let checkoutStep = 1;

// Initialize shop page
document.addEventListener('DOMContentLoaded', function() {
    loadCategories();
    loadProducts();
    checkAdminAccess();
    setupEventListeners();
    loadCart();
    updateCartUI();
});

function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('search-input');
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchProducts();
        }
    });
    
    // Product form submission
    const productForm = document.getElementById('product-form');
    productForm.addEventListener('submit', handleProductSubmit);
    
    // Image upload preview
    const imageInput = document.getElementById('product-image');
    imageInput.addEventListener('change', handleImagePreview);
    
    // Shipping form submission
    const shippingForm = document.getElementById('shipping-form');
    shippingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        nextCheckoutStep();
    });
}

// Load product categories
async function loadCategories() {
    try {
        const response = await fetch('/api/shop/categories');
        const categories = await response.json();
        
        allCategories = categories;
        displayCategories(categories);
        updateCategoryFilter(categories);
        
    } catch (error) {
        console.error('Load categories error:', error);
    }
}

function displayCategories(categories) {
    const grid = document.getElementById('categories-grid');
    
    grid.innerHTML = categories.map(category => `
        <div class="category-card" onclick="filterByCategory('${category.id}')">
            <div class="category-icon">
                <i class="${category.icon}"></i>
            </div>
            <h3>${category.name}</h3>
            <div class="category-count">${category.count} mahsulot</div>
        </div>
    `).join('');
}

function updateCategoryFilter(categories) {
    const filterSelect = document.getElementById('category-filter');
    
    let optionsHTML = '<option value="all">Barcha kategoriyalar</option>';
    categories.forEach(category => {
        optionsHTML += `<option value="${category.id}">${category.name} (${category.count})</option>`;
    });
    
    filterSelect.innerHTML = optionsHTML;
}

// Load products
async function loadProducts(append = false) {
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            category: currentFilters.category !== 'all' ? currentFilters.category : '',
            search: currentFilters.search,
            sort: currentFilters.sort,
            limit: 12,
            offset: currentPage * 12
        });
        
        const response = await fetch(`/api/shop/products?${params}`);
        const products = await response.json();
        
        if (response.ok) {
            if (append) {
                allProducts = [...allProducts, ...products];
            } else {
                allProducts = products;
            }
            displayProducts(append);
            
            // Show/hide load more button
            const loadMoreContainer = document.getElementById('load-more-container');
            loadMoreContainer.style.display = products.length === 12 ? 'block' : 'none';
        } else {
            showNotification('Mahsulotlar ma\'lumotlarini yuklashda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Load products error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function displayProducts(append = false) {
    const grid = document.getElementById('products-grid');
    const noResults = document.getElementById('no-results');
    
    if (allProducts.length === 0 && !append) {
        grid.style.display = 'none';
        noResults.style.display = 'block';
        return;
    }
    
    grid.style.display = 'grid';
    noResults.style.display = 'none';
    
    const productsToShow = append ? allProducts.slice(-12) : allProducts;
    
    const productsHTML = productsToShow.map(product => {
        const categoryName = getCategoryName(product.category);
        const isNew = new Date(product.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        return `
            <div class="product-card" onclick="viewProduct(${product.id})">
                ${isNew ? '<div class="product-badge">Yangi</div>' : ''}
                
                <div class="product-image">
                    <img src="${product.image_url || 'https://via.placeholder.com/300x200?text=Product'}" 
                         alt="${product.name}" loading="lazy">
                    <div class="product-overlay">
                        <div class="quick-actions">
                            <button class="action-btn" onclick="event.stopPropagation(); viewProduct(${product.id})" title="Ko'rish">
                                <i class="fas fa-eye"></i>
                            </button>
                            <button class="action-btn" onclick="event.stopPropagation(); addToCart(${product.id})" title="Savatga qo'shish">
                                <i class="fas fa-cart-plus"></i>
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="product-content">
                    <div class="product-category">${categoryName}</div>
                    <h3 class="product-title">${product.name}</h3>
                    <p class="product-description">${product.description}</p>
                    <div class="product-price">$${product.price}</div>
                    <div class="product-actions">
                        <button class="btn-primary btn-small" onclick="event.stopPropagation(); addToCart(${product.id})">
                            <i class="fas fa-cart-plus"></i> Savatga
                        </button>
                        <button class="btn-outline btn-small" onclick="event.stopPropagation(); viewProduct(${product.id})">
                            Ko'rish
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    if (append) {
        grid.insertAdjacentHTML('beforeend', productsHTML);
    } else {
        grid.innerHTML = productsHTML;
    }
}

function getCategoryName(categoryId) {
    const category = allCategories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId;
}

// Filter and search functions
function filterByCategory(categoryId) {
    currentFilters.category = categoryId;
    currentPage = 0;
    document.getElementById('category-filter').value = categoryId;
    loadProducts();
}

function filterByCategory() {
    const categoryFilter = document.getElementById('category-filter').value;
    currentFilters.category = categoryFilter;
    currentPage = 0;
    loadProducts();
}

function sortProducts() {
    const sortFilter = document.getElementById('sort-filter').value;
    currentFilters.sort = sortFilter;
    currentPage = 0;
    loadProducts();
}

function searchProducts() {
    const query = document.getElementById('search-input').value.trim();
    currentFilters.search = query;
    currentPage = 0;
    
    if (query.length === 0) {
        loadProducts();
    } else {
        performSearch(query);
    }
}

async function performSearch(query) {
    try {
        showLoading(true);
        
        const params = new URLSearchParams({
            category: currentFilters.category !== 'all' ? currentFilters.category : ''
        });
        
        const response = await fetch(`/api/shop/search/${encodeURIComponent(query)}?${params}`);
        const products = await response.json();
        
        if (response.ok) {
            allProducts = products;
            displayProducts();
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

function clearFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('category-filter').value = 'all';
    document.getElementById('sort-filter').value = 'created_at_desc';
    
    currentFilters = {
        category: 'all',
        search: '',
        sort: 'created_at_desc'
    };
    currentPage = 0;
    loadProducts();
}

function loadMoreProducts() {
    currentPage++;
    loadProducts(true);
}

// View toggle
function toggleView(viewType) {
    const grid = document.getElementById('products-grid');
    const buttons = document.querySelectorAll('.view-btn');
    
    buttons.forEach(btn => btn.classList.remove('active'));
    document.querySelector(`[data-view="${viewType}"]`).classList.add('active');
    
    if (viewType === 'list') {
        grid.classList.add('list-view');
    } else {
        grid.classList.remove('list-view');
    }
}

// Product detail functions
async function viewProduct(productId) {
    try {
        showLoading(true);
        
        const response = await fetch(`/api/shop/products/${productId}`);
        const product = await response.json();
        
        if (response.ok) {
            showProductDetail(product);
        } else {
            showNotification('Mahsulot ma\'lumotlarini yuklashda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('View product error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function showProductDetail(product) {
    const modal = document.getElementById('productModal');
    const detailContainer = document.getElementById('product-detail');
    
    const categoryName = getCategoryName(product.category);
    
    const adminActions = isAdmin() ? `
        <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid #e0e0e0;">
            <div style="display: flex; gap: 1rem;">
                <button class="btn-secondary" onclick="editProduct(${product.id})">
                    <i class="fas fa-edit"></i> Tahrirlash
                </button>
                <button class="btn-danger" onclick="deleteProduct(${product.id})">
                    <i class="fas fa-trash"></i> O'chirish
                </button>
            </div>
        </div>
    ` : '';
    
    detailContainer.innerHTML = `
        <div class="product-hero">
            <div class="product-hero-image">
                <img src="${product.image_url || 'https://via.placeholder.com/400x400?text=Product'}" 
                     alt="${product.name}">
            </div>
            <div class="product-hero-info">
                <span class="product-category-badge">${categoryName}</span>
                <h1 class="product-hero-title">${product.name}</h1>
                <div class="product-hero-price">$${product.price}</div>
                <div class="product-actions-hero">
                    <button class="btn-primary btn-large" onclick="addToCart(${product.id})">
                        <i class="fas fa-cart-plus"></i> Savatga qo'shish
                    </button>
                    <button class="btn-outline btn-large" onclick="buyNow(${product.id})">
                        <i class="fas fa-bolt"></i> Darhol sotib olish
                    </button>
                </div>
                <ul class="product-features">
                    <li><i class="fas fa-check"></i> Raqamiy mahsulot</li>
                    <li><i class="fas fa-check"></i> Darhol yuklab olish</li>
                    <li><i class="fas fa-check"></i> To'liq litsenziya</li>
                    ${product.stock_quantity > 0 ? `<li><i class="fas fa-check"></i> Zaxirada: ${product.stock_quantity} ta</li>` : ''}
                </ul>
            </div>
        </div>
        
        <div style="margin-top: 3rem;">
            <h2>Mahsulot haqida</h2>
            <p style="line-height: 1.6; color: #333; font-size: 1.1rem;">${product.description}</p>
        </div>
        
        ${adminActions}
    `;
    
    modal.style.display = 'block';
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

// Shopping cart functions
function loadCart() {
    const savedCart = localStorage.getItem('shopping_cart');
    if (savedCart) {
        cart = JSON.parse(savedCart);
    }
}

function saveCart() {
    localStorage.setItem('shopping_cart', JSON.stringify(cart));
}

function addToCart(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) {
        showNotification('Mahsulot topilmadi!', 'error');
        return;
    }
    
    const existingItem = cart.find(item => item.id === productId);
    
    if (existingItem) {
        existingItem.quantity += 1;
    } else {
        cart.push({
            id: productId,
            name: product.name,
            price: product.price,
            image_url: product.image_url,
            quantity: 1
        });
    }
    
    saveCart();
    updateCartUI();
    showNotification('Mahsulot savatga qo\'shildi!', 'success');
    
    // Close product modal if open
    closeProductModal();
}

function removeFromCart(productId) {
    cart = cart.filter(item => item.id !== productId);
    saveCart();
    updateCartUI();
    showNotification('Mahsulot savatdan o\'chirildi!', 'success');
}

function updateCartQuantity(productId, newQuantity) {
    if (newQuantity <= 0) {
        removeFromCart(productId);
        return;
    }
    
    const item = cart.find(item => item.id === productId);
    if (item) {
        item.quantity = newQuantity;
        saveCart();
        updateCartUI();
    }
}

function updateCartUI() {
    const cartBadge = document.getElementById('cart-badge');
    const cartItems = document.getElementById('cart-items');
    const cartEmpty = document.getElementById('cart-empty');
    const cartTotal = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('checkout-btn');
    
    const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    cartBadge.textContent = totalItems;
    cartTotal.textContent = totalPrice.toFixed(2);
    
    if (cart.length === 0) {
        cartItems.style.display = 'none';
        cartEmpty.style.display = 'block';
        checkoutBtn.disabled = true;
    } else {
        cartItems.style.display = 'block';
        cartEmpty.style.display = 'none';
        checkoutBtn.disabled = false;
        
        cartItems.innerHTML = cart.map(item => `
            <div class="cart-item">
                <div class="cart-item-image">
                    <img src="${item.image_url || 'https://via.placeholder.com/60x60?text=Product'}" 
                         alt="${item.name}">
                </div>
                <div class="cart-item-info">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">$${item.price}</div>
                    <div class="cart-item-controls">
                        <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity - 1})">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input type="number" class="quantity-input" value="${item.quantity}" 
                               onchange="updateCartQuantity(${item.id}, parseInt(this.value))" min="1">
                        <button class="quantity-btn" onclick="updateCartQuantity(${item.id}, ${item.quantity + 1})">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="remove-item" onclick="removeFromCart(${item.id})">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }
}

function showCart() {
    document.getElementById('cart-sidebar').classList.add('open');
    document.getElementById('cart-overlay').classList.add('open');
}

function hideCart() {
    document.getElementById('cart-sidebar').classList.remove('open');
    document.getElementById('cart-overlay').classList.remove('open');
}

function buyNow(productId) {
    addToCart(productId);
    setTimeout(() => {
        checkout();
    }, 500);
}

// Checkout functions
function checkout() {
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    if (cart.length === 0) {
        showNotification('Savat bo\'sh!', 'error');
        return;
    }
    
    hideCart();
    showCheckoutModal();
}

function showCheckoutModal() {
    checkoutStep = 1;
    updateCheckoutStep();
    document.getElementById('checkoutModal').style.display = 'block';
}

function updateCheckoutStep() {
    // Update step indicators
    document.querySelectorAll('.step').forEach((step, index) => {
        step.classList.toggle('active', index + 1 <= checkoutStep);
    });
    
    // Show/hide step content
    document.querySelectorAll('.checkout-step').forEach((step, index) => {
        step.style.display = index + 1 === checkoutStep ? 'block' : 'none';
    });
    
    // Update buttons
    const prevBtn = document.getElementById('prev-step-btn');
    const nextBtn = document.getElementById('next-step-btn');
    const completeBtn = document.getElementById('complete-order-btn');
    
    prevBtn.style.display = checkoutStep > 1 ? 'block' : 'none';
    nextBtn.style.display = checkoutStep < 3 ? 'block' : 'none';
    completeBtn.style.display = checkoutStep === 3 ? 'block' : 'none';
    
    // Update step-specific content
    if (checkoutStep === 1) {
        updateOrderSummary();
    } else if (checkoutStep === 3) {
        updateCheckoutTotal();
    }
}

function updateOrderSummary() {
    const orderSummary = document.getElementById('order-summary');
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    orderSummary.innerHTML = `
        <h4>Buyurtma tafsilotlari</h4>
        ${cart.map(item => `
            <div class="order-item" style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                <span>${item.name} x ${item.quantity}</span>
                <span>$${(item.price * item.quantity).toFixed(2)}</span>
            </div>
        `).join('')}
        <hr>
        <div class="order-item" style="display: flex; justify-content: space-between; font-weight: bold; font-size: 1.1rem;">
            <span>Jami:</span>
            <span>$${totalPrice.toFixed(2)}</span>
        </div>
    `;
}

function updateCheckoutTotal() {
    const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    document.getElementById('checkout-total').textContent = totalPrice.toFixed(2);
}

function nextCheckoutStep() {
    if (checkoutStep < 3) {
        checkoutStep++;
        updateCheckoutStep();
    }
}

function prevCheckoutStep() {
    if (checkoutStep > 1) {
        checkoutStep--;
        updateCheckoutStep();
    }
}

async function completeOrder() {
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return;
    }
    
    const shippingData = new FormData(document.getElementById('shipping-form'));
    const shippingAddress = {
        name: shippingData.get('name'),
        phone: shippingData.get('phone'),
        address: shippingData.get('address')
    };
    
    try {
        showLoading(true);
        
        // Create order
        const response = await fetch('/api/shop/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: cart.map(item => ({ productId: item.id, quantity: item.quantity })),
                shippingAddress: shippingAddress,
                paymentMethod: 'card'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            // Process payment
            await payForProducts(cart);
            
            // Clear cart
            cart = [];
            saveCart();
            updateCartUI();
            
            showNotification('Buyurtma muvaffaqiyatli yaratildi!', 'success');
            closeCheckoutModal();
            
        } else {
            showNotification(result.error || 'Buyurtma yaratishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Complete order error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        showLoading(false);
    }
}

function closeCheckoutModal() {
    document.getElementById('checkoutModal').style.display = 'none';
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
        
        const response = await fetch('/api/shop/stats', {
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
            <div class="admin-stat-number">${stats.totalProducts}</div>
            <div class="admin-stat-label">Jami mahsulotlar</div>
        </div>
        <div class="admin-stat-card">
            <div class="admin-stat-number">${stats.activeProducts}</div>
            <div class="admin-stat-label">Faol mahsulotlar</div>
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

// Add/Edit product
function showAddProductModal() {
    editingProductId = null;
    document.getElementById('product-form-title').textContent = 'Mahsulot qo\'shish';
    document.getElementById('product-submit-text').textContent = 'Saqlash';
    document.getElementById('product-form').reset();
    document.getElementById('image-preview').style.display = 'none';
    document.getElementById('addProductModal').style.display = 'block';
}

async function editProduct(productId) {
    try {
        const response = await fetch(`/api/shop/products/${productId}`);
        const product = await response.json();
        
        if (response.ok) {
            editingProductId = productId;
            document.getElementById('product-form-title').textContent = 'Mahsulotni tahrirlash';
            document.getElementById('product-submit-text').textContent = 'Yangilash';
            
            // Fill form
            document.getElementById('product-name').value = product.name;
            document.getElementById('product-category').value = product.category;
            document.getElementById('product-price').value = product.price;
            document.getElementById('product-stock').value = product.stock_quantity;
            document.getElementById('product-description').value = product.description;
            
            // Show current image
            if (product.image_url) {
                document.getElementById('preview-img').src = product.image_url;
                document.getElementById('image-preview').style.display = 'block';
            }
            
            document.getElementById('addProductModal').style.display = 'block';
        }
        
    } catch (error) {
        console.error('Edit product error:', error);
        showNotification('Mahsulotni yuklashda xatolik!', 'error');
    }
}

async function handleProductSubmit(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('token');
    if (!token) {
        showNotification('Kirish talab qilinadi!', 'error');
        return;
    }
    
    const formData = new FormData(event.target);
    const submitBtn = event.target.querySelector('[type="submit"]');
    
    // Show loading
    document.getElementById('product-form-spinner').style.display = 'inline-block';
    document.getElementById('product-submit-text').textContent = 'Saqlanmoqda...';
    submitBtn.disabled = true;
    
    try {
        const url = editingProductId 
            ? `/api/shop/products/${editingProductId}`
            : '/api/shop/products';
        
        const method = editingProductId ? 'PUT' : 'POST';
        
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
                editingProductId ? 'Mahsulot yangilandi!' : 'Mahsulot qo\'shildi!', 
                'success'
            );
            closeAddProductModal();
            loadProducts();
            loadCategories();
            loadAdminStats();
        } else {
            showNotification(result.error || 'Xatolik yuz berdi!', 'error');
        }
        
    } catch (error) {
        console.error('Submit product error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    } finally {
        // Reset loading state
        document.getElementById('product-form-spinner').style.display = 'none';
        document.getElementById('product-submit-text').textContent = editingProductId ? 'Yangilash' : 'Saqlash';
        submitBtn.disabled = false;
    }
}

async function deleteProduct(productId) {
    if (!confirm('Haqiqatan ham bu mahsulotni o\'chirmoqchimisiz?')) {
        return;
    }
    
    const token = localStorage.getItem('token');
    if (!token) return;
    
    try {
        const response = await fetch(`/api/shop/products/${productId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Mahsulot o\'chirildi!', 'success');
            closeProductModal();
            loadProducts();
            loadCategories();
            loadAdminStats();
        } else {
            showNotification(result.error || 'O\'chirishda xatolik!', 'error');
        }
        
    } catch (error) {
        console.error('Delete product error:', error);
        showNotification('Tarmoq xatosi!', 'error');
    }
}

function closeAddProductModal() {
    document.getElementById('addProductModal').style.display = 'none';
    editingProductId = null;
}

function showOrdersModal() {
    // This would show orders management modal
    showNotification('Buyurtmalar boshqaruvi ishlab chiqilmoqda...', 'info');
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
    document.getElementById('product-image').value = '';
    document.getElementById('image-preview').style.display = 'none';
}

// Utility functions
function showLoading(show) {
    document.getElementById('loading-overlay').style.display = show ? 'flex' : 'none';
}

// Close modals when clicking outside
window.addEventListener('click', function(event) {
    const modals = ['productModal', 'addProductModal', 'checkoutModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Global functions
window.filterByCategory = filterByCategory;
window.filterByCategory = filterByCategory;
window.sortProducts = sortProducts;
window.searchProducts = searchProducts;
window.clearFilters = clearFilters;
window.loadMoreProducts = loadMoreProducts;
window.toggleView = toggleView;
window.viewProduct = viewProduct;
window.closeProductModal = closeProductModal;
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.updateCartQuantity = updateCartQuantity;
window.showCart = showCart;
window.hideCart = hideCart;
window.buyNow = buyNow;
window.checkout = checkout;
window.nextCheckoutStep = nextCheckoutStep;
window.prevCheckoutStep = prevCheckoutStep;
window.completeOrder = completeOrder;
window.closeCheckoutModal = closeCheckoutModal;
window.showAddProductModal = showAddProductModal;
window.editProduct = editProduct;
window.deleteProduct = deleteProduct;
window.closeAddProductModal = closeAddProductModal;
window.showOrdersModal = showOrdersModal;
window.removeImage = removeImage;