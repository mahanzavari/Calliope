// --- DOM Elements ---
const themeToggle = document.getElementById('themeToggle');
const userBtn = document.getElementById('userBtn');
const userDropdown = document.getElementById('userDropdown');
const logoutBtn = document.getElementById('logoutBtn');
const imagePreviewContainer = document.getElementById('imagePreviewContainer');
const imagePreview = document.getElementById('imagePreview');
const imageUpload = document.getElementById('imageUpload');
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

export function handleImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        imagePreview.src = e.target.result;
        imagePreviewContainer.style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

export function removeImagePreview() {
    imagePreview.src = '';
    imagePreviewContainer.style.display = 'none';
    imageUpload.value = '';
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