let mediaRecorder;
let audioChunks = [];
let isRecording = false;

/**
 * Core configuration and state variables for the audio recorder
 * Required DOM elements:
 * - recordButton: Button element that triggers recording
 * - statusText: Element to display recording status
 */
const recordButton = document.getElementById('recordButton');
const statusText = document.querySelector('.recorder-status');

// Simplify getMimeType to just return a default format
const getMimeType = () => {
    if (MediaRecorder.isTypeSupported('audio/webm')) {
        return 'audio/webm';
    }
    if (MediaRecorder.isTypeSupported('audio/ogg')) {
        return 'audio/ogg';
    }
    throw new Error('No supported audio MIME type found');
};

async function toggleRecording() {
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: getMimeType() });

            mediaRecorder.ondataavailable = (event) => audioChunks.push(event.data);
            mediaRecorder.onstop = async () => {
                const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType });

                // Convert to WAV format
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioData = await blob.arrayBuffer();
                const audioBuffer = await audioContext.decodeAudioData(audioData);

                // Create WAV file
                const wavBuffer = audioBufferToWav(audioBuffer);
                const wavBlob = new Blob([wavBuffer], { type: 'audio/wav' });

                // Create FormData and append the WAV blob
                const formData = new FormData();
                formData.append('audio', wavBlob, 'recording.wav');

                try {
                    statusText.textContent = 'Transcribing...';

                    const response = await fetch('/test/transcribe', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const data = await response.json();
                    document.querySelector('.transcription-result').textContent = data.text;
                    statusText.textContent = 'Click to start recording';
                } catch (error) {
                    console.error('Error:', error);
                    document.querySelector('.transcription-result').textContent = 'Error processing audio';
                    statusText.textContent = 'Error during transcription';
                }

                audioChunks = [];
            };

            mediaRecorder.start(1000);
            isRecording = true;
            recordButton.classList.add('recording');
            statusText.textContent = 'Recording... Click to stop';

        } catch (err) {
            console.error('Error accessing microphone:', err);
            statusText.textContent = 'Error: Could not access microphone';
        }
    } else {
        mediaRecorder.stop();
        isRecording = false;
        recordButton.classList.remove('recording');
        statusText.textContent = 'Processing...';
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

recordButton.addEventListener('click', toggleRecording);

// Add this WAV converter function
function audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;

    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // RIFF identifier
    writeString(view, 0, 'RIFF');
    // file length minus RIFF identifier length and file description length
    view.setUint32(4, 36 + dataLength, true);
    // RIFF type
    writeString(view, 8, 'WAVE');
    // format chunk identifier
    writeString(view, 12, 'fmt ');
    // format chunk length
    view.setUint32(16, 16, true);
    // sample format (raw)
    view.setUint16(20, format, true);
    // channel count
    view.setUint16(22, numChannels, true);
    // sample rate
    view.setUint32(24, sampleRate, true);
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * blockAlign, true);
    // block align (channel count * bytes per sample)
    view.setUint16(32, blockAlign, true);
    // bits per sample
    view.setUint16(34, bitDepth, true);
    // data chunk identifier
    writeString(view, 36, 'data');
    // data chunk length
    view.setUint32(40, dataLength, true);

    const channels = [];
    for (let i = 0; i < numChannels; i++) {
        channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
        for (let channel = 0; channel < numChannels; channel++) {
            const sample = Math.max(-1, Math.min(1, channels[channel][i]));
            view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
            offset += 2;
        }
    }

    return arrayBuffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}