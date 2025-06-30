// Global variables
let searchModeEnabled = false;
let quotedText = '';
let isProcessing = false;

// DOM elements
const messagesContainer = document.getElementById('messages');
const messageInput = document.getElementById('messageInput');
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
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const removeImageBtn = document.getElementById('removeImageBtn');
const audioRecordingIndicator = document.getElementById('audioRecordingIndicator');
const micRecordingIcon = document.getElementById('micRecordingIcon');
const recordingTimer = document.getElementById('recordingTimer');
const cancelAudioBtn = document.getElementById('cancelAudioBtn');
const actionBtn = document.getElementById('actionBtn');
const micIcon = actionBtn.querySelector('.mic-icon');
const sendIcon = actionBtn.querySelector('.send-icon');

// Audio recording state
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingInterval = null;
let audioBlob = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadTheme();
    setupAutoResize();
    updateCharCount();
});

// Setup all event listeners
function setupEventListeners() {
    messageInput.addEventListener('keydown', handleKeyPress);
    searchToggle.addEventListener('click', toggleSearchMode);
    themeToggle.addEventListener('click', toggleTheme);
    userBtn.addEventListener('click', toggleUserDropdown);
    logoutBtn.addEventListener('click', handleLogout);
    imageUpload.addEventListener('change', handleImageSelected);
    if (removeImageBtn) removeImageBtn.addEventListener('click', removeImagePreview);
    if (cancelAudioBtn) cancelAudioBtn.addEventListener('click', cancelAudioRecording);

    document.addEventListener('click', function(e) {
        if (!userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
        // Hide quote popup on any click outside of it
        const quotePopup = document.querySelector('.quote-popup');
        if (quotePopup && !quotePopup.contains(e.target)) {
            quotePopup.remove();
        }
    });

    messagesContainer.addEventListener('click', function(e) {
        const copyButton = e.target.closest('.copy-btn');
        if (copyButton) {
            const messageContent = copyButton.closest('.message').querySelector('.message-text').textContent;
            copyToClipboard(messageContent, copyButton);
        }
    });

    // Use mouseup to detect when a selection is made
    messagesContainer.addEventListener('mouseup', handleTextSelection);

    actionBtn.addEventListener('click', handleActionButton);
    messageInput.addEventListener('input', updateActionButtonState);
}


// Handle key press events
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!actionBtn.disabled) {
            sendMessage();
        }
    }
}

// Send message function
async function sendMessage() {
    if (isProcessing) return;
    const message = messageInput.value.trim();
    const hasImage = imagePreviewContainer && imagePreviewContainer.style.display !== 'none';
    const hasAudio = audioBlob != null;

    if (!message && !hasImage && !hasAudio) return;

    isProcessing = true;
    actionBtn.disabled = true;

    // --- MODIFICATION START ---
    // Capture the quoted text before it gets cleared
    const sentQuotedText = quotedText;
    
    // Add user message to UI, passing the captured quote
    let userContent = message;
    if (hasImage) {
        userContent += `<br><img src="${imagePreview.src}" class="inline-preview-image">`;
    }
    if (hasAudio) {
        const audioURL = URL.createObjectURL(audioBlob);
        userContent += `<br><audio controls src="${audioURL}"></audio>`;
    }
    // Pass sentQuotedText to the function that builds the UI
    addMessageToUI('user', userContent, false, sentQuotedText);
    // --- MODIFICATION END ---


    // Clear input and previews
    messageInput.value = '';
    updateActionButtonState();
    updateCharCount();
    setupAutoResize();
    removeImagePreview();
    cancelAudioRecording();
    removeQuote(); // This clears the quotedText global variable

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message: message,
                use_search: searchModeEnabled,
                quoted_text: sentQuotedText // Use the captured quote for the API call
            })
        });

        if (!response.body) {
            throw new Error("ReadableStream not yet supported in this browser.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let botMessageDiv = addMessageToUI('assistant', '', true);
        let botTextDiv = botMessageDiv.querySelector('.message-text');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = JSON.parse(line.substring(5));
                    if (data.status === 'searching') {
                        botTextDiv.innerHTML = `<div class="searching-message">${data.message}</div>`;
                    } else if (data.response) {
                        botTextDiv.innerHTML = marked.parse(data.response);
                    } else if (data.error) {
                        botTextDiv.innerHTML = `<div class="error-message">${data.error}</div>`;
                    }
                }
            }
        }

    } catch (error) {
        console.error('Error sending message:', error);
        addMessageToUI('assistant', `Sorry, I encountered an error: ${error.message}`);
    } finally {
        isProcessing = false;
        actionBtn.disabled = false;
    }
}


// Add message to UI
// --- MODIFICATION START ---
// Add a new parameter `quotedText` to the function definition
function addMessageToUI(role, content, isStreaming = false, quotedText = '') {
// --- MODIFICATION END ---
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    messageDiv.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // --- MODIFICATION START ---
    // If there is quoted text for a user message, create and prepend the quote element
    if (role === 'user' && quotedText) {
        const quoteDisplay = document.createElement('div');
        quoteDisplay.className = 'message-quote-display';
        // Truncate long quotes for display
        const truncatedQuote = quotedText.length > 100 ? `${quotedText.substring(0, 100)}...` : quotedText;
        quoteDisplay.innerHTML = `<i class="fas fa-quote-left"></i> ${truncatedQuote}`;
        contentDiv.appendChild(quoteDisplay);
    }
    // --- MODIFICATION END ---

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    if (isStreaming) {
        textDiv.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
        textDiv.innerHTML = marked.parse(content);
    }
    contentDiv.appendChild(textDiv);

    if (role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `
            <button class="copy-btn" title="Copy to clipboard">
                <i class="fas fa-copy"></i> Copy
            </button>
        `;
        contentDiv.appendChild(actions);
    }

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageDiv;
}


