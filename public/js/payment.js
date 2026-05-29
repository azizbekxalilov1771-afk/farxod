// Payment Processing JavaScript

let stripe = null;
let elements = null;
let paymentElement = null;
let currentPaymentIntent = null;

// Initialize Stripe
async function initializeStripe() {
    try {
        const response = await fetch('/api/payment/config');
        const config = await response.json();
        
        stripe = Stripe(config.publicKey);
        console.log('Stripe initialized successfully');
    } catch (error) {
        console.error('Failed to initialize Stripe:', error);
        showNotification('To\'lov tizimini ishga tushirishda xatolik!', 'error');
    }
}

// Create payment for quiz reward
async function createQuizRewardPayment(quizId, amount, description = '') {
    if (!stripe) {
        await initializeStripe();
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return null;
    }
    
    try {
        const response = await fetch('/api/payment/create-intent/quiz', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                quizId: quizId,
                amount: amount,
                currency: 'usd'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentPaymentIntent = result;
            return result;
        } else {
            showNotification(result.error || 'To\'lov yaratishda xatolik!', 'error');
            return null;
        }
    } catch (error) {
        console.error('Create quiz payment error:', error);
        showNotification('Tarmoq xatosi!', 'error');
        return null;
    }
}

// Create payment for business service
async function createServicePayment(serviceId, amount, description = '') {
    if (!stripe) {
        await initializeStripe();
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return null;
    }
    
    try {
        const response = await fetch('/api/payment/create-intent/service', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                serviceId: serviceId,
                amount: amount,
                currency: 'usd',
                description: description
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentPaymentIntent = result;
            return result;
        } else {
            showNotification(result.error || 'To\'lov yaratishda xatolik!', 'error');
            return null;
        }
    } catch (error) {
        console.error('Create service payment error:', error);
        showNotification('Tarmoq xatosi!', 'error');
        return null;
    }
}

// Create payment for products
async function createProductPayment(items) {
    if (!stripe) {
        await initializeStripe();
    }
    
    const token = localStorage.getItem('token');
    if (!token) {
        showLogin();
        return null;
    }
    
    try {
        const response = await fetch('/api/payment/create-intent/product', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                items: items,
                currency: 'usd'
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            currentPaymentIntent = result;
            return result;
        } else {
            showNotification(result.error || 'To\'lov yaratishda xatolik!', 'error');
            return null;
        }
    } catch (error) {
        console.error('Create product payment error:', error);
        showNotification('Tarmoq xatosi!', 'error');
        return null;
    }
}

// Show payment modal
function showPaymentModal(paymentIntent, onSuccess = null) {
    if (!stripe || !paymentIntent) {
        showNotification('To\'lov ma\'lumotlari noto\'g\'ri!', 'error');
        return;
    }
    
    const modal = document.getElementById('paymentModal');
    if (!modal) {
        createPaymentModal();
    }
    
    const modal2 = document.getElementById('paymentModal');
    modal2.style.display = 'block';
    
    // Initialize payment element
    elements = stripe.elements({
        clientSecret: paymentIntent.clientSecret
    });
    
    paymentElement = elements.create('payment');
    paymentElement.mount('#payment-element');
    
    // Store success callback
    modal2.setAttribute('data-success-callback', onSuccess ? 'true' : 'false');
    if (onSuccess) {
        window.paymentSuccessCallback = onSuccess;
    }
}

