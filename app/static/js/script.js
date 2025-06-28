// Global variables
let searchModeEnabled = false;
let quotedText = '';
let isProcessing = false;

// DOM elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const searchToggle = document.getElementById('searchToggle');
const themeToggle = document.getElementById('themeToggle');
const userBtn = document.getElementById('userBtn');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');
const imageUpload = document.getElementById('imageUpload');
const quotedTextContainer = document.getElementById('quoted-text-container');
const quotedTextSpan = document.getElementById('quoted-text');
const charCount = document.getElementById('charCount');
const searchStatus = document.getElementById('searchStatus');
const loadingOverlay = document.getElementById('loadingOverlay');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadTheme();
    setupAutoResize();
    updateCharCount();
});

// Setup all event listeners
function setupEventListeners() {
    // Send message
    sendBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keydown', handleKeyPress);
    
    // Search toggle
    searchToggle.addEventListener('click', toggleSearchMode);
    
    // Theme toggle
    themeToggle.addEventListener('click', toggleTheme);
    
    // User menu
    userBtn.addEventListener('click', toggleUserDropdown);
    logoutBtn.addEventListener('click', handleLogout);
    
    // File upload
    imageUpload.addEventListener('change', handleFileUpload);
    
    // Click outside to close dropdown
    document.addEventListener('click', function(e) {
        if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
    });
    
    // Quote functionality
    messagesContainer.addEventListener('click', function(e) {
        if (e.target.classList.contains('quote-btn')) {
            const messageContent = e.target.closest('.message').querySelector('.message-text').textContent;
            quoteText(messageContent);
        }
        
        if (e.target.classList.contains('copy-btn')) {
            const messageContent = e.target.closest('.message').querySelector('.message-text').textContent;
            copyToClipboard(messageContent);
        }
    });
}

// Handle key press events
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// Send message function
async function sendMessage() {
    if (isProcessing) return;
    
    const message = messageInput.value.trim();
    if (!message) return;
    
    isProcessing = true;
    sendBtn.disabled = true;
    
    try {
        // Add user message to UI
        addMessageToUI('user', message);
        
        // Clear input
        messageInput.value = '';
        updateCharCount();
        setupAutoResize();
        
        // Remove welcome message if it exists
        const welcomeMessage = document.querySelector('.welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }
        
        // Send to API
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                use_search: searchModeEnabled,
                quoted_text: quotedText
            })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botMessageElement = null;
        let searchingMessage = null;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));
                        
                        if (data.status === 'searching') {
                            // Show searching message
                            if (!searchingMessage) {
                                searchingMessage = document.createElement('div');
                                searchingMessage.className = 'message bot-message searching-message';
                                searchingMessage.textContent = 'Searching...';
                                messagesContainer.appendChild(searchingMessage);
                            }
                        } else if (data.response) {
                            // Remove searching message if it exists
                            if (searchingMessage) {
                                searchingMessage.remove();
                                searchingMessage = null;
                            }
                            
                            // Create or update bot message
                            if (!botMessageElement) {
                                botMessageElement = document.createElement('div');
                                botMessageElement.className = 'message bot-message';
                                messagesContainer.appendChild(botMessageElement);
                                
                                // Add avatar
                                const avatar = document.createElement('div');
                                avatar.className = 'message-avatar';
                                avatar.innerHTML = '<i class="fas fa-robot"></i>';
                                botMessageElement.appendChild(avatar);
                                
                                // Add content container
                                const content = document.createElement('div');
                                content.className = 'message-content';
                                botMessageElement.appendChild(content);
                                
                                // Add text container
                                const textContainer = document.createElement('div');
                                textContainer.className = 'message-text';
                                content.appendChild(textContainer);
                                
                                // Add actions
                                const actions = document.createElement('div');
                                actions.className = 'message-actions';
                                actions.innerHTML = `
                                    <button class="quote-btn" title="Quote this message">
                                        <i class="fas fa-quote-left"></i> Quote
                                    </button>
                                    <button class="copy-btn" title="Copy to clipboard">
                                        <i class="fas fa-copy"></i> Copy
                                    </button>
                                `;
                                content.appendChild(actions);
                            }
                            
                            // Update the message text with markdown
                            const textContainer = botMessageElement.querySelector('.message-text');
                            textContainer.innerHTML = marked.parse(data.response);
                        } else if (data.error) {
                            // Handle error
                            if (searchingMessage) {
                                searchingMessage.remove();
                            }
                            
                            if (!botMessageElement) {
                                botMessageElement = document.createElement('div');
                                botMessageElement.className = 'message bot-message';
                                messagesContainer.appendChild(botMessageElement);
                                
                                const avatar = document.createElement('div');
                                avatar.className = 'message-avatar';
                                avatar.innerHTML = '<i class="fas fa-robot"></i>';
                                botMessageElement.appendChild(avatar);
                                
                                const content = document.createElement('div');
                                content.className = 'message-content';
                                content.innerHTML = `<div class="message-text">Error: ${data.error}</div>`;
                                botMessageElement.appendChild(content);
                            }
                        }
                    } catch (parseError) {
                        console.error('Error parsing SSE data:', parseError);
                    }
                }
            }
        }
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Clear quote after sending
        removeQuote();
        
    } catch (error) {
        console.error('Error sending message:', error);
        addMessageToUI('assistant', `Sorry, I encountered an error: ${error.message}`);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
    }
}

