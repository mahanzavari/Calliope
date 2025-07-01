// --- DOM Elements ---
const messageInput = document.getElementById('messageInput');

// --- State ---
let recognition = null;
let isRecognizing = false;

/**
 * Initializes the SpeechRecognition object and sets up its event handlers.
 * @param {function} onStateChange - Callback function to execute when recognition state changes.
 */
function initializeSpeechRecognition(onStateChange) {
    window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (window.SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'en-US';
        recognition.interimResults = true; // Get results as the user speaks

        recognition.onstart = () => {
            isRecognizing = true;
            if (onStateChange) onStateChange();
        };

        recognition.onend = () => {
            isRecognizing = false;
            if (onStateChange) onStateChange();
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            isRecognizing = false;
            if (onStateChange) onStateChange();
        };

        recognition.onresult = (event) => {
            let interim_transcript = '';
            let final_transcript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            // Update the input field with the transcribed text
            messageInput.value = final_transcript + interim_transcript;
            // Trigger the 'input' event to update character count and other UI elements
            messageInput.dispatchEvent(new Event('input'));
        };
    } else {
        console.error("Speech Recognition not supported by this browser.");
        alert("Speech Recognition is not supported by your browser. Please try Chrome or Edge.");
    }
}

/**
 * Toggles the speech recognition on and off.
 * @param {function} onStateChange - Callback function to reflect UI changes.
 */
export function toggleRecognition(onStateChange) {
    if (!recognition) {
        initializeSpeechRecognition(onStateChange);
    }
    if (isRecognizing) {
        recognition.stop();
    } else {
        if (recognition) {
            recognition.start();
        }
    }
}

/**
 * Returns the current recognition state.
 * @returns {boolean} - True if recognition is active, false otherwise.
 */
export function getIsRecognizing() {
    return isRecognizing;
}