// --- Import Modules ---
import { toggleTheme, loadTheme, toggleUserDropdown, handleLogout, handleFileSelected, removeFilePreview, setupAutoResize, updateCharCount, copyToClipboard } from './modules/ui.js';
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
const fileUpload = document.getElementById('fileUpload');
const filePreviewContainer = document.getElementById('filePreviewContainer');

// Modal Elements
const fileModal = document.getElementById('fileModal');
const modalFileName = document.getElementById('modalFileName');
const modalFileContent = document.getElementById('modalFileContent');
const modalCloseBtn = document.getElementById('modalCloseBtn');

// --- State ---
let searchModeEnabled = false;

// --- Initialize Application ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    setupEventListeners();
    updateActionButtonState();

    // Configure marked.js to use highlight.js for syntax highlighting
    marked.setOptions({
        highlight: function(code, lang) {
            const language = hljs.getLanguage(lang) ? lang : 'plaintext';
            return hljs.highlight(code, { language }).value;
        },
        langPrefix: 'hljs language-' // Use 'hljs' class prefix for compatibility
    });
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

    // Consolidated Event Listener for all message-related actions
    messagesContainer.addEventListener('click', e => {
        const attachment = e.target.closest('.file-attachment');
        if (attachment) {
            const fileName = attachment.dataset.filename;
            if (window.fileContents[fileName]) {
                openFileModal(fileName, window.fileContents[fileName]);
            }
            return;
        }

        const editButton = e.target.closest('.edit-btn');
        if (editButton) {
            enterEditMode(editButton);
            return;
        }

        const saveButton = e.target.closest('.save-btn');
        if (saveButton) {
            saveEdit(saveButton);
            return;
        }

        const cancelButton = e.target.closest('.cancel-btn');
        if (cancelButton) {
            cancelEdit(cancelButton);
            return;
        }

        const copyButton = e.target.closest('.copy-btn');
        if (copyButton) {
            const text = copyButton.closest('.message-content').querySelector('.message-text').textContent;
            copyToClipboard(text, copyButton);
            return;
        }
    });


    // Modal listeners
    modalCloseBtn.addEventListener('click', closeFileModal);
    fileModal.addEventListener('click', e => {
        if (e.target === fileModal) {
            closeFileModal();
        }
    });

    // UI Listeners
    searchToggle.addEventListener('click', toggleSearch);
    themeToggle.addEventListener('click', toggleTheme);
    userBtn.addEventListener('click', toggleUserDropdown);
    logoutBtn.addEventListener('click', handleLogout);
    fileUpload.addEventListener('change', handleFileSelected);

    filePreviewContainer.addEventListener('click', e => {
        if (e.target.classList.contains('remove-file-btn')) {
            removeFilePreview(e.target.dataset.filename);
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

// --- Event Handlers & Core Logic ---
function handleKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!actionBtn.disabled) {
            sendMessage(messageInput.value.trim(), searchModeEnabled, fileUpload.files);
            updateActionButtonState();
        }
    }
}

function handleActionButton() {
    if (actionBtn.classList.contains('state-send')) {
        sendMessage(messageInput.value.trim(), searchModeEnabled, fileUpload.files);
        updateActionButtonState();
    } else {
        isRecording() ? stopAudioRecording() : startAudioRecording();
    }
}

function updateActionButtonState() {
    const hasText = messageInput.value.trim().length > 0;
    const hasFiles = fileUpload.files.length > 0;
    actionBtn.classList.toggle('state-send', hasText || hasFiles);
    actionBtn.classList.toggle('state-mic', !hasText && !hasFiles);
}

function toggleSearch() {
    searchModeEnabled = !searchModeEnabled;
    searchToggle.classList.toggle('active', searchModeEnabled);
    const statusText = document.querySelector('.search-status span');
    statusText.textContent = searchModeEnabled ? 'Search enabled' : 'Auto-search enabled';
    statusText.parentElement.style.color = searchModeEnabled ? 'var(--accent-color)' : 'var(--text-muted)';
}


// --- Edit Functions ---
function enterEditMode(editButton) {
    const userMessage = editButton.closest('.user-message');
    const messageContent = userMessage.querySelector('.message-content');
    const originalText = userMessage.dataset.rawContent || '';

    if (messageContent) messageContent.style.display = 'none';
    editButton.style.display = 'none';

    const editArea = document.createElement('div');
    editArea.className = 'message-edit-area';
    editArea.innerHTML = `
        <textarea>${originalText}</textarea>
        <div class="edit-actions">
            <button class="cancel-btn">Cancel</button>
            <button class="save-btn">Save</button>
        </div>
    `;
    
    const messageBody = userMessage.querySelector('.message-body');
    if (messageContent) {
        messageContent.after(editArea);
    } else {
        messageBody.appendChild(editArea);
    }
    editArea.querySelector('textarea').focus();
}

function saveEdit(saveButton) {
    const editArea = saveButton.closest('.message-edit-area');
    const userMessage = saveButton.closest('.user-message');
    const newText = editArea.querySelector('textarea').value.trim();

    if (newText) {
        const attachmentsJSON = userMessage.dataset.attachments;
        const existingAttachments = attachmentsJSON ? JSON.parse(attachmentsJSON) : null;

        const nextMessage = userMessage.nextElementSibling;
        if (nextMessage && nextMessage.classList.contains('assistant-message')) {
            nextMessage.remove();
        }
        
        userMessage.remove();
        sendMessage(newText, searchModeEnabled, null, existingAttachments);
    }
}

function exitEditMode(editArea) {
    const userMessage = editArea.closest('.user-message');
    const messageContent = userMessage.querySelector('.message-content');
    
    if (messageContent) messageContent.style.display = '';
    const editButton = userMessage.querySelector('.edit-btn');
    if(editButton) editButton.style.display = 'flex';
    
    editArea.remove();
}

function cancelEdit(cancelButton) {
    const editArea = cancelButton.closest('.message-edit-area');
    exitEditMode(editArea);
}


// --- Modal Functions ---
function openFileModal(fileName, fileContent) {
    modalFileName.textContent = fileName;
    
    // --- MODIFICATION START ---
    // First, set the HTML content by parsing the Markdown
    modalFileContent.innerHTML = marked.parse(fileContent);

    // Then, explicitly tell highlight.js to find and style all code blocks within the modal
    modalFileContent.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightElement(block);
    });
    // --- MODIFICATION END ---
    
    fileModal.style.display = 'flex';
}

function closeFileModal() {
    fileModal.style.display = 'none';
    modalFileContent.innerHTML = '';
}