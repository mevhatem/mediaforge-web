import { FFmpeg } from 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js';
import { fetchFile, toBlobURL } from 'https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js';

const ffmpeg = new FFmpeg();

// UI Elements
const ui = {
    dropArea: document.getElementById('drop-area'),
    fileInput: document.getElementById('file-input'),
    stateDropzone: document.getElementById('state-dropzone'),
    stateConfig: document.getElementById('state-config'),
    stateProcessing: document.getElementById('state-processing'),
    fileList: document.getElementById('file-list'),
    fileCount: document.getElementById('file-count'),
    formatSelectors: document.getElementById('format-selectors'),
    qualitySelector: document.getElementById('quality-selector'),
    audioQuality: document.getElementById('audio-quality'),
    imageQualitySelector: document.getElementById('image-quality-selector'),
    imageQuality: document.getElementById('image-quality'),
    trimSelector: document.getElementById('trim-selector'),
    trimStartSlider: document.getElementById('trim-start-slider'),
    trimEndSlider: document.getElementById('trim-end-slider'),
    trimTimeDisplay: document.getElementById('trim-time-display'),
    rangeFill: document.getElementById('range-fill'),
    videoPreview: document.getElementById('video-preview'),
    audioPreview: document.getElementById('audio-preview'),
    previewContainer: document.getElementById('preview-container'),
    btnConvert: document.getElementById('btn-convert'),
    processStatus: document.getElementById('process-status'),
    processDetail: document.getElementById('process-detail'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    globalProgressContainer: document.getElementById('global-progress-container'),
    resultActions: document.getElementById('result-actions'),
    downloadFilename: document.getElementById('download-filename'),
    btnDownload: document.getElementById('btn-download'),
    btnRestart: document.getElementById('btn-restart'),
    toast: document.getElementById('toast'),
    loadingOverlay: document.getElementById('loading-overlay')
};

// State
let selectedFiles = [];
let category = null; // 'audio' or 'video'
let targetFormat = 'mp3';
let isFfmpegLoaded = false;
let convertedFiles = [];
let currentFileIndex = 0;
let totalFilesCount = 0;

// Supported formats mapping
const formatOptions = {
    audio: ['mp3', 'wav', 'ogg', 'aac'],
    video: ['mp4', 'webm', 'avi', 'gif', 'mp3', 'wav', 'ogg', 'aac'],
    image: ['jpg', 'png', 'webp']
};

const audioExtensions = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.wma', '.opus'];
const videoExtensions = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.flv'];
const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.gif'];

function getCategory(file) {
    const type = file.type;
    if (type.startsWith('audio/')) return 'audio';
    if (type.startsWith('video/')) return 'video';
    if (type.startsWith('image/')) return 'image';
    
    // Fallback to extension check
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (audioExtensions.includes(ext)) return 'audio';
    if (videoExtensions.includes(ext)) return 'video';
    if (imageExtensions.includes(ext)) return 'image';
    
    return 'unknown';
}

function showToast(message, duration = 3000) {
    ui.toast.textContent = message;
    ui.toast.classList.add('show');
    setTimeout(() => {
        ui.toast.classList.remove('show');
    }, duration);
}

function switchState(stateId) {
    document.querySelectorAll('.state-panel').forEach(el => el.classList.remove('active'));
    document.getElementById(stateId).classList.add('active');
}

// Event Listeners for Drag and Drop
ui.dropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    ui.dropArea.classList.add('dragover');
});

ui.dropArea.addEventListener('dragleave', () => {
    ui.dropArea.classList.remove('dragover');
});

ui.dropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    ui.dropArea.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

ui.dropArea.addEventListener('click', () => {
    ui.fileInput.click();
});

ui.fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

