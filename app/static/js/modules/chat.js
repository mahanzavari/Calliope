import { audioBlob, cancelAudioRecording } from './audio.js';
import { removeImagePreview } from './ui.js';
import { quotedText, removeQuote } from './quote.js';

// --- DOM Elements ---
const messagesContainer = document.getElementById('messages');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const searchToggle = document.getElementById('searchToggle');

// --- State ---
let isProcessing = false;

// --- Functions ---
export async function sendMessage(message, isSearchEnabled) {
    if (isProcessing) return;
    const hasImage = imagePreviewContainer && imagePreviewContainer.style.display !== 'none';
    const hasAudio = audioBlob != null;

    if (!message && !hasImage && !hasAudio) return;

    isProcessing = true;
    document.getElementById('actionBtn').disabled = true;

    const sentQuotedText = quotedText;
    let userContent = message;
    if (hasImage) userContent += `<br><img src="${imagePreviewContainer.querySelector('img').src}" class="inline-preview-image">`;
    if (hasAudio) userContent += `<br><audio controls src="${URL.createObjectURL(audioBlob)}"></audio>`;
    addMessageToUI('user', userContent, false, sentQuotedText);

    // Clear inputs
    document.getElementById('messageInput').value = '';
    removeImagePreview();
    cancelAudioRecording();
    removeQuote();
    
    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, use_search: isSearchEnabled, quoted_text: sentQuotedText })
        });

        if (!response.body) throw new Error("ReadableStream not supported.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const botMessageDiv = addMessageToUI('assistant', '', true);
        const botTextDiv = botMessageDiv.querySelector('.message-text');

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const data = JSON.parse(line.substring(5));
                    if (data.status === 'searching') botTextDiv.innerHTML = `<div class="searching-message">${data.message}</div>`;
                    else if (data.response) botTextDiv.innerHTML = marked.parse(data.response);
                    else if (data.error) botTextDiv.innerHTML = `<div class="error-message">${data.error}</div>`;
                }
            }
        }
    } catch (error) {
        console.error('Error sending message:', error);
        addMessageToUI('assistant', `Sorry, I encountered an error: ${error.message}`);
    } finally {
        isProcessing = false;
        document.getElementById('actionBtn').disabled = false;
    }
}

function addMessageToUI(role, content, isStreaming = false, quotedText = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.innerHTML = role === 'user' ? '<i class="fas fa-user"></i>' : '<i class="fas fa-robot"></i>';
    messageDiv.appendChild(avatar);

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    if (role === 'user' && quotedText) {
        const quoteDisplay = document.createElement('div');
        quoteDisplay.className = 'message-quote-display';
        const truncatedQuote = quotedText.length > 100 ? `${quotedText.substring(0, 100)}...` : quotedText;
        quoteDisplay.innerHTML = `<i class="fas fa-quote-left"></i> ${truncatedQuote}`;
        contentDiv.appendChild(quoteDisplay);
    }

    const textDiv = document.createElement('div');
    textDiv.className = 'message-text';
    textDiv.innerHTML = isStreaming ? '<div class="typing-indicator"><span></span><span></span><span></span></div>' : marked.parse(content);
    contentDiv.appendChild(textDiv);

    if (role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        actions.innerHTML = `<button class="copy-btn" title="Copy to clipboard"><i class="fas fa-copy"></i> Copy</button>`;
        contentDiv.appendChild(actions);
    }

    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageDiv;
}