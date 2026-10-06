// HEIC to JPG / PNG Converter Module (via heic2any)

let heic2anyLoaded = false;
async function loadHeic2Any() {
    if (heic2anyLoaded && window.heic2any) return window.heic2any;
    return new Promise((resolve, reject) => {
        if (window.heic2any) {
            heic2anyLoaded = true;
            return resolve(window.heic2any);
        }
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/heic2any/0.0.4/heic2any.min.js';
        script.onload = () => {
            heic2anyLoaded = true;
            resolve(window.heic2any);
        };
        script.onerror = () => reject(new Error('Failed to load heic2any library'));
        document.head.appendChild(script);
    });
}

export function initHeicTools() {
    const dropArea = document.getElementById('heic-drop-area');
    const fileInput = document.getElementById('heic-file-input');
    const fileListEl = document.getElementById('heic-file-list');
    const formatSelect = document.getElementById('heic-format');
    const qualitySelect = document.getElementById('heic-quality');
    const btnConvert = document.getElementById('btn-heic-convert');
    const statusEl = document.getElementById('heic-status');
    const resultEl = document.getElementById('heic-result');
    const btnDownload = document.getElementById('btn-heic-download');

    let heicFiles = [];
    let convertedResults = []; // array of { name, blob }
    let finalZipBlob = null;

    if (!dropArea || !fileInput) return;

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    function handleFiles(files) {
        const valid = Array.from(files).filter(f => {
            const ext = f.name.substring(f.name.lastIndexOf('.')).toLowerCase();
            return ext === '.heic' || ext === '.heif' || f.type === 'image/heic' || f.type === 'image/heif';
        });

        if (valid.length === 0) return;
        heicFiles.push(...valid);
        renderList();
    }

    function renderList() {
        fileListEl.innerHTML = '';
        if (heicFiles.length === 0) {
            fileListEl.classList.add('hidden');
            btnConvert.disabled = true;
            return;
        }

        fileListEl.classList.remove('hidden');
        btnConvert.disabled = false;
        btnConvert.textContent = `Convert ${heicFiles.length} HEIC Image${heicFiles.length > 1 ? 's' : ''}`;

        heicFiles.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            item.innerHTML = `
                <div class="tool-file-info">
                    <span class="tool-file-num">📱</span>
                    <span class="tool-file-name" title="${f.name}">${f.name}</span>
                    <span class="tool-file-size">${(f.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="tool-file-actions">
                    <button class="btn-tool-action btn-remove-heic" data-index="${idx}">✕</button>
                </div>
            `;
            fileListEl.appendChild(item);
        });

        fileListEl.querySelectorAll('.btn-remove-heic').forEach(btn => {
            btn.onclick = (e) => {
                const i = parseInt(e.currentTarget.dataset.index, 10);
                heicFiles.splice(i, 1);
                renderList();
            };
        });
    }

    btnConvert.addEventListener('click', async () => {
        if (heicFiles.length === 0) return;
        btnConvert.disabled = true;
        statusEl.classList.remove('hidden');
        resultEl.classList.add('hidden');
        convertedResults = [];
        finalZipBlob = null;

        const targetFormat = formatSelect ? formatSelect.value.toLowerCase() : 'jpeg';
        const targetType = targetFormat === 'png' ? 'image/png' : 'image/jpeg';
        const targetExt = targetFormat === 'png' ? 'png' : 'jpg';
        const quality = qualitySelect ? parseFloat(qualitySelect.value) : 0.9;

        try {
            statusEl.textContent = 'Loading iPhone HEIC decoder...';
            const heic2any = await loadHeic2Any();

            for (let i = 0; i < heicFiles.length; i++) {
                const file = heicFiles[i];
                statusEl.textContent = `Converting ${i + 1} of ${heicFiles.length}: ${file.name}...`;

                const convertedBlob = await heic2any({
                    blob: file,
                    toType: targetType,
                    quality: quality
                });

                // heic2any can return an array if image contains multiple frames/burst
                const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                const baseName = file.name.substring(0, file.name.lastIndexOf('.'));
                convertedResults.push({
                    name: `${baseName}.${targetExt}`,
                    blob: resultBlob
                });
            }

            statusEl.textContent = 'Packaging files...';
            if (convertedResults.length > 1 && window.JSZip) {
                const zip = new window.JSZip();
                convertedResults.forEach(r => zip.file(r.name, r.blob));
                finalZipBlob = await zip.generateAsync({ type: 'blob' });
            }

            statusEl.textContent = '✨ Conversion Complete!';
            resultEl.classList.remove('hidden');

            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            console.error('HEIC Conversion Error:', err);
            statusEl.textContent = `Error: ${err.message || 'Could not convert HEIC file'}`;
        } finally {
            btnConvert.disabled = false;
        }
    });

    btnDownload.addEventListener('click', () => {
        if (convertedResults.length === 1) {
            const single = convertedResults[0];
            if (window.saveAs) window.saveAs(single.blob, single.name);
            else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(single.blob);
                a.download = single.name;
                a.click();
            }
        } else if (finalZipBlob) {
            if (window.saveAs) window.saveAs(finalZipBlob, 'converted_heic_images.zip');
        }
    });
}