window.addEventListener('paste', (e) => {
    if (!e.clipboardData || !e.clipboardData.items) return;

    let hasImage = false;
    const newFiles = [];

    for (let i = 0; i < e.clipboardData.items.length; i++) {
        const item = e.clipboardData.items[i];
        if (item.type.startsWith('image/')) {
            const blob = item.getAsFile();
            if (blob) {
                const now = new Date();
                const ts = now.getFullYear().toString() + 
                           (now.getMonth()+1).toString().padStart(2, '0') + 
                           now.getDate().toString().padStart(2, '0') + '-' + 
                           now.getHours().toString().padStart(2, '0') + 
                           now.getMinutes().toString().padStart(2, '0') + 
                           now.getSeconds().toString().padStart(2, '0');
                
                let ext = 'png';
                if (item.type === 'image/jpeg') ext = 'jpg';
                else if (item.type === 'image/webp') ext = 'webp';

                const fileName = `pasted-image-${ts}.${ext}`;
                const file = new File([blob], fileName, { type: item.type });
                newFiles.push(file);
                hasImage = true;
            }
        }
    }

    if (hasImage) {
        e.preventDefault();
        // Use our updated handleFiles to safely append the files
        handleFiles(newFiles);
    }
});

function handleFiles(files) {
    if (files.length === 0) return;

    let currentCategory = category; // Start with the existing category if any
    let validFiles = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileCat = getCategory(file);

        if (fileCat === 'unknown') {
            showToast(`Unsupported file type: ${file.name}`);
            return;
        }

        if (currentCategory === null) {
            currentCategory = fileCat;
        } else if (currentCategory !== fileCat) {
            showToast("Please select files of the same category (e.g. all audio or all images).");
            return;
        }
        validFiles.push(file);
    }

    selectedFiles.push(...validFiles);
    category = currentCategory;
    
    setupConfiguration();
}

