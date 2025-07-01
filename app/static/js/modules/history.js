// --- DOM Elements ---
const chatHistoryContainer = document.getElementById('chatHistoryContainer');
const newChatBtn = document.getElementById('newChatBtn');
const headerSidebarToggle = document.getElementById('headerSidebarToggle');
const appContainer = document.getElementById('appContainer');
const sidebar = document.getElementById('sidebar');

// --- State ---
let chats = [];
let activeChatId = null;
let closeTimeout;

// --- Functions ---

export function setActiveChatId(id) {
    activeChatId = id;
    // Highlight the active chat in the history list
    const existingActive = document.querySelector('.chat-history-item.active');
    if (existingActive) existingActive.classList.remove('active');
    const newActive = document.querySelector(`.chat-history-item[data-chat-id="${id}"]`);
    if (newActive) newActive.classList.add('active');
}

/**
 * Fetches the chat history from the server.
 */
export async function fetchChatHistory() {
    try {
        const response = await fetch('/api/chats');
        if (response.ok) {
            const data = await response.json();
            chats = data.chats;
            renderChatHistory();
        }
    } catch (error) {
        console.error('Error fetching chat history:', error);
    }
}

/**
 * Renders the chat history in the sidebar.
 */
function renderChatHistory() {
    chatHistoryContainer.innerHTML = '';
    if (chats.length === 0) {
        chatHistoryContainer.innerHTML = '<p class="no-chats" style="padding: 1rem; text-align: center; color: var(--text-muted);">No chats yet.</p>';
        return;
    }

    chats.forEach(chat => {
        const chatHistoryItem = document.createElement('a');
        chatHistoryItem.href = '#';
        chatHistoryItem.className = `chat-history-item ${chat.id === activeChatId ? 'active' : ''}`;
        chatHistoryItem.dataset.chatId = chat.id;
        chatHistoryItem.textContent = chat.title || `Chat ${chat.id}`;
        chatHistoryItem.addEventListener('click', (e) => {
            e.preventDefault();
            loadChat(chat.id);
        });
        chatHistoryContainer.appendChild(chatHistoryItem);
    });
}

/**
 * Loads a specific chat when a user clicks on it in the history.
 * @param {number} chatId - The ID of the chat to load.
 */
export async function loadChat(chatId) {
    if (activeChatId === chatId) return;
    setActiveChatId(chatId);

    try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (response.ok) {
            const data = await response.json();
            const messagesContainer = document.getElementById('messages');
            messagesContainer.innerHTML = ''; // Clear existing messages
            data.messages.forEach(message => {
                addMessageToUI(message.role, message.content);
            });
            activeChatId = chatId;
            renderChatHistory(); // Re-render to highlight the active chat
        }
    } catch (error) {
        console.error(`Error loading chat ${chatId}:`, error);
    }
}

/**
 * Handles creating a new chat.
 */
export function handleNewChat() {
    setActiveChatId(null);
    document.getElementById('messages').innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon"><i class="fas fa-robot"></i></div>
            <h2>Welcome to Calliope AI</h2>
            <p>I'm your intelligent AI assistant. Start a new conversation!</p>
        </div>`;
    renderChatHistory();
}

/**
 * Initializes all sidebar functionality, including the coordinated hover effect.
 */
export function initializeChatHistory() {
    fetchChatHistory();
    newChatBtn.addEventListener('click', handleNewChat);

    const hoverAreaElements = [sidebar, headerSidebarToggle, newChatBtn];

    // Add a class to the parent container when any of the target elements are hovered
    hoverAreaElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            clearTimeout(closeTimeout);
            if (!appContainer.classList.contains('sidebar-pinned')) {
                appContainer.classList.add('sidebar-hover');
            }
        });

        el.addEventListener('mouseleave', () => {
            clearTimeout(closeTimeout);
            closeTimeout = setTimeout(() => {
                appContainer.classList.remove('sidebar-hover');
            }, 50);
        });
    });

    // The toggle button now pins the state, overriding hover
    headerSidebarToggle.addEventListener('click', () => {
        appContainer.classList.remove('sidebar-hover'); // Remove hover state to prevent conflicts
        appContainer.classList.toggle('sidebar-pinned');
    });
}

// Helper function to add messages to the UI
function addMessageToUI(role, content) {
    const messagesContainer = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}-message`;

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    // Use a library like 'marked' if you need to render markdown
    messageContent.innerHTML = `<div class="message-text">${content}</div>`; 

    messageDiv.appendChild(messageContent);
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}