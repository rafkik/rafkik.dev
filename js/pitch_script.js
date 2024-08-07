const audioFileInput = document.getElementById('audioFileInput');
const playButton = document.getElementById('playButton');
const resetButton = document.getElementById('resetButton');
const downloadButton = document.getElementById('downloadButton');
const speedSlider = document.getElementById('speedSlider');
const currentPositionDisplay = document.getElementById('currentPositionDisplay');
const selectedFileName = document.getElementById('selectedFileName');
const visualizerContainer = document.getElementById('visualizer');
const volumeSlider = document.getElementById('volumeSlider');

const stylePlay = document.getElementById("stylePlay");
const stylePause = document.getElementById("stylePause");

const mobileBar = 60;
const isMobile = window.innerWidth <= 768;

let audioContext = new window.AudioContext();
let audioBufferSource = null;
let analyser = audioContext.createAnalyser();
let gainNode = audioContext.createGain();
let isPlaying = false;

analyser.fftSize = 256;
const bufferLength = analyser.frequencyBinCount;
const dataArray = new Uint8Array(bufferLength);

function changeIconPlayButton(boolean, reset_button) {
    if (boolean == true) {
        stylePlay.style.display = 'none';
        stylePause.style.display = 'block';
        playButton.disabled = false;
        if (reset_button) resetButton.disabled = false;
    } else {
        stylePlay.style.display = 'block';
        stylePause.style.display = 'none';
        playButton.disabled = false;
        if (reset_button) resetButton.disabled = false;
    }
}

async function play() {
    playButton.disabled = true;
    if (audioBufferSource && audioContext.state === 'running') {
        audioContext.suspend().then(() => {
            changeIconPlayButton(false)
        });
    } else if (audioBufferSource && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            changeIconPlayButton(true)
        });
    } else {
        const file = audioFileInput.files[0];
        if (file) {
            playButton.disabled = true;

            const reader = new FileReader();
            reader.onload = async (e) => {
                if (audioBufferSource) {
                    audioBufferSource.stop();
                }

                const buffer = await audioContext.decodeAudioData(e.target.result);
                audioBufferSource = audioContext.createBufferSource();
                audioBufferSource.buffer = buffer;
                audioBufferSource.connect(gainNode);
                gainNode.connect(analyser);
                analyser.connect(audioContext.destination);
                audioBufferSource.playbackRate.value = speedSlider.value;
                await audioBufferSource.start(0);
                changeIconPlayButton(true)
                isPlaying = true;

                const originalDuration = buffer.duration;
                const newDuration = originalDuration / speedSlider.value;
                currentPositionDisplay.textContent = `Текущая позиция: ${speedSlider.value}x (${newDuration.toFixed(2)} сек.)`;
            };
            reader.readAsArrayBuffer(file);
        } else {
            alert("Пожалуйста, выберите аудиофайл для загрузки.");
            changeIconPlayButton(false)
            playButton.disabled = true;
        }
    };
};

function reset() {
    resetButton.disabled = true;
    playButton.disabled = true;
    if (audioBufferSource) {
        audioBufferSource.stop();
        audioBufferSource.disconnect();
        audioBufferSource = null;

        const file = audioFileInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = async (e) => {
                const buffer = await audioContext.decodeAudioData(e.target.result);
                audioBufferSource = audioContext.createBufferSource();
                audioBufferSource.buffer = buffer;
                audioBufferSource.connect(gainNode);
                gainNode.connect(analyser);
                analyser.connect(audioContext.destination);
                audioBufferSource.playbackRate.value = speedSlider.value;
                audioBufferSource.start(0);
                changeIconPlayButton(true, true)
                isPlaying = true;
            };
            reader.readAsArrayBuffer(file);
        }
    }
};

async function download() {
    if (audioBufferSource) {
        const playbackRate = parseFloat(speedSlider.value);
        const newBuffer = await applyPlaybackRate(audioBufferSource.buffer, playbackRate);

        const wavData = audioBufferToWav(newBuffer);

        const newBlob = new Blob([wavData], { type: 'audio/wav' });

        const blobUrl = URL.createObjectURL(newBlob);
        const downloadLink = document.createElement('a');
        downloadLink.href = blobUrl;
        downloadLink.download = 'changed_track.wav';
        downloadLink.click();
        URL.revokeObjectURL(blobUrl);
    } else {
        alert("Пожалуйста, выберите аудиофайл для загрузки.")
    }
}


