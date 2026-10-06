// AI Background Removal Module (In-Browser Machine Learning via @imgly/background-removal)

let imglyRemoveBg = null;

async function loadBackgroundRemovalEngine() {
    if (imglyRemoveBg) return imglyRemoveBg;
    try {
        const mod = await import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
        imglyRemoveBg = mod.removeBackground || mod.default;
        return imglyRemoveBg;
    } catch (err) {
        console.error('Failed to load @imgly/background-removal ESM:', err);
        throw err;
    }
}

export function initBgRemoverTools() {
    const dropArea = document.getElementById('bg-drop-area');
    const fileInput = document.getElementById('bg-file-input');
    const previewContainer = document.getElementById('bg-preview-container');
    const previewOriginal = document.getElementById('bg-preview-orig');
    const previewResult = document.getElementById('bg-preview-result');
    const btnRemove = document.getElementById('btn-bg-remove');
    const statusEl = document.getElementById('bg-status');
    const resultEl = document.getElementById('bg-result');
    const btnDownload = document.getElementById('btn-bg-download');

    let currentFile = null;
    let resultBlob = null;

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

        if (previewOriginal) previewOriginal.src = URL.createObjectURL(file);
        if (previewContainer) previewContainer.classList.remove('hidden');
        if (resultEl) resultEl.classList.add('hidden');
        if (statusEl) statusEl.classList.add('hidden');
        if (btnRemove) {
            btnRemove.disabled = false;
            btnRemove.textContent = '✨ Remove Background (100% In-Browser AI)';
        }
    }

    btnRemove.addEventListener('click', async () => {
        if (!currentFile) return;
        btnRemove.disabled = true;
        statusEl.classList.remove('hidden');
        resultEl.classList.add('hidden');

        try {
            statusEl.textContent = 'Initializing ONNX AI Neural Model... (first time may take a few seconds)';
            const removeBg = await loadBackgroundRemovalEngine();

            statusEl.textContent = 'Analyzing image & cutting out background...';
            const blob = await removeBg(currentFile, {
                progress: (key, current, total) => {
                    const pct = total ? Math.round((current / total) * 100) : '';
                    statusEl.textContent = `Running AI Segmentation ${pct ? `(${pct}%)` : ''}...`;
                }
            });

            resultBlob = blob;
            if (previewResult) previewResult.src = URL.createObjectURL(blob);

            statusEl.textContent = '✨ Background Removed with Zero Server Uploads!';
            resultEl.classList.remove('hidden');

            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 80, spread: 75, origin: { y: 0.6 } });
            }
        } catch (err) {
            console.error('BG Removal Error:', err);
            statusEl.textContent = `Error: ${err.message || 'Background removal failed. Make sure your browser supports WebAssembly.'}`;
        } finally {
            btnRemove.disabled = false;
        }
    });

    if (btnDownload) {
        btnDownload.addEventListener('click', () => {
            if (!resultBlob) return;
            const originalName = currentFile ? currentFile.name.substring(0, currentFile.name.lastIndexOf('.')) : 'image';
            const outName = `${originalName}_no_bg.png`;
            if (window.saveAs) {
                window.saveAs(resultBlob, outName);
            } else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(resultBlob);
                a.download = outName;
                a.click();
            }
        });
    }
}