function setupConfiguration() {
    // Populate file list
    ui.fileList.innerHTML = '';
    selectedFiles.forEach((f, i) => {
        const div = document.createElement('div');
        div.className = 'file-item';
        div.id = `file-item-${i}`;
        let actionButtonHTML = '';
        if (category === 'video' || category === 'audio') {
            actionButtonHTML = `<button class="btn-trim-file" data-index="${i}">✂️ Trim</button>`;
        } else if (category === 'image') {
            actionButtonHTML = `<button class="btn-resize-file" data-index="${i}">📐 Resize</button>`;
        }
        
        div.innerHTML = `
            <div class="file-item-header">
                <div class="file-info-main">
                    <svg class="file-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="16" height="16" style="margin-right: 0.5rem;"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                    <span class="file-name" title="${f.name}">${f.name}</span>
                </div>
                <div class="file-meta">
                    ${actionButtonHTML}
                    <span class="file-size">${(f.size / 1024 / 1024).toFixed(2)} MB</span>
                    <button class="btn-remove-file" data-index="${i}">✕</button>
                </div>
            </div>
            
            <div class="file-trim-section hidden" id="trim-section-${i}" style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.75rem; color: #9ca3af; text-transform: uppercase;">Trim Range</span>
                    <span id="trim-time-${i}" class="trim-time-display" style="font-size: 0.75rem;">00:00 - 00:00</span>
                </div>
                
                <div id="preview-container-${i}" class="hidden" style="margin-bottom: 0.5rem; border-radius: 4px; overflow: hidden; background: #000;">
                    <video id="video-preview-${i}" style="width: 100%; max-height: 150px; display: block;" muted playsinline></video>
                    <audio id="audio-preview-${i}" class="hidden"></audio>
                </div>

                <div class="range-slider">
                    <div class="range-track"></div>
                    <div class="range-fill" id="range-fill-${i}"></div>
                    <input type="range" class="trim-start-slider" id="trim-start-${i}" data-index="${i}" min="0" max="100" value="0" step="0.1">
                    <input type="range" class="trim-end-slider" id="trim-end-${i}" data-index="${i}" min="0" max="100" value="100" step="0.1">
                </div>
            </div>
            
            <div class="file-resize-section hidden" id="resize-section-${i}" style="background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span style="font-size: 0.75rem; color: #9ca3af; text-transform: uppercase;">Resize Dimensions</span>
                    <label style="font-size: 0.75rem; color: #a78bfa; display: flex; align-items: center; gap: 0.25rem; cursor: pointer;">
                        <input type="checkbox" id="resize-lock-${i}" checked> Lock Aspect Ratio
                    </label>
                </div>
                <div style="display: flex; gap: 1rem;">
                    <div style="flex: 1;">
                        <label style="font-size: 0.7rem; color: #9ca3af; display: block; margin-bottom: 0.25rem;">Width (px)</label>
                        <input type="number" id="resize-w-${i}" class="text-input" placeholder="Auto" data-index="${i}">
                    </div>
                    <div style="flex: 1;">
                        <label style="font-size: 0.7rem; color: #9ca3af; display: block; margin-bottom: 0.25rem;">Height (px)</label>
                        <input type="number" id="resize-h-${i}" class="text-input" placeholder="Auto" data-index="${i}">
                    </div>
                </div>
            </div>

            <div class="file-progress-container hidden">
                <div class="file-progress-bar" id="file-progress-${i}"></div>
            </div>
            <span class="file-status hidden" id="file-status-${i}">Pending</span>
        `;
        ui.fileList.appendChild(div);
    });
    
    // Attach remove event listeners
    document.querySelectorAll('.btn-remove-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            selectedFiles.splice(index, 1);
            if (selectedFiles.length === 0) {
                category = null;
                switchState('state-dropzone');
            } else {
                setupConfiguration();
            }
        });
    });

    ui.fileCount.textContent = selectedFiles.length;

    // Setup format selectors
    ui.formatSelectors.innerHTML = '';
    
    if (category === 'video') {
        const videoGroup = document.createElement('div');
        videoGroup.className = 'format-group';
        videoGroup.innerHTML = '<div class="format-group-label">Video Formats</div><div class="format-group-buttons"></div>';
        
        const audioGroup = document.createElement('div');
        audioGroup.className = 'format-group extract-audio';
        audioGroup.innerHTML = '<div class="format-group-label">Extract Audio</div><div class="format-group-buttons"></div>';
        
        const vFormats = ['mp4', 'webm', 'avi', 'gif'];
        const aFormats = ['mp3', 'wav', 'ogg', 'aac'];
        targetFormat = vFormats[0];
        
        const createBtn = (format, container) => {
            const btn = document.createElement('button');
            btn.className = `format-badge ${format === targetFormat ? 'selected' : ''}`;
            btn.textContent = format.toUpperCase();
            btn.onclick = () => {
                document.querySelectorAll('.format-badge').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                targetFormat = format;
                updateQualitySelectorVisibility();
            };
            container.appendChild(btn);
        };
        
        vFormats.forEach(f => createBtn(f, videoGroup.querySelector('.format-group-buttons')));
        aFormats.forEach(f => createBtn(f, audioGroup.querySelector('.format-group-buttons')));
        
        ui.formatSelectors.appendChild(videoGroup);
        ui.formatSelectors.appendChild(audioGroup);
    } else {
        const formats = formatOptions[category];
        targetFormat = formats[0];
        
        const group = document.createElement('div');
        group.className = 'format-group';
        group.innerHTML = `<div class="format-group-buttons"></div>`;
        const container = group.querySelector('.format-group-buttons');
        
        formats.forEach(format => {
            const btn = document.createElement('button');
            btn.className = `format-badge ${format === targetFormat ? 'selected' : ''}`;
            btn.textContent = format.toUpperCase();
            btn.onclick = () => {
                document.querySelectorAll('.format-badge').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                targetFormat = format;
                updateQualitySelectorVisibility();
            };
            container.appendChild(btn);
        });
        ui.formatSelectors.appendChild(group);
    }

    updateQualitySelectorVisibility();
    
    // Attach trim event listeners
    document.querySelectorAll('.btn-trim-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const trimSection = document.getElementById(`trim-section-${index}`);
            trimSection.classList.toggle('hidden');
            
            // If opening and no metadata loaded, load it
            if (!trimSection.classList.contains('hidden')) {
                const file = selectedFiles[index];
                if (!file.trim) {
                    const url = URL.createObjectURL(file);
                    const media = category === 'video' ? document.getElementById(`video-preview-${index}`) : document.getElementById(`audio-preview-${index}`);
                    media.src = url;
                    
                    media.onloadedmetadata = () => {
                        file.duration = media.duration;
                        file.trim = { start: 0, end: media.duration };
                        
                        const startSlider = document.getElementById(`trim-start-${index}`);
                        const endSlider = document.getElementById(`trim-end-${index}`);
                        startSlider.max = media.duration;
                        endSlider.max = media.duration;
                        startSlider.value = 0;
                        endSlider.value = media.duration;
                        
                        if (category === 'video') {
                            document.getElementById(`preview-container-${index}`).classList.remove('hidden');
                        }
                        
                        updateItemTrimUI(index);
                    };
                }
            }
        });
    });

    document.querySelectorAll('.trim-start-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            updateItemTrimUI(index, 'start');
        });
    });

    document.querySelectorAll('.trim-end-slider').forEach(slider => {
        slider.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            updateItemTrimUI(index, 'end');
        });
    });

    // Attach resize event listeners
    document.querySelectorAll('.btn-resize-file').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const resizeSection = document.getElementById(`resize-section-${index}`);
            resizeSection.classList.toggle('hidden');
            
            if (!resizeSection.classList.contains('hidden')) {
                const file = selectedFiles[index];
                if (!file.originalDimensions) {
                    const url = URL.createObjectURL(file);
                    const img = new Image();
                    img.onload = () => {
                        file.originalDimensions = { width: img.width, height: img.height };
                        const wInput = document.getElementById(`resize-w-${index}`);
                        const hInput = document.getElementById(`resize-h-${index}`);
                        if (!wInput.value) wInput.placeholder = img.width;
                        if (!hInput.value) hInput.placeholder = img.height;
                        URL.revokeObjectURL(url);
                    };
                    img.src = url;
                }
            }
        });
    });

    document.querySelectorAll('[id^="resize-w-"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const file = selectedFiles[index];
            const lock = document.getElementById(`resize-lock-${index}`).checked;
            if (lock && file && file.originalDimensions) {
                const hInput = document.getElementById(`resize-h-${index}`);
                const aspect = file.originalDimensions.height / file.originalDimensions.width;
                if (e.target.value) {
                    hInput.value = Math.round(e.target.value * aspect);
                } else {
                    hInput.value = '';
                }
            }
        });
    });

    document.querySelectorAll('[id^="resize-h-"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index, 10);
            const file = selectedFiles[index];
            const lock = document.getElementById(`resize-lock-${index}`).checked;
            if (lock && file && file.originalDimensions) {
                const wInput = document.getElementById(`resize-w-${index}`);
                const aspect = file.originalDimensions.width / file.originalDimensions.height;
                if (e.target.value) {
                    wInput.value = Math.round(e.target.value * aspect);
                } else {
                    wInput.value = '';
                }
            }
        });
    });

    ui.btnConvert.textContent = `Convert ${selectedFiles.length} File${selectedFiles.length > 1 ? 's' : ''}`;
    
    switchState('state-config');
}

