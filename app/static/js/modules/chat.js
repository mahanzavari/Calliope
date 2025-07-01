import { audioBlob, cancelAudioRecording } from './audio.js';
import { removeFilePreview } from './ui.js';
import { quotedText, removeQuote } from './quote.js';
import { setActiveChatId, updateChatTitleInList } from './history.js';

const messagesContainer = document.getElementById('messages');
const fileUpload = document.getElementById('fileUpload');
window.fileContents = {};

let currentChatId = null;
let isProcessing = false;
let abortController = null;

export const getIsProcessing = () => isProcessing;
export function cancelCurrentRequest() {
    if (abortController) {
        abortController.abort();
        abortController = null;
    }
}

export function setCurrentChatId(chatId) {
    currentChatId = chatId;
}

export async function sendMessage(message, isSearchEnabled, files, existingAttachments = null, onStateChangeCallback) {
    if (isProcessing) return;
    const hasAudio = audioBlob != null;
    const hasFiles = files && files.length > 0;
    const hasExistingAttachments = existingAttachments && existingAttachments.length > 0;

    if (!message && !hasFiles && !hasAudio && !hasExistingAttachments) return;

    const welcomeMessage = document.querySelector('.welcome-message');
    if (welcomeMessage) welcomeMessage.remove();

    isProcessing = true;
    if (onStateChangeCallback) onStateChangeCallback();

    abortController = new AbortController();

    let finalMessage = message;
    const attachments = existingAttachments || [];
    let uploadFailed = false;

    if (hasFiles) {
        for (const file of files) {
            const result = await uploadFile(file);
            if (result.success) {
                window.fileContents[result.filename] = result.content;
                attachments.push({ name: result.filename });
            } else {
                addMessageToUI('assistant', { isError: true, text: result.error });
                uploadFailed = true;
            }
        }
    }

    if (uploadFailed) {
        if (fileUpload) fileUpload.value = '';
        const filePreviewContainer = document.getElementById('filePreviewContainer');
        if (filePreviewContainer) {
            filePreviewContainer.innerHTML = '';
            filePreviewContainer.style.display = 'none';
        }
        isProcessing = false;
        if (onStateChangeCallback) onStateChangeCallback();
        return;
    }

    if (attachments.length > 0) {
        let fileContentsForPrompt = "";
        attachments.forEach(att => {
            if (window.fileContents[att.name]) {
                fileContentsForPrompt += `\n\n--- Start of File: ${att.name} ---\n${window.fileContents[att.name]}\n--- End of File: ${att.name} ---`;
            }
        });
        if (fileContentsForPrompt) {
            finalMessage = `${fileContentsForPrompt}\n\n${message}`;
        }
    }
    
    const userContent = { text: message, attachments, audio: hasAudio ? URL.createObjectURL(audioBlob) : null };
    addMessageToUI('user', userContent, false, quotedText);

    if (!existingAttachments) {
        document.getElementById('messageInput').value = '';
        if (fileUpload) fileUpload.value = '';
        const filePreviewContainer = document.getElementById('filePreviewContainer');
        if (filePreviewContainer) {
            filePreviewContainer.innerHTML = '';
            filePreviewContainer.style.display = 'none';
        }
        cancelAudioRecording();
        removeQuote();
        document.getElementById('messageInput').dispatchEvent(new Event('input'));
    }
    
    const botMessageDiv = addMessageToUI('assistant', '', true);
    const botTextDiv = botMessageDiv.querySelector('.message-text');
    let accumulatedResponse = "";

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                message: finalMessage, 
                use_search: isSearchEnabled, 
                quoted_text: quotedText, 
                chat_id: currentChatId, 
                is_file_upload_message: attachments.length > 0 
            }),
            signal: abortController.signal
        });

        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
        if (!response.body) throw new Error("ReadableStream not supported.");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
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
                                if (data.chat_id && !currentChatId) {
                                    currentChatId = data.chat_id;
                                    setActiveChatId(data.chat_id);
                                }
                                break;
                            case 'response_chunk':
                                if (botTextDiv.querySelector('.typing-indicator')) {
                                    botTextDiv.innerHTML = ''; 
                                }
                                accumulatedResponse += data.content;
                                botTextDiv.textContent = accumulatedResponse;
                                messagesContainer.scrollTop = messagesContainer.scrollHeight;
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
        
        botTextDiv.innerHTML = marked.parse(accumulatedResponse);
        
        botTextDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });

        botTextDiv.querySelectorAll('pre').forEach(pre => {
            const codeCopyBtn = document.createElement('button');
            codeCopyBtn.className = 'copy-code-btn';
            codeCopyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            pre.appendChild(codeCopyBtn);
        });
        
        const fullCopyBtn = document.createElement('button');
        fullCopyBtn.className = 'copy-full-btn';
        fullCopyBtn.title = 'Copy full message';
        fullCopyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        
        const actionsContainer = botMessageDiv.querySelector('.message-actions');
        if (actionsContainer) {
            actionsContainer.appendChild(fullCopyBtn);
        }
        
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log('Fetch aborted by user.');
            if (accumulatedResponse) {
                 botTextDiv.innerHTML = marked.parse(accumulatedResponse + "\n\n*Response cancelled by user.*");
            } else {
                 botTextDiv.innerHTML = "<em>Response cancelled by user.</em>";
            }
        } else {
            console.error('Error sending message:', error);
            botTextDiv.innerHTML = `<div class="error-message"><i class="fas fa-exclamation-triangle"></i><span>Sorry, I encountered an error: ${error.message}</span></div>`
        }
    } finally {
        isProcessing = false;
        abortController = null;
        if (onStateChangeCallback) onStateChangeCallback();
    }
}

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

// FIX: Export this function so history.js can use it.
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
        // For loaded user messages, content is an object { text: '...' }
        if (content.text) textDiv.innerHTML = marked.parse(content.text);
        if (content.audio) {
            const audioEl = document.createElement('audio');
            audioEl.controls = true;
            audioEl.src = content.audio;
            contentDiv.appendChild(audioEl);
        }
    } else {
        // For assistant messages, content is just a string
        textDiv.innerHTML = isStreaming ? `<div class="typing-indicator"><span></span><span></span><span></span></div>` : marked.parse(content);
    }
    
    if (textDiv.innerHTML || isStreaming) {
       contentDiv.insertBefore(textDiv, contentDiv.firstChild);
    }

    if (role === 'user' && !isStreaming) {
        // Don't add edit button to old messages for now to keep it simple,
        // but you could add a condition here to show it on the last user message.
    }
    
    if (contentDiv.hasChildNodes()) {
        messageBodyWrapper.appendChild(contentDiv);
    }

    if (role === 'assistant') {
        const actions = document.createElement('div');
        actions.className = 'message-actions';
        // Add copy buttons etc. to loaded messages too
        const fullCopyBtn = document.createElement('button');
        fullCopyBtn.className = 'copy-full-btn';
        fullCopyBtn.title = 'Copy full message';
        fullCopyBtn.innerHTML = '<i class="fas fa-copy"></i>';
        actions.appendChild(fullCopyBtn);

        messageBodyWrapper.appendChild(actions);
    }
    
    messageDiv.appendChild(messageBodyWrapper);
    messagesContainer.appendChild(messageDiv);
    
    // Final post-processing for non-streaming messages
    if (!isStreaming) {
        textDiv.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
        textDiv.querySelectorAll('pre').forEach(pre => {
             if (!pre.querySelector('.copy-code-btn')) { // Avoid adding duplicate buttons
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