// Add message to UI
function addMessageToUI(role, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    // Add avatar
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    if (role === 'user') {
        avatar.innerHTML = '<i class="fas fa-user"></i>';
    } else {
        avatar.innerHTML = '<i class="fas fa-robot"></i>';
    }
    messageDiv.appendChild(avatar);
    
    // Add content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = marked.parse(content);
    contentDiv.appendChild(textDiv);
    
    // Add actions for bot messages
    if (role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="quote-btn" title="Quote this message">
                <i class="fas fa-quote-left"></i> Quote
            </button>
            <button class="copy-btn" title="Copy to clipboard">
                <i class="fas fa-copy"></i> Copy
            </button>
        `;
        contentDiv.appendChild(actions);
    }
    
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Toggle search mode
function toggleSearchMode() {
    searchModeEnabled = !searchModeEnabled;
    searchToggle.classList.toggle('active', searchModeEnabled);
    
    const statusText = searchStatus.querySelector('span');
    if (searchModeEnabled) {
        statusText.textContent = 'Search enabled';
        searchStatus.style.color = 'var(--accent-color)';
    } else {
        statusText.textContent = 'Auto-search enabled';
        searchStatus.style.color = 'var(--text-muted)';
    }
}

// Toggle theme
function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Update theme toggle icon
    const icon = themeToggle.querySelector('i');
    if (newTheme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Load saved theme
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const icon = themeToggle.querySelector('i');
    if (savedTheme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Toggle user dropdown
function toggleUserDropdown() {
    userDropdown.classList.toggle('show');
}

// Handle logout
async function handleLogout() {
    try {
        const response = await fetch('/auth/logout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Handle file upload
async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Add file content to message input
            const currentInput = messageInput.value;
            const fileInfo = `[Uploaded: ${data.filename}]\n${data.content}\n\n`;
            messageInput.value = fileInfo + currentInput;
            updateCharCount();
            setupAutoResize();
        } else {
            alert('Error uploading file: ' + data.error);
        }
    } catch (error) {
        console.error('Upload error:', error);
        alert('Error uploading file');
    } finally {
        showLoading(false);
        event.target.value = ''; // Clear file input
    }
}

// Quote text functionality
function quoteText(text) {
    quotedText = text;
    quotedTextSpan.textContent = text.length > 100 ? text.substring(0, 100) + '...' : text;
    quotedTextContainer.style.display = 'block';
}

// Remove quote
function removeQuote() {
    quotedText = '';
    quotedTextContainer.style.display = 'none';
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        
        // Show temporary success message
        const button = event.target.closest('.copy-btn');
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-check"></i> Copied!';
        button.style.color = 'var(--success-color)';
        
        setTimeout(() => {
            button.innerHTML = originalText;
            button.style.color = '';
        }, 2000);
    } catch (error) {
        console.error('Copy failed:', error);
        alert('Failed to copy to clipboard');
    }
}

// Auto-resize textarea
function setupAutoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
}

// Update character count
function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count}/4000`;
    
    if (count > 3500) {
        charCount.style.color = 'var(--warning-color)';
    } else if (count > 3800) {
        charCount.style.color = 'var(--error-color)';
    } else {
        charCount.style.color = 'var(--text-muted)';
    }
}

// Show/hide loading overlay
function showLoading(show) {
    loadingOverlay.style.display = show ? 'flex' : 'none';
}

// Add input event listeners for auto-resize and char count
messageInput.addEventListener('input', function() {
    setupAutoResize();
    updateCharCount();
});

// Configure marked.js for better markdown rendering
marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false
}); 