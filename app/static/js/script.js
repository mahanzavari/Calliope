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

    messagesContainer.addEventListener('click', e => {
        const copyButton = e.target.closest('.copy-btn');
        if (copyButton) {
            const text = copyButton.closest('.message-content').querySelector('.message-text').textContent;
            copyToClipboard(text, copyButton);
        }

        const editButton = e.target.closest('.edit-btn');
        if (editButton) {
            enterEditMode(editButton);
        }

        const saveButton = e.target.closest('.save-btn');
        if (saveButton) {
            saveEdit(saveButton);
        }

        const cancelButton = e.target.closest('.cancel-btn');
        if (cancelButton) {
            cancelEdit(cancelButton);
        }
    });

    // UI Listeners
    searchToggle.addEventListener('click', toggleSearch);
    themeToggle.addEventListener('click', toggleTheme);
    userBtn.addEventListener('click', toggleUserDropdown);
    logoutBtn.addEventListener('click', handleLogout);
    imageUpload.addEventListener('change', handleImageSelected);

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
            updateActionButtonState();
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

// --- MODIFICATION: Update saveEdit to automatically send the message ---
function saveEdit(saveButton) {
    const userMessage = saveButton.closest('.user-message');
    const newText = userMessage.querySelector('textarea').value.trim();

    if (newText) {
        // Find and remove the AI response that followed this user message
        const nextMessage = userMessage.nextElementSibling;
        if (nextMessage && nextMessage.classList.contains('assistant-message')) {
            nextMessage.remove();
        }
        
        // Remove the original user message that was edited
        userMessage.remove();

        // Directly send the new message
        sendMessage(newText, searchModeEnabled);
    }
}
// --- END MODIFICATION ---

function enterEditMode(editButton) {
    const userMessage = editButton.closest('.user-message');
    const messageContent = userMessage.querySelector('.message-content');
    const originalText = userMessage.dataset.rawContent;

    messageContent.innerHTML = `
        <div class="message-edit-area">
            <textarea>${originalText}</textarea>
            <div class="edit-actions">
                <button class="cancel-btn">Cancel</button>
                <button class="save-btn">Save</button>
            </div>
        </div>
    `;
    editButton.style.display = 'none';
}

function exitEditMode(editArea) {
    const userMessage = editArea.closest('.user-message');
    const originalText = userMessage.dataset.rawContent;
    const messageContent = userMessage.querySelector('.message-content');

    // Rebuild the original message content
    messageContent.innerHTML = `<div class="message-text">${marked.parse(originalText)}</div>`;
    userMessage.querySelector('.edit-btn').style.display = 'flex';
}

function cancelEdit(cancelButton) {
    const editArea = cancelButton.closest('.message-edit-area');
    exitEditMode(editArea);
}