audioFileInput.addEventListener('change', async () => {
    if (audioBufferSource && isPlaying) {
        audioBufferSource.stop();
        audioBufferSource.disconnect();
        audioBufferSource = null;
        changeIconPlayButton(false);
        isPlaying = false;
    }

    const file = audioFileInput.files[0];
    if (file && file.type.startsWith('audio/')) {
        const mutag = window.mutag;
        if (file.name.endsWith(".mp3")) {
            mutag.fetch(file).then((tags) => {
                selectedFileName.textContent = `${tags.TPE1 == undefined ? tags.TIT2 == undefined ? file.name : tags.TIT2 : `${tags.TPE1}  — ${tags.TIT2}`}`;
            });
        } else {
            if (file.name.length > 48) {
                file.name = file.name.substring(0, 45) + '...';
            };
            selectedFileName.textContent = file.name;
        }

        playButton.disabled = false;
        resetButton.disabled = false;
        downloadButton.disabled = false;
    } else if (file && !file.type.startsWith('audio/')) {
        alert("Пожалуйста, выберите аудиофайл.");
        changeIconPlayButton(false);
        playButton.disabled = true;
        resetButton.disabled = true;
        downloadButton.disabled = true;
        selectedFileName.textContent = 'Выберите аудиофайл';
    }
    else {
        changeIconPlayButton(false);
        playButton.disabled = true;
        resetButton.disabled = true;
        downloadButton.disabled = true;
        selectedFileName.textContent = 'Выберите аудиофайл';
    }
});

speedSlider.addEventListener('input', () => {
    if (speedSlider.value == 0) speedSlider.value = 0.1
    if (audioBufferSource) {
        audioBufferSource.playbackRate.value = speedSlider.value;
        const originalDuration = audioBufferSource.buffer.duration;
        const newDuration = originalDuration / speedSlider.value;
        currentPositionDisplay.textContent = `Текущая позиция: ${speedSlider.value}x (${newDuration.toFixed(2)} сек.)`;
    } else {
        currentPositionDisplay.textContent = `Текущая позиция: ${speedSlider.value}x`;
    }
});

// volumeSlider.addEventListener('input', () => {
//     if (gainNode) {
//         const volume = volumeSlider.value / 100;
//         gainNode.gain.value = volume;
//         volumeDisplay.textContent = `${Math.round(volume * 100)}%`;
//     }
// });

async function applyPlaybackRate(buffer, rate) {
    const offlineContext = new OfflineAudioContext(buffer.numberOfChannels, buffer.length, buffer.sampleRate);
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    source.connect(offlineContext.destination);
    source.start(0);

    const targetLength = buffer.length / rate;
    const newBuffer = offlineContext.createBuffer(buffer.numberOfChannels, targetLength, buffer.sampleRate);

    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        const newChannelData = newBuffer.getChannelData(channel);
        for (let i = 0; i < targetLength; i++) {
            const index = Math.floor(i * rate);
            newChannelData[i] = channelData[index];
        }
    }

    return newBuffer;
}

function audioBufferToWav(aBuffer) {
    let numOfChan = aBuffer.numberOfChannels,
        btwLength = aBuffer.length * numOfChan * 2 + 44,
        btwArrBuff = new ArrayBuffer(btwLength),
        btwView = new DataView(btwArrBuff),
        btwChnls = [],
        btwIndex,
        btwSample,
        btwOffset = 0,
        btwPos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(btwLength - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(aBuffer.sampleRate);
    setUint32(aBuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(btwLength - btwPos - 4); // chunk length

    for (btwIndex = 0; btwIndex < aBuffer.numberOfChannels; btwIndex++)
        btwChnls.push(aBuffer.getChannelData(btwIndex));

    while (btwPos < btwLength) {
        for (btwIndex = 0; btwIndex < numOfChan; btwIndex++) {
            btwSample = Math.max(-1, Math.min(1, btwChnls[btwIndex][btwOffset]));
            btwSample = (0.5 + btwSample < 0 ? btwSample * 32768 : btwSample * 32767) | 0;
            btwView.setInt16(btwPos, btwSample, true);
            btwPos += 2;
        }
        btwOffset++;
    }

    return btwArrBuff;

    function setUint16(data) {
        btwView.setUint16(btwPos, data, true);
        btwPos += 2;
    }

    function setUint32(data) {
        btwView.setUint32(btwPos, data, true);
        btwPos += 4;
    }
}

function updateVisualizer() {
    const centerIndex = Math.floor((isMobile ? mobileBar : bufferLength) / 2);
    visualizerContainer.style.display = 'flex';
    analyser.getByteFrequencyData(dataArray);

    visualizerContainer.innerHTML = '';

    const barMargin = 2;
    const barWidth = (isMobile ? 10 : 5);
    const maxHeight = isMobile ? 100 : 200;

    for (let i = 0; i < (isMobile ? mobileBar : bufferLength); i++) {
        const bar = document.createElement('div');
        bar.className = 'visualizer-bar';

        const distanceFromCenter = Math.abs(centerIndex - i);
        const strength = 1 - distanceFromCenter / centerIndex;
        const normalizedHeight = dataArray[i] / 255;
        const scaledHeight = normalizedHeight * strength * maxHeight;

        bar.style.width = `${barWidth}px`;
        bar.style.height = `${scaledHeight}px`;
        bar.style.marginRight = `${barMargin}px`;

        visualizerContainer.appendChild(bar);
    }

    requestAnimationFrame(updateVisualizer);
}

updateVisualizer();