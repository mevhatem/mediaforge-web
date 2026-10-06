// In-Browser OCR Scanner (Image to Text via Tesseract.js)

let tesseractLoaded = false;
async function loadTesseract() {
    if (tesseractLoaded && window.Tesseract) return window.Tesseract;
    return new Promise((resolve, reject) => {
        if (window.Tesseract) {
            tesseractLoaded = true;
            return resolve(window.Tesseract);
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.onload = () => {
            tesseractLoaded = true;
            resolve(window.Tesseract);
        };
        script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
        document.head.appendChild(script);
    });
}

export function initOcrTools() {
    const dropArea = document.getElementById('ocr-drop-area');
    const fileInput = document.getElementById('ocr-file-input');
    const previewContainer = document.getElementById('ocr-preview-container');
    const previewImg = document.getElementById('ocr-preview-img');
    const langSelect = document.getElementById('ocr-language');
    const btnScan = document.getElementById('btn-ocr-scan');
    const statusEl = document.getElementById('ocr-status');
    const resultEl = document.getElementById('ocr-result');
    const outputTextarea = document.getElementById('ocr-output');
    const btnCopy = document.getElementById('btn-ocr-copy');
    const btnDownloadTxt = document.getElementById('btn-ocr-download-txt');

    let currentFile = null;

    if (!dropArea || !fileInput) return;

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!file.type.startsWith('image/')) return;
        currentFile = file;

        if (previewImg) previewImg.src = URL.createObjectURL(file);
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (btnScan) {
            btnScan.disabled = false;
            btnScan.textContent = '🔍 Extract Text from Image (OCR)';
        }
        if (resultEl) resultEl.classList.add('hidden');
        if (statusEl) statusEl.classList.add('hidden');
    }

    btnScan.addEventListener('click', async () => {
        if (!currentFile) return;
        btnScan.disabled = true;
        statusEl.classList.remove('hidden');
        resultEl.classList.add('hidden');

        const lang = langSelect ? langSelect.value : 'tur+eng';

        try {
            statusEl.textContent = 'Loading OCR Engine (Tesseract.js)...';
            const Tesseract = await loadTesseract();

            const worker = await Tesseract.createWorker(lang, 1, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const pct = Math.round((m.progress || 0) * 100);
                        statusEl.textContent = `Reading and extracting text (${pct}%)...`;
                    } else if (m.status) {
                        statusEl.textContent = `${m.status}...`;
                    }
                }
            });

            const ret = await worker.recognize(currentFile);
            await worker.terminate();

            outputTextarea.value = ret.data.text || 'No text detected in the image.';
            statusEl.textContent = '✨ Text Successfully Extracted!';
            resultEl.classList.remove('hidden');

            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            console.error('OCR Error:', err);
            statusEl.textContent = `Error: ${err.message || 'OCR processing failed'}`;
        } finally {
            btnScan.disabled = false;
        }
    });

    if (btnCopy) {
        btnCopy.addEventListener('click', () => {
            if (!outputTextarea.value) return;
            navigator.clipboard.writeText(outputTextarea.value).then(() => {
                const orig = btnCopy.textContent;
                btnCopy.textContent = '✅ Copied!';
                setTimeout(() => { btnCopy.textContent = orig; }, 2000);
            });
        });
    }

    if (btnDownloadTxt) {
        btnDownloadTxt.addEventListener('click', () => {
            if (!outputTextarea.value) return;
            const blob = new Blob([outputTextarea.value], { type: 'text/plain;charset=utf-8' });
            if (window.saveAs) {
                window.saveAs(blob, 'ocr_extracted_text.txt');
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'ocr_extracted_text.txt';
                a.click();
            }
        });
    }
}
