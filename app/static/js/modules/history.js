import { setCurrentChatId, addMessageToUI } from './chat.js';

const chatHistoryContainer = document.getElementById('chatHistoryContainer');
const newChatBtn = document.getElementById('newChatBtn');
const headerSidebarToggle = document.getElementById('headerSidebarToggle');
const appContainer = document.getElementById('appContainer');
const sidebar = document.getElementById('sidebar');
const messagesContainer = document.getElementById('messages');

let chats = [];
let activeChatId = null;
let closeTimeout;

export function setActiveChatId(id) {
    activeChatId = id;
    setCurrentChatId(id);
    
    const existingActive = document.querySelector('.chat-history-item.active');
    if (existingActive) existingActive.classList.remove('active');
    
    if (id) {
        const newActive = document.querySelector(`.chat-history-item[data-chat-id="${id}"]`);
        if (newActive) newActive.classList.add('active');
    }
}

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

function renderChatHistory() {
    chatHistoryContainer.innerHTML = '';
    if (chats.length === 0) {
        chatHistoryContainer.innerHTML = '<p class="no-chats">No chats yet.</p>';
        return;
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const last7Days = new Date(today);
    last7Days.setDate(last7Days.getDate() - 7);
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);

    const groupedChats = {
        'Today': [],
        'Yesterday': [],
        'Previous 7 Days': [],
        'Previous 30 Days': [],
        'Older': []
    };

    chats.forEach(chat => {
        const chatDate = new Date(chat.updated_at);
        if (chatDate >= today) {
            groupedChats['Today'].push(chat);
        } else if (chatDate >= yesterday) {
            groupedChats['Yesterday'].push(chat);
        } else if (chatDate >= last7Days) {
            groupedChats['Previous 7 Days'].push(chat);
        } else if (chatDate >= last30Days) {
            groupedChats['Previous 30 Days'].push(chat);
        } else {
            groupedChats['Older'].push(chat);
        }
    });

    for (const group in groupedChats) {
        if (groupedChats[group].length > 0) {
            const groupHeader = document.createElement('h3');
            groupHeader.className = 'group-header';
            groupHeader.textContent = group;
            chatHistoryContainer.appendChild(groupHeader);

            groupedChats[group].forEach(chat => {
                const chatItem = createChatItem(chat);
                chatHistoryContainer.appendChild(chatItem);
            });
        }
    }
}

function createChatItem(chat) {
    const item = document.createElement('div');
    item.className = 'chat-history-item';
    item.dataset.chatId = chat.id;

    const link = document.createElement('a');
    link.href = '#';
    link.className = 'chat-link';
    link.textContent = chat.title || `Chat ${chat.id}`;
    link.addEventListener('click', (e) => {
        e.preventDefault();
        loadChat(chat.id);
    });

    const actions = document.createElement('div');
    actions.className = 'chat-actions';
    
    const menuBtn = document.createElement('button');
    menuBtn.className = 'menu-btn';
    menuBtn.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
    menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleContextMenu(e.currentTarget.nextElementSibling);
    });

    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <a href="#" class="rename-btn">Rename</a>
        <a href="#" class="delete-btn">Delete</a>
    `;

    contextMenu.querySelector('.rename-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        startRename(item);
        contextMenu.classList.remove('show');
    });
    contextMenu.querySelector('.delete-btn').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        deleteChat(chat.id, item);
        contextMenu.classList.remove('show');
    });

    actions.appendChild(menuBtn);
    actions.appendChild(contextMenu);
    item.appendChild(link);
    item.appendChild(actions);

    if (chat.id === activeChatId) {
        item.classList.add('active');
    }
    return item;
}

// FIX: This function now manages a class on the parent item to control z-index.
function toggleContextMenu(menu) {
    const parentItem = menu.closest('.chat-history-item');
    const isOpening = !menu.classList.contains('show');

    // Close all other menus and remove the 'menu-open' class from their parents
    document.querySelectorAll('.context-menu.show').forEach(m => {
        m.classList.remove('show');
        m.closest('.chat-history-item').classList.remove('menu-open');
    });

    // If we are opening a new menu, add the classes to it and its parent
    if (isOpening) {
        menu.classList.add('show');
        parentItem.classList.add('menu-open');
    }
}


function startRename(chatItem) {
    const link = chatItem.querySelector('.chat-link');
    const originalTitle = link.textContent;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'rename-input';
    input.value = originalTitle;

    link.replaceWith(input);
    input.focus();
    input.select();

    const save = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== originalTitle) {
            await saveRename(chatItem.dataset.chatId, newTitle);
        }
        input.replaceWith(link);
        link.textContent = newTitle || originalTitle;
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') e.target.blur();
        else if (e.key === 'Escape') {
            input.replaceWith(link);
        }
    });
}

async function saveRename(chatId, newTitle) {
    try {
        const response = await fetch(`/api/chats/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        if (response.ok) {
            const chat = chats.find(c => c.id == chatId);
            if (chat) chat.title = newTitle;
        } else {
            console.error('Failed to rename chat');
        }
    } catch (error) {
        console.error('Error renaming chat:', error);
    }
}

