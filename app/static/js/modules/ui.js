// --- DOM Elements ---
const themeToggle = document.getElementById('themeToggle');
const userBtn = document.getElementById('userBtn');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');
const filePreviewContainer = document.getElementById('filePreviewContainer');
const fileUpload = document.getElementById('fileUpload');
const charCount = document.getElementById('charCount');

// --- Functions ---
export function toggleTheme() {
    const newTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

export function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    setTheme(savedTheme);
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = themeToggle.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

export function toggleUserDropdown() {
    userDropdown.classList.toggle('show');
}

export async function handleLogout() {
    try {
        const response = await fetch('/auth/logout', { method: 'POST' });
        if (response.ok) {
            window.location.href = '/login';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
}

export function handleFileSelected(event) {
    const files = event.target.files;
    if (!files.length) return;

    filePreviewContainer.innerHTML = '';
    filePreviewContainer.style.display = 'flex';

    for (const file of files) {
        const filePreview = document.createElement('div');
        filePreview.className = 'file-preview-item';

        const fileIcon = getFileIcon(file.type);
        const fileName = file.name;
        const fileSize = (file.size / 1024).toFixed(2) + ' KB';

        filePreview.innerHTML = `
            <div class="file-icon">${fileIcon}</div>
            <div class="file-details">
                <div class="file-name">${fileName}</div>
                <div class="file-size">${fileSize}</div>
            </div>
            <button class="remove-file-btn" data-filename="${fileName}">&times;</button>
        `;
        filePreviewContainer.appendChild(filePreview);
    }
}

export function removeFilePreview(fileName) {
    const filePreviewItem = document.querySelector(`.file-preview-item .remove-file-btn[data-filename="${fileName}"]`).parentElement;
    if (filePreviewItem) {
        filePreviewItem.remove();
    }

    if (filePreviewContainer.children.length === 0) {
        filePreviewContainer.style.display = 'none';
        fileUpload.value = '';
    }
}

function getFileIcon(fileType) {
    if (fileType.startsWith('image/')) {
        return '<i class="fas fa-file-image"></i>';
    } else if (fileType === 'application/pdf') {
        return '<i class="fas fa-file-pdf"></i>';
    } else if (fileType === 'text/plain') {
        return '<i class="fas fa-file-alt"></i>';
    } else {
        return '<i class="fas fa-file"></i>';
    }
}


export function setupAutoResize(textarea) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 120);
    textarea.style.height = `${newHeight}px`;
}

export function updateCharCount(textarea) {
    const count = textarea.value.length;
    charCount.textContent = `${count}/4000`;
    charCount.style.color = count > 3800 ? 'var(--error-color)' : count > 3500 ? 'var(--warning-color)' : 'var(--text-muted)';
}

export async function copyToClipboard(text, buttonElement) {
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