// --- CORRECTED: Handle text selection to show quote popup ---
function handleTextSelection(event) {
    // Only trigger for the left mouse button (standard selection)
    if (event.button !== 0) {
        return;
    }

    // Use a small timeout to let the selection finalize and avoid event conflicts
    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        // Remove any old popup
        const existingPopup = document.querySelector('.quote-popup');
        if (existingPopup) {
            existingPopup.remove();
        }

        // Check if there is a selection and it's within an assistant's message
        if (selectedText && selection.anchorNode.parentElement.closest('.assistant-message')) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();

            const popup = document.createElement('button');
            popup.className = 'quote-popup';
            popup.innerHTML = '<i class="fas fa-quote-left"></i> Quote';
            
            popup.onclick = () => {
                quoteText(selectedText);
                popup.remove();
                selection.removeAllRanges(); // Clear the user's selection
            };

            document.body.appendChild(popup);

            // Position the popup nicely above the selection
            const top = rect.top + window.scrollY - popup.offsetHeight - 5;
            const left = rect.left + window.scrollX + (rect.width - popup.offsetWidth) / 2;
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, 10); // A 10ms delay is enough to prevent the click event from firing
}


// Toggle search mode
function toggleSearchMode() {
    searchModeEnabled = !searchModeEnabled;
    searchToggle.classList.toggle('active', searchModeEnabled);

    const statusText = searchStatus.querySelector('span');
    statusText.textContent = searchModeEnabled ? 'Search enabled' : 'Auto-search enabled';
    statusText.style.color = searchModeEnabled ? 'var(--accent-color)' : 'var(--text-muted)';
}

// Theme management
function toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}


// Toggle user dropdown
function toggleUserDropdown() {
    userDropdown.classList.toggle('show');
}

// Handle logout
async function handleLogout() {
    try {
        const response = await fetch('/auth/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

// Handle image upload
function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        imagePreview.src = e.target.result;
        imagePreviewContainer.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

function removeImagePreview() {
    imagePreview.src = '';
    imagePreviewContainer.style.display = 'none';
    imageUpload.value = '';
}


// --- Audio Recording Functions ---

async function startAudioRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            actionBtn.classList.remove('recording');
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingInterval = setInterval(updateRecordingTimer, 500);
        audioRecordingIndicator.style.display = 'flex';
        actionBtn.classList.add('recording');
    } catch (err) {
        alert('Microphone access denied or unavailable.');
    }
}

function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        clearInterval(recordingInterval);
        recordingTimer.textContent = '00:00';
        actionBtn.classList.remove('recording');
    }
}

function cancelAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    clearInterval(recordingInterval);
    audioRecordingIndicator.style.display = 'none';
    recordingTimer.textContent = '00:00';
    actionBtn.classList.remove('recording');
    audioChunks = [];
    audioBlob = null;
}


function updateRecordingTimer() {
    if (!recordingStartTime) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    recordingTimer.textContent = `${min}:${sec}`;
}

// Quote text functionality
function quoteText(text) {
    quotedText = text;
    quotedTextSpan.textContent = text.length > 100 ? `${text.substring(0, 100)}...` : text;
    quotedTextContainer.style.display = 'block';
    messageInput.focus();
}

function removeQuote() {
    quotedText = '';
    quotedTextContainer.style.display = 'none';
}


// Copy to clipboard
async function copyToClipboard(text, buttonElement) {
    try {
        await navigator.clipboard.writeText(text);
        const originalContent = buttonElement.innerHTML;
        buttonElement.innerHTML = '<i class="fas fa-check"></i> Copied!';
        buttonElement.style.color = 'var(--success-color)';
        setTimeout(() => {
            buttonElement.innerHTML = originalContent;
            buttonElement.style.color = '';
        }, 2000);
    } catch (error) {
        console.error('Copy failed:', error);
    }
}

// Auto-resize textarea and update character count
function setupAutoResize() {
    messageInput.style.height = 'auto';
    const newHeight = Math.min(messageInput.scrollHeight, 120);
    messageInput.style.height = `${newHeight}px`;
}

function updateCharCount() {
    const count = messageInput.value.length;
    charCount.textContent = `${count}/4000`;
    charCount.style.color = count > 3800 ? 'var(--error-color)' : count > 3500 ? 'var(--warning-color)' : 'var(--text-muted)';
}

messageInput.addEventListener('input', () => {
    setupAutoResize();
    updateCharCount();
});


// Configure marked.js
marked.setOptions({
    breaks: true,
    gfm: true,
    sanitize: false
});


// --- Dynamic Action Button Logic ---

function updateActionButtonState() {
    const hasText = messageInput.value.trim().length > 0;
    if (hasText) {
        actionBtn.classList.add('state-send');
        actionBtn.classList.remove('state-mic');
    } else {
        actionBtn.classList.add('state-mic');
        actionBtn.classList.remove('state-send');
    }
}

function handleActionButton() {
    if (actionBtn.classList.contains('state-send')) {
        sendMessage();
    } else {
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            stopAudioRecording();
        } else {
            startAudioRecording();
        }
    }
}