async function deleteChat(chatId, chatItem) {
    if (!confirm('Are you sure you want to delete this chat?')) return;

    try {
        const response = await fetch(`/api/chats/${chatId}`, { method: 'DELETE' });
        if (response.ok) {
            chats = chats.filter(c => c.id != chatId);
            renderChatHistory();
            if (activeChatId == chatId) {
                handleNewChat();
            }
        } else {
            console.error('Failed to delete chat');
        }
    } catch (error) {
        console.error('Error deleting chat:', error);
    }
}


export async function loadChat(chatId) {
    if (activeChatId === chatId) return;
    setActiveChatId(chatId);

    try {
        const response = await fetch(`/api/chats/${chatId}/messages`);
        if (response.ok) {
            const data = await response.json();
            messagesContainer.innerHTML = ''; 
            data.messages.forEach(message => {
                if (message.role === 'user') {
                    addMessageToUI('user', { text: message.content });
                } else {
                    addMessageToUI('assistant', message.content);
                }
            });
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    } catch (error) {
        console.error(`Error loading chat ${chatId}:`, error);
    }
}

export function handleNewChat() {
    setActiveChatId(null);
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="welcome-icon"><i class="fas fa-robot"></i></div>
            <h2>Welcome to Calliope AI</h2>
            <p>I'm your intelligent AI assistant. Start a new conversation!</p>
        </div>`;
}

export function updateChatTitleInList(chatId, newTitle) {
    const chat = chats.find(c => c.id == chatId);
    if (chat) {
        chat.title = newTitle;
        chat.updated_at = new Date().toISOString();
    } else {
        chats.unshift({ id: chatId, title: newTitle, updated_at: new Date().toISOString() });
    }
    renderChatHistory();
    const newActive = document.querySelector(`.chat-history-item[data-chat-id="${chatId}"]`);
    if(newActive) newActive.classList.add('active');
}

export function initializeChatHistory() {
    fetchChatHistory();
    newChatBtn.addEventListener('click', handleNewChat);

    const hoverAreaElements = [sidebar, headerSidebarToggle, newChatBtn];

    hoverAreaElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            clearTimeout(closeTimeout);
            if (!appContainer.classList.contains('sidebar-pinned')) {
                appContainer.classList.add('sidebar-hover');
            }
        });
        el.addEventListener('mouseleave', () => {
            closeTimeout = setTimeout(() => {
                appContainer.classList.remove('sidebar-hover');
            }, 50);
        });
    });

    headerSidebarToggle.addEventListener('click', () => {
        appContainer.classList.remove('sidebar-hover');
        appContainer.classList.toggle('sidebar-pinned');
    });

    // FIX: This now also removes the .menu-open class when clicking away.
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-actions')) {
            document.querySelectorAll('.context-menu.show').forEach(m => {
                m.classList.remove('show');
                m.closest('.chat-history-item').classList.remove('menu-open');
            });
        }
    });
}