function updateQualitySelectorVisibility() {
    if ((category === 'audio' || category === 'video') && ['mp3', 'ogg', 'aac'].includes(targetFormat)) {
        ui.qualitySelector.classList.remove('hidden');
    } else {
        ui.qualitySelector.classList.add('hidden');
    }

    if (category === 'image' && ['jpg', 'webp'].includes(targetFormat)) {
        ui.imageQualitySelector.classList.remove('hidden');
    } else {
        ui.imageQualitySelector.classList.add('hidden');
    }
}

let currentMediaDuration = 0;

function formatTime(seconds) {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
}

function updateItemTrimUI(index, seekingElement = null) {
    const file = selectedFiles[index];
    if (!file || !file.duration) return;
    
    const startSlider = document.getElementById(`trim-start-${index}`);
    const endSlider = document.getElementById(`trim-end-${index}`);
    
    let start = parseFloat(startSlider.value);
    let end = parseFloat(endSlider.value);
    
    if (start >= end) {
        if (seekingElement === 'start') {
            startSlider.value = end - 0.1;
            start = end - 0.1;
        } else {
            endSlider.value = start + 0.1;
            end = start + 0.1;
        }
    }
    
    file.trim = { start, end };

    const startPct = (start / file.duration) * 100;
    const endPct = (end / file.duration) * 100;
    
    const rangeFill = document.getElementById(`range-fill-${index}`);
    if (rangeFill) {
        rangeFill.style.left = `${startPct}%`;
        rangeFill.style.width = `${endPct - startPct}%`;
    }
    
    const diff = Math.max(0, Math.round(end - start));
    const display = document.getElementById(`trim-time-${index}`);
    if (display) {
        display.textContent = `${formatTime(start)} - ${formatTime(end)} (${diff}s)`;
    }
    
    if (seekingElement && category === 'video') {
        const video = document.getElementById(`video-preview-${index}`);
        if (video) video.currentTime = seekingElement === 'start' ? start : end;
    }
}

