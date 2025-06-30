// --- DOM Elements ---
const quotedTextContainer = document.getElementById('quoted-text-container');
const quotedTextSpan = document.getElementById('quoted-text');
const messageInput = document.getElementById('messageInput');

// --- State ---
export let quotedText = '';

// --- Functions ---
export function setupQuoting(text) {
    quotedText = text;
    quotedTextSpan.textContent = text.length > 100 ? `${text.substring(0, 100)}...` : text;
    quotedTextContainer.style.display = 'block';
    messageInput.focus();
}

export function removeQuote() {
    quotedText = '';
    quotedTextContainer.style.display = 'none';
}

export function handleTextSelection(event) {
    if (event.button !== 0) return;

    setTimeout(() => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();

        const existingPopup = document.querySelector('.quote-popup');
        if (existingPopup) existingPopup.remove();

        if (selectedText && selection.anchorNode.parentElement.closest('.assistant-message')) {
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            const popup = document.createElement('button');
            popup.className = 'quote-popup';
            popup.innerHTML = '<i class="fas fa-quote-left"></i> Quote';
            popup.onclick = () => {
                setupQuoting(selectedText);
                popup.remove();
                selection.removeAllRanges();
            };
            document.body.appendChild(popup);
            const top = rect.top + window.scrollY - popup.offsetHeight - 5;
            const left = rect.left + window.scrollX + (rect.width - popup.offsetWidth) / 2;
            popup.style.top = `${top}px`;
            popup.style.left = `${left}px`;
        }
    }, 10);
}