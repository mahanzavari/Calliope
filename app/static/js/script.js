// --- Import Modules ---
import { toggleTheme, loadTheme, toggleUserDropdown, handleLogout, handleImageSelected, setupAutoResize, updateCharCount, copyToClipboard } from './modules/ui.js';
import { startAudioRecording, stopAudioRecording, isRecording } from './modules/audio.js';
import { handleTextSelection } from './modules/quote.js';
import { sendMessage } from './modules/chat.js';

// --- DOM Elements ---
const messageInput = document.getElementById('messageInput');
const actionBtn = document.getElementById('actionBtn');
const messagesContainer = document.getElementById('messages');
const searchToggle = document.getElementById('searchToggle');
const themeToggle = document.getElementById('themeToggle');
const userBtn = document.getElementById('userBtn');
const logoutBtn = document.getElementById('logoutBtn');
const imageUpload = document.getElementById('imageUpload');

// --- State ---
let searchModeEnabled = false;

// --- Initialize Application ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    setupEventListeners();
    updateActionButtonState();
});

// --- Event Listeners ---
function setupEventListeners() {
    messageInput.addEventListener('keydown', handleKeyPress);
    messageInput.addEventListener('input', () => {
        setupAutoResize(messageInput);
        updateCharCount(messageInput);
        updateActionButtonState();
    });

    actionBtn.addEventListener('click', handleActionButton);
    messagesContainer.addEventListener('mouseup', handleTextSelection);

    // UI Listeners
    searchToggle.addEventListener('click', toggleSearch);
    themeToggle.addEventListener('click', toggleTheme);
    userBtn.addEventListener('click', toggleUserDropdown);
    logoutBtn.addEventListener('click', handleLogout);
    imageUpload.addEventListener('change', handleImageSelected);

    messagesContainer.addEventListener('click', e => {
        const copyButton = e.target.closest('.copy-btn');
        if (copyButton) {
            const text = copyButton.closest('.message-content').querySelector('.message-text').textContent;
            copyToClipboard(text, copyButton);
        }
    });

    document.addEventListener('click', e => {
        const userDropdown = document.getElementById('userDropdown');
        if (userDropdown && !userBtn.contains(e.target) && !userDropdown.contains(e.target)) {
            userDropdown.classList.remove('show');
        }
        const quotePopup = document.querySelector('.quote-popup');
        if (quotePopup && !quotePopup.contains(e.target)) {
            quotePopup.remove();
        }
    });
}

// --- Event Handlers ---
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!actionBtn.disabled) {
            const message = messageInput.value.trim();
            sendMessage(message, searchModeEnabled);
            updateActionButtonState(); // Reset button state after sending
        }
    }
}

function handleActionButton() {
    if (actionBtn.classList.contains('state-send')) {
        const message = messageInput.value.trim();
        sendMessage(message, searchModeEnabled);
        updateActionButtonState();
    } else {
        isRecording() ? stopAudioRecording() : startAudioRecording();
    }
}

function updateActionButtonState() {
    const hasText = messageInput.value.trim().length > 0;
    actionBtn.classList.toggle('state-send', hasText);
    actionBtn.classList.toggle('state-mic', !hasText);
}

function toggleSearch() {
    searchModeEnabled = !searchModeEnabled;
    searchToggle.classList.toggle('active', searchModeEnabled);
    const statusText = document.querySelector('.search-status span');
    statusText.textContent = searchModeEnabled ? 'Search enabled' : 'Auto-search enabled';
    statusText.parentElement.style.color = searchModeEnabled ? 'var(--accent-color)' : 'var(--text-muted)';
}