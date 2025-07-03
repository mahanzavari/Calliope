import { audioBlob, cancelAudioRecording } from './audio.js';
import { removeFilePreview } from './ui.js';
import { quotedText, removeQuote } from './quote.js';
import { setActiveChatId, updateChatTitleInList } from './history.js';
import * as ui from './ui.js';

const messagesContainer = document.getElementById('messages');
const fileUpload = document.getElementById('fileUpload');
window.fileContents = {};

let currentChatId = null;
let isProcessing = false;
let abortController = null;
let tippyInstances = [];

// Store sources on a per-message basis, using the message element as a key
const messageSources = new WeakMap();

export const getIsProcessing = () => isProcessing;
export function cancelCurrentRequest() {
    if (abortController) {
        abortController.abort();
        tippyInstances.forEach(instance => instance.destroy());
        tippyInstances = [];
    }
}

export function setCurrentChatId(chatId) {
    currentChatId = chatId;
}

function initializeTippy(target, content) {
    const instance = tippy(target, {
        content: content,
        allowHTML: true,
        interactive: true,
        arrow: true,
        theme: 'light-border',
        placement: 'top',
        animation: 'shift-away',
    });
    tippyInstances.push(instance);
}

/**
 * NEW: Renders a visible list of sources at the bottom of a message bubble.
 * @param {HTMLElement} botMessageDiv - The message bubble to append the citations to.
 * @param {Array} sources - The list of source objects from the server.
 */
function renderSourceList(botMessageDiv, sources) {
    if (!sources || sources.length === 0) return;

    // Store the sources for this specific message
    const sourceMap = new Map(sources.map(s => [s.id.toString(), s]));
    messageSources.set(botMessageDiv, sourceMap);

    const messageBody = botMessageDiv.querySelector('.message-body');
    if (!messageBody) return;
    
    // Remove any existing citations container to prevent duplicates
    const existingContainer = messageBody.querySelector('.citations-container');
    if (existingContainer) existingContainer.remove();

    const container = document.createElement('div');
    container.className = 'citations-container';

    const header = document.createElement('h4');
    header.className = 'citations-header';
    header.innerHTML = `<i class="fas fa-link"></i> Sources`;
    container.appendChild(header);

    const list = document.createElement('div');
    list.className = 'citations-list';
    container.appendChild(list);

    sources.forEach(source => {
        const item = document.createElement('a');
        item.className = 'citation-item';
        item.href = source.url;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
        item.innerHTML = `
            <span class="citation-id">${source.id}</span>
            <span class="citation-title">${source.title}</span>
            <i class="fas fa-external-link-alt citation-icon"></i>
        `;
        list.appendChild(item);
    });

    messageBody.appendChild(container);
}