// Create payment modal dynamically
function createPaymentModal() {
    const modalHTML = `
        <div id="paymentModal" class="modal">
            <div class="modal-content payment-modal">
                <span class="close" onclick="closePaymentModal()">&times;</span>
                <h2>To'lov</h2>
                <div class="payment-container">
                    <div class="payment-summary">
                        <h3>To'lov ma'lumotlari</h3>
                        <div class="payment-details" id="payment-details">
                            <!-- Payment details will be populated here -->
                        </div>
                    </div>
                    <form id="payment-form">
                        <div id="payment-element">
                            <!-- Stripe Elements will create form elements here -->
                        </div>
                        <div class="payment-actions">
                            <button type="button" class="btn-secondary" onclick="closePaymentModal()">
                                Bekor qilish
                            </button>
                            <button type="submit" class="btn-primary" id="submit-payment">
                                <span id="button-text">To'lovni amalga oshirish</span>
                                <div id="spinner" class="spinner" style="display: none;"></div>
                            </button>
                        </div>
                        <div id="payment-message" class="payment-message"></div>
                    </form>
                </div>
            </div>
        </div>
        
        <style>
        .payment-modal {
            max-width: 600px;
            width: 90%;
        }
        
        .payment-container {
            display: grid;
            gap: 2rem;
        }
        
        .payment-summary {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
        }
        
        .payment-details {
            display: grid;
            gap: 0.5rem;
        }
        
        .payment-detail-item {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #e0e0e0;
        }
        
        .payment-detail-item:last-child {
            border-bottom: none;
            font-weight: 600;
            font-size: 1.1rem;
        }
        
        #payment-element {
            margin: 1rem 0;
        }
        
        .payment-actions {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            margin-top: 2rem;
        }
        
        .payment-message {
            margin-top: 1rem;
            padding: 1rem;
            border-radius: 4px;
            display: none;
        }
        
        .payment-message.success {
            background: rgba(40, 167, 69, 0.1);
            color: #28a745;
            display: block;
        }
        
        .payment-message.error {
            background: rgba(220, 53, 69, 0.1);
            color: #dc3545;
            display: block;
        }
        
        .spinner {
            width: 20px;
            height: 20px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #667eea;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }
        </style>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add form submit handler
    document.getElementById('payment-form').addEventListener('submit', handlePaymentSubmit);
}

// Handle payment form submission
async function handlePaymentSubmit(event) {
    event.preventDefault();
    
    if (!stripe || !elements) {
        showPaymentMessage('To\'lov tizimi tayyor emas!', 'error');
        return;
    }
    
    setLoading(true);
    
    const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
            return_url: window.location.origin + '/payment-success.html'
        },
        redirect: 'if_required'
    });
    
    setLoading(false);
    
    if (error) {
        if (error.type === 'card_error' || error.type === 'validation_error') {
            showPaymentMessage(error.message, 'error');
        } else {
            showPaymentMessage('Kutilmagan xatolik yuz berdi!', 'error');
        }
    } else {
        // Payment successful
        await confirmPayment();
    }
}

// Confirm payment on server
async function confirmPayment() {
    const token = localStorage.getItem('token');
    
    try {
        const response = await fetch('/api/payment/confirm-payment', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                paymentIntentId: currentPaymentIntent.paymentIntentId
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showPaymentMessage('To\'lov muvaffaqiyatli amalga oshirildi!', 'success');
            
            // Call success callback if exists
            const modal = document.getElementById('paymentModal');
            if (modal.getAttribute('data-success-callback') === 'true' && window.paymentSuccessCallback) {
                window.paymentSuccessCallback(result);
            }
            
            setTimeout(() => {
                closePaymentModal();
                showNotification('To\'lov muvaffaqiyatli bajarildi!', 'success');
            }, 2000);
            
        } else {
            showPaymentMessage(result.error || 'To\'lovni tasdiqlashda xatolik!', 'error');
        }
    } catch (error) {
        console.error('Confirm payment error:', error);
        showPaymentMessage('Tarmoq xatosi!', 'error');
    }
}

// Utility functions
function showPaymentMessage(message, type) {
    const messageElement = document.getElementById('payment-message');
    messageElement.textContent = message;
    messageElement.className = `payment-message ${type}`;
}

function setLoading(isLoading) {
    const submitButton = document.getElementById('submit-payment');
    const buttonText = document.getElementById('button-text');
    const spinner = document.getElementById('spinner');
    
    if (isLoading) {
        submitButton.disabled = true;
        buttonText.textContent = 'Kutilmoqda...';
        spinner.style.display = 'inline-block';
    } else {
        submitButton.disabled = false;
        buttonText.textContent = 'To\'lovni amalga oshirish';
        spinner.style.display = 'none';
    }
}

function closePaymentModal() {
    const modal = document.getElementById('paymentModal');
    if (modal) {
        modal.style.display = 'none';
    }
    
    // Clean up Stripe elements
    if (paymentElement) {
        paymentElement.unmount();
        paymentElement = null;
    }
    
    if (elements) {
        elements = null;
    }
    
    currentPaymentIntent = null;
}

// Quick payment functions for different contexts
async function payForQuizReward(quizId, amount) {
    const paymentIntent = await createQuizRewardPayment(quizId, amount);
    if (paymentIntent) {
        updatePaymentDetails('Quiz Mukofoti', amount);
        showPaymentModal(paymentIntent, (result) => {
            // Handle successful quiz reward payment
            console.log('Quiz reward payment successful:', result);
        });
    }
}

async function payForService(serviceId, serviceName, amount) {
    const paymentIntent = await createServicePayment(serviceId, amount, `Xizmat: ${serviceName}`);
    if (paymentIntent) {
        updatePaymentDetails(serviceName, amount);
        showPaymentModal(paymentIntent, (result) => {
            // Handle successful service payment
            console.log('Service payment successful:', result);
            showNotification('Xizmat uchun to\'lov muvaffaqiyatli amalga oshirildi!', 'success');
        });
    }
}

async function payForProducts(cartItems) {
    const paymentIntent = await createProductPayment(cartItems);
    if (paymentIntent) {
        updatePaymentDetails('Mahsulotlar xaridi', paymentIntent.totalAmount, paymentIntent.items);
        showPaymentModal(paymentIntent, (result) => {
            // Handle successful product purchase
            console.log('Product purchase successful:', result);
            clearCart(); // Clear shopping cart
            showNotification('Mahsulotlar muvaffaqiyatli sotib olindi!', 'success');
        });
    }
}

function updatePaymentDetails(title, totalAmount, items = null) {
    const detailsContainer = document.getElementById('payment-details');
    let detailsHTML = `
        <div class="payment-detail-item">
            <span>Mahsulot/Xizmat:</span>
            <span>${title}</span>
        </div>
    `;
    
    if (items && items.length > 0) {
        items.forEach(item => {
            detailsHTML += `
                <div class="payment-detail-item">
                    <span>${item.name} x${item.quantity}:</span>
                    <span>$${item.total}</span>
                </div>
            `;
        });
    }
    
    detailsHTML += `
        <div class="payment-detail-item">
            <span>Jami:</span>
            <span>$${totalAmount}</span>
        </div>
    `;
    
    detailsContainer.innerHTML = detailsHTML;
}

// Initialize Stripe when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeStripe();
});

// Expose payment functions globally
window.payForQuizReward = payForQuizReward;
window.payForService = payForService;
window.payForProducts = payForProducts;
window.closePaymentModal = closePaymentModal;