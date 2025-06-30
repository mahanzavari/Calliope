// --- DOM Elements ---
const audioRecordingIndicator = document.getElementById('audioRecordingIndicator');
const recordingTimer = document.getElementById('recordingTimer');
const actionBtn = document.getElementById('actionBtn'); // The main button now controls this

// --- State ---
let mediaRecorder = null;
let audioChunks = [];
let recordingStartTime = null;
let recordingInterval = null;
export let audioBlob = null; // Export to be used in chat.js

// --- Functions ---
export async function startAudioRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => {
            if (e.data.size > 0) audioChunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            actionBtn.classList.remove('recording');
        };

        mediaRecorder.start();
        recordingStartTime = Date.now();
        updateRecordingTimer();
        recordingInterval = setInterval(updateRecordingTimer, 500);
        audioRecordingIndicator.style.display = 'flex';
        actionBtn.classList.add('recording');
    } catch (err) {
        alert('Microphone access denied or unavailable.');
    }
}

export function stopAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        clearInterval(recordingInterval);
        recordingTimer.textContent = '00:00';
        actionBtn.classList.remove('recording');
    }
}

export function cancelAudioRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
    }
    clearInterval(recordingInterval);
    audioRecordingIndicator.style.display = 'none';
    recordingTimer.textContent = '00:00';
    actionBtn.classList.remove('recording');
    audioChunks = [];
    audioBlob = null;
}

function updateRecordingTimer() {
    if (!recordingStartTime) return;
    const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
    const min = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const sec = String(elapsed % 60).padStart(2, '0');
    recordingTimer.textContent = `${min}:${sec}`;
}

export function isRecording() {
    return mediaRecorder && mediaRecorder.state === 'recording';
}