export async function sendMessage(message, isSearchEnabled, isResearchMode, files, existingAttachments = null, onStateChangeCallback) {
    if (isProcessing) return;
    isProcessing = true;
    onStateChangeCallback();

    abortController = new AbortController();
    tippyInstances.forEach(instance => instance.destroy());
    tippyInstances = [];

    // ... (file upload and message prep logic remains the same) ...
    let finalMessage = message;
    
    const userContent = { text: message };
    addMessageToUI('user', userContent, false, quotedText);
    
    if (!existingAttachments) {
        document.getElementById('messageInput').value = '';
        removeQuote();
        document.getElementById('messageInput').dispatchEvent(new Event('input'));
    }
    
    const botMessageDiv = addMessageToUI('assistant', '', true);
    const botTextDiv = botMessageDiv.querySelector('.message-text');
    let accumulatedResponse = "";
    let buffer = '';

    function processChunk(chunk) {
        buffer += chunk;
        let tagStart, tagEnd;

        // Clear the container once before adding new content
        if (currentContainer.innerHTML.includes('typing-indicator') || currentContainer.innerHTML.includes('status-update')) {
            currentContainer.innerHTML = '';
        }

        while ((tagStart = buffer.indexOf('[s:')) !== -1) {
            const endMarker = buffer.indexOf(']', tagStart);
            if (endMarker === -1) break; // Incomplete start tag

            const textBeforeTag = buffer.substring(0, tagStart);
            currentContainer.append(document.createTextNode(textBeforeTag));
            
            const id = buffer.substring(tagStart + 3, endMarker);
            const closeTag = `[/s:${id}]`;
            const contentEnd = buffer.indexOf(closeTag, endMarker);

            if (contentEnd !== -1) {
                const content = buffer.substring(endMarker + 1, contentEnd);
                const sourceSpan = document.createElement('span');
                sourceSpan.className = 'source-text';
                sourceSpan.dataset.sourceId = id;
                sourceSpan.append(document.createTextNode(content));
                currentContainer.appendChild(sourceSpan);

                const sourceMap = messageSources.get(botMessageDiv);
                if (sourceMap && sourceMap.has(id)) {
                    const source = sourceMap.get(id);
                    const popoverContent = `<div class="source-popover"><strong>${source.title}</strong><br><a href="${source.url}" target="_blank" rel="noopener noreferrer">${source.url}</a></div>`;
                    initializeTippy(sourceSpan, popoverContent);
                }

                buffer = buffer.substring(contentEnd + closeTag.length);
            } else {
                break; 
            }
        }
    }

    let currentContainer = botTextDiv;

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: finalMessage, is_research_mode: isResearchMode, chat_id: currentChatId }),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        if (!response.body) throw new Error("ReadableStream not supported.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                if (buffer.length > 0) {
                    currentContainer.append(document.createTextNode(buffer));
                    buffer = '';
                }
                break;
            }
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data:')) {
                    const dataStr = line.substring(5).trim();
                    if (!dataStr) continue;

                    try {
                        const data = JSON.parse(dataStr);
                        
                        switch (data.type) {
                            case 'chat_info':
                                if (data.chat_id && !currentChatId) setCurrentChatId(data.chat_id);
                                break;
                            case 'status':
                                if (botTextDiv.querySelector('.typing-indicator')) botTextDiv.innerHTML = `<div class="status-update">${data.message}</div>`;
                                break;
                            case 'response_chunk':
                                accumulatedResponse += data.content;
                                if (isResearchMode) {
                                    processChunk(data.content);
                                } else {
                                    botTextDiv.innerHTML = marked.parse(accumulatedResponse);
                                }
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                                break;
                            case 'sources':
                                // FIX: Re-introduce source list rendering
                                renderSourceList(botMessageDiv, data.data);
                                break;
                            case 'title_update':
                                updateChatTitleInList(data.chat_id, data.title);
                                break;
                            case 'error':
                                botTextDiv.innerHTML = `<div class="error-message">${data.message}</div>`;
                                throw new Error(data.message);
                        }
                    } catch (e) {
                        console.error("Error parsing stream data:", dataStr, e);
                    }
                }
            }
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted by user.');
            botTextDiv.innerHTML = "<em>Response cancelled by user.</em>";
        } else {
            console.error('Error sending message:', error);
            botTextDiv.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><span>Sorry, I encountered an error: ${error.message}</span></div>`
        }
    } finally {
        isProcessing = false;
        abortController = null;
        onStateChangeCallback();
        if (!isResearchMode) {
            botTextDiv.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
            botTextDiv.querySelectorAll('pre').forEach(pre => {
                const codeCopyBtn = document.createElement('button');
                codeCopyBtn.className = 'copy-code-btn';
                codeCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                pre.appendChild(codeCopyBtn);
            });
        }
    }
}

// The addMessageToUI function remains unchanged and does not need to be provided again.
// ... (rest of the file: uploadFile, addMessageToUI)
async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const response = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        return await response.json();
    } catch (error) {
        return { success: false, error: `Fetch failed: ${error.message}` };
    }
}

export function addMessageToUI(role, content, isStreaming = false, quotedText = '') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;
    
    if (content.isError) {
        messageDiv.classList.add('error-bubble');
    }
    
    const messageBodyWrapper = document.createElement('div');
    messageBodyWrapper.className = 'message-body';
    
    let hasAttachments = false;
    if (role === 'user') {
        hasAttachments = content.attachments && content.attachments.length > 0;
        if (hasAttachments) {
            content.attachments.forEach(file => {
                const attachmentEl = document.createElement('div');
                attachmentEl.className = 'file-attachment';
                attachmentEl.dataset.filename = file.name;
                attachmentEl.innerHTML = `<div class="file-attachment-icon"><i class="fas fa-file-alt"></i></div><div class="file-attachment-name">${file.name}</div>`;
                messageBodyWrapper.appendChild(attachmentEl);
            });
            messageDiv.dataset.attachments = JSON.stringify(content.attachments);
        }
        messageDiv.dataset.rawContent = content.text || '';
    }

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

    if (content.isError) {
        textDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${content.text}</span>`;
    } else if (role === 'user') {
        if (content.text) textDiv.innerHTML = marked.parse(content.text);
        if (content.audio) {
            const audioEl = document.createElement('audio');
            audioEl.controls = true;
            audioEl.src = content.audio;
            contentDiv.appendChild(audioEl);
        }
    } else {
        textDiv.innerHTML = isStreaming ? `<div class="typing-indicator"><span></span><span></span><span></span></div>` : marked.parse(content);
    }
    
    if (textDiv.innerHTML || isStreaming) {
       contentDiv.insertBefore(textDiv, contentDiv.firstChild);
    }

    if (role === 'user' && !isStreaming) {
        const editBtn = document.createElement('button');
        editBtn.className = 'edit-btn';
        editBtn.innerHTML = '<i class="fas fa-pencil-alt"></i>';
        editBtn.title = 'Edit Message';
        messageDiv.appendChild(editBtn);
    }
    
    if (contentDiv.hasChildNodes()) {
        messageBodyWrapper.appendChild(contentDiv);
    }

    if (role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        const fullCopyBtn = document.createElement('button');
        fullCopyBtn.className = 'copy-full-btn';
        fullCopyBtn.title = 'Copy full message';
        fullCopyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        actions.appendChild(fullCopyBtn);
        messageBodyWrapper.appendChild(actions);
    }
    
    messageDiv.appendChild(messageBodyWrapper);
    messagesContainer.appendChild(messageDiv);
    
    if (!isStreaming) {
        textDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
        textDiv.querySelectorAll('pre').forEach(pre => {
             if (!pre.querySelector('.copy-code-btn')) {
                const codeCopyBtn = document.createElement('button');
                codeCopyBtn.className = 'copy-code-btn';
                codeCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
                pre.appendChild(codeCopyBtn);
            }
        });
    }

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    return messageDiv;
}