// Convert logic
ui.btnConvert.addEventListener('click', async () => {
    console.log("--- CONVERT BUTTON CLICKED ---");
    try {
        switchState('state-processing');
        const fileListSection = document.querySelector('.file-list-section');
        const processingListContainer = document.getElementById('processing-file-list-container');
        processingListContainer.appendChild(fileListSection);
        
        if (selectedFiles.length === 1) {
            processingListContainer.classList.add('hidden');
        } else {
            processingListContainer.classList.remove('hidden');
            document.querySelectorAll('.file-progress-container').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.file-status').forEach(el => el.classList.remove('hidden'));
            document.querySelectorAll('.btn-remove-file').forEach(el => el.classList.add('hidden'));
        }
        
        ui.globalProgressContainer.classList.remove('hidden');
        ui.resultActions.classList.add('hidden');
        ui.progressBar.style.width = '0%';
        if (ui.progressText) ui.progressText.textContent = '0%';
        
        await loadFFmpeg();
        await processFiles();
    } catch (error) {
        console.error("CRITICAL ERROR:", error);
        ui.processStatus.textContent = 'Error during conversion';
        ui.processDetail.textContent = error.message || 'Check console for details.';
        ui.resultActions.classList.remove('hidden');
        ui.btnDownload.classList.add('hidden'); // Hide download if error
    }
});

async function loadFFmpeg() {
    if (isFfmpegLoaded) return;
    ui.processStatus.textContent = 'Loading FFmpeg Engine...';
    ui.processDetail.textContent = 'Downloading WASM binaries (first time only)';
    
    ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg LOG]:', message);
    });
    
    ffmpeg.on('progress', ({ progress, time }) => {
        console.log(`[FFmpeg PROGRESS]: ${progress * 100}%`);
        if (totalFilesCount > 0) {
            const validProgress = Math.max(0, Math.min(1, progress));
            const bar = document.getElementById(`file-progress-${currentFileIndex}`);
            const status = document.getElementById(`file-status-${currentFileIndex}`);
            if (bar) bar.style.width = `${validProgress * 100}%`;
            if (status) status.textContent = `Processing (${Math.round(validProgress * 100)}%)`;
            
            const baseProgress = (currentFileIndex / totalFilesCount) * 100;
            const currentFileProgress = validProgress * (100 / totalFilesCount);
            const totalPercent = Math.round(baseProgress + currentFileProgress);
            ui.progressBar.style.width = `${totalPercent}%`;
            if (ui.progressText) ui.progressText.textContent = `${totalPercent}%`;
        }
    });

    const coreBaseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
    const ffmpegBaseURL = 'https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm';

    console.log("Loading FFmpeg from CDN...");
    try {
        await ffmpeg.load({
            coreURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.js`, 'text/javascript'),
            wasmURL: await toBlobURL(`${coreBaseURL}/ffmpeg-core.wasm`, 'application/wasm'),
            classWorkerURL: await toBlobURL(`${ffmpegBaseURL}/worker.js`, 'text/javascript')
        });
        console.log("FFmpeg loaded!");
        isFfmpegLoaded = true;
    } catch (error) {
        console.error("Failed to load FFmpeg:", error);
        ui.processStatus.textContent = "FFmpeg Load Failed";
        ui.processDetail.textContent = "Check browser console. (Is COOP/COEP configured?)";
        throw error;
    }
}

let finalZipBlob = null;
let singleBlob = null;
let singleFileName = "";

async function processFiles() {
    totalFilesCount = selectedFiles.length;
    const zip = new JSZip();

    for (let i = 0; i < totalFilesCount; i++) {
        currentFileIndex = i;
        const file = selectedFiles[i];
        ui.processStatus.textContent = `Processing file ${i + 1} of ${totalFilesCount}...`;
        ui.processDetail.textContent = file.name;
        
        const statusEl = document.getElementById(`file-status-${i}`);
        const barEl = document.getElementById(`file-progress-${i}`);
        if (statusEl) statusEl.textContent = "Processing (0%)";
        
        const baseProgress = Math.round((i / totalFilesCount) * 100);
        ui.progressBar.style.width = `${baseProgress}%`;
        if (ui.progressText) ui.progressText.textContent = `${baseProgress}%`;

        // Determine MIME type
        let mime = 'application/octet-stream';
        if (targetFormat === 'mp3') mime = 'audio/mpeg';
        else if (targetFormat === 'wav') mime = 'audio/wav';
        else if (targetFormat === 'ogg') mime = 'audio/ogg';
        else if (targetFormat === 'aac') mime = 'audio/aac';
        else if (targetFormat === 'mp4') mime = 'video/mp4';
        else if (targetFormat === 'webm') mime = 'video/webm';
        else if (targetFormat === 'gif') mime = 'image/gif';
        else if (targetFormat === 'avi') mime = 'video/x-msvideo';
        else if (targetFormat === 'jpg') mime = 'image/jpeg';
        else if (targetFormat === 'png') mime = 'image/png';
        else if (targetFormat === 'webp') mime = 'image/webp';

        const originalNameBase = file.name.substring(0, file.name.lastIndexOf('.'));
        const outputName = `${originalNameBase}.${targetFormat}`;
        
        let blob = null;

        if (category === 'image') {
            // Process Image natively via Canvas
            blob = await new Promise((resolve, reject) => {
                const img = new Image();
                const url = URL.createObjectURL(file);
                img.onload = () => {
                    let targetWidth = img.naturalWidth;
                    let targetHeight = img.naturalHeight;
                    
                    const wInput = document.getElementById(`resize-w-${i}`);
                    const hInput = document.getElementById(`resize-h-${i}`);
                    
                    if (wInput && wInput.value) targetWidth = parseInt(wInput.value, 10);
                    if (hInput && hInput.value) targetHeight = parseInt(hInput.value, 10);
                    
                    const canvas = document.createElement('canvas');
                    canvas.width = targetWidth;
                    canvas.height = targetHeight;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
                    URL.revokeObjectURL(url);
                    
                    const quality = (targetFormat === 'jpg' || targetFormat === 'webp') ? parseFloat(ui.imageQuality.value) : undefined;
                    canvas.toBlob((b) => {
                        if (b) resolve(b);
                        else reject(new Error("Canvas toBlob failed"));
                    }, mime, quality);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error("Failed to load image"));
                };
                img.src = url;
            });
            const pct = Math.round(((currentFileIndex + 1) / totalFilesCount) * 100);
            ui.progressBar.style.width = `${pct}%`;
            if (ui.progressText) ui.progressText.textContent = `${pct}%`;
        } else {
            // Clean names for FFmpeg virtual FS
            const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
            const inputName = `input_${i}_${safeName}`;
            
            await ffmpeg.writeFile(inputName, await fetchFile(file));

            const outputSafeName = `out_${i}.${targetFormat}`;
            
            // Build FFmpeg command args
            const args = ['-v', 'error'];
            
            // Trim logic from per-file settings
            if (file.trim) {
                const { start, end } = file.trim;
                if (start > 0) {
                    args.push('-ss', start.toString());
                }
                args.push('-i', inputName);
                if (file.duration && end < file.duration) {
                    args.push('-to', end.toString());
                }
            } else {
                args.push('-i', inputName);
            }
            
            const isTargetAudio = ['mp3', 'wav', 'ogg', 'aac'].includes(targetFormat);
            
            if (category === 'audio' || (category === 'video' && isTargetAudio)) {
                if (targetFormat === 'mp3' || targetFormat === 'aac' || targetFormat === 'ogg') {
                    const quality = ui.audioQuality.value; // e.g. 192k
                    args.push('-b:a', quality);
                }
                if (category === 'video') {
                    args.push('-vn'); // Extract audio only
                }
            } else if (category === 'video') {
                if (targetFormat === 'gif') {
                    args.push('-vf', 'fps=15,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse');
                }
            }
            
            args.push(outputSafeName);
            
            console.log("Starting ffmpeg.exec...");
            // Run conversion
            try {
                await ffmpeg.exec(args);
                console.log("Finished exec!");
            } catch (execError) {
                console.warn("FFmpeg crashed, verifying if output was generated...", execError);
                try {
                    // If the file exists, the crash was just a logging/metadata artifact
                    await ffmpeg.readFile(outputSafeName);
                    console.warn("Output file successfully generated! Proceeding despite the crash.");
                } catch (readError) {
                    // File does not exist, it was a real conversion failure
                    if (statusEl) statusEl.textContent = "Error";
                    throw execError; 
                }
            }
            
            // Read result
            const data = await ffmpeg.readFile(outputSafeName);
            blob = new Blob([data.buffer], { type: mime });
            
            // Clean up virtual FS memory
            await ffmpeg.deleteFile(inputName);
            await ffmpeg.deleteFile(outputSafeName);
        }

        if (statusEl) statusEl.textContent = "Done";
        if (barEl) barEl.style.width = "100%";
        
        if (totalFilesCount === 1) {
            singleBlob = blob;
            singleFileName = outputName;
        } else {
            zip.file(outputName, blob);
        }
    }
    
    if (totalFilesCount > 1) {
        ui.processStatus.textContent = 'Packaging ZIP file...';
        ui.loadingOverlay.classList.remove('hidden');
        finalZipBlob = await zip.generateAsync({ type: 'blob' });
        ui.loadingOverlay.classList.add('hidden');
    }
    
    ui.progressBar.style.width = '100%';
    if (ui.progressText) ui.progressText.textContent = '100%';
    ui.processStatus.textContent = 'Conversion Complete!';
    ui.processDetail.textContent = 'Ready for download';
    
    ui.resultActions.classList.remove('hidden');
    ui.btnDownload.classList.remove('hidden');

    if (totalFilesCount === 1) {
        ui.btnDownload.textContent = `Download Converted File`;
        if (ui.downloadFilename) {
            ui.downloadFilename.textContent = singleFileName;
            ui.downloadFilename.classList.remove('hidden');
        }
    } else {
        ui.btnDownload.textContent = `Download All (.zip)`;
        if (ui.downloadFilename) {
            ui.downloadFilename.textContent = 'converted_media.zip';
            ui.downloadFilename.classList.remove('hidden');
        }
    }
}

// Download logic
ui.btnDownload.addEventListener('click', async () => {
    if (totalFilesCount === 1 && singleBlob) {
        saveAs(singleBlob, singleFileName);
    } else if (totalFilesCount > 1 && finalZipBlob) {
        saveAs(finalZipBlob, 'converted_media.zip');
    }
});

// Restart logic
ui.btnRestart.addEventListener('click', () => {
    selectedFiles = [];
    category = null;
    finalZipBlob = null;
    singleBlob = null;
    ui.fileInput.value = '';
    ui.progressBar.style.width = '0%';
    if (ui.progressText) ui.progressText.textContent = '0%';
    if (ui.downloadFilename) ui.downloadFilename.classList.add('hidden');
    
    // Move file list back to config panel
    const fileListSection = document.querySelector('.file-list-section');
    if (fileListSection) {
        const configPanel = document.getElementById('state-config');
        configPanel.insertBefore(fileListSection, configPanel.firstChild);
    }
    
    switchState('state-dropzone');
});
