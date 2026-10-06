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

// Optimize image contrast and scaling for high-accuracy OCR
async function preprocessImageForOcr(file) {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                // Determine optimal scale (aim for at least 1500px on long edge for clear glyphs)
                const longEdge = Math.max(img.naturalWidth, img.naturalHeight);
                const scale = longEdge < 1500 ? Math.min(2.5, 1500 / longEdge) : 1;

                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.naturalWidth * scale);
                canvas.height = Math.round(img.naturalHeight * scale);

                const ctx = canvas.getContext('2d');
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                URL.revokeObjectURL(url);

                // Grayscale and mild contrast enhancement for sharp character edges
                const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const d = imgData.data;
                const contrast = 1.15;
                const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
                for (let i = 0; i < d.length; i += 4) {
                    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const adjusted = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
                    d[i] = adjusted;
                    d[i + 1] = adjusted;
                    d[i + 2] = adjusted;
                }
                ctx.putImageData(imgData, 0, 0);
                resolve(canvas);
            } catch (err) {
                URL.revokeObjectURL(url);
                resolve(file);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file);
        };
        img.src = url;
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

        const lang = langSelect ? langSelect.value : 'tur';

        try {
            statusEl.textContent = 'Preprocessing image & loading OCR Engine...';
            const [Tesseract, preprocessedCanvas] = await Promise.all([
                loadTesseract(),
                preprocessImageForOcr(currentFile)
            ]);

            const updateLogger = (m) => {
                if (m.status === 'recognizing text') {
                    const pct = Math.round((m.progress || 0) * 100);
                    statusEl.textContent = `Reading and extracting text (${pct}%)...`;
                } else if (m.status) {
                    statusEl.textContent = `${m.status}...`;
                }
            };

            let worker;
            try {
                // Try high-precision LSTM model first
                worker = await Tesseract.createWorker(lang, 1, {
                    langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
                    logger: updateLogger
                });
            } catch (e) {
                console.warn('Falling back to standard Tesseract models:', e);
                worker = await Tesseract.createWorker(lang, 1, {
                    logger: updateLogger
                });
            }

            await worker.setParameters({
                preserve_interword_spaces: '1'
            });

            const ret = await worker.recognize(preprocessedCanvas);
            await worker.terminate();

            // Canonical Unicode normalization (NFC) ensures Turkish diacritics (ş, ğ, ı, İ, ç, ö, ü)
            // are properly encoded as single unified glyphs, avoiding broken or alternative characters.
            let cleanedText = (ret.data && ret.data.text) ? ret.data.text.normalize('NFC') : '';
            cleanedText = cleanedText.replace(/[\u200B-\u200D\uFEFF\u0000]/g, '').trim();

            outputTextarea.value = cleanedText || 'No text detected in the image.';
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
