// EXIF & Privacy Metadata Stripper Module

export function initExifTools() {
    const dropArea = document.getElementById('exif-drop-area');
    const fileInput = document.getElementById('exif-file-input');
    const fileListEl = document.getElementById('exif-file-list');
    const btnClean = document.getElementById('btn-exif-clean');
    const statusEl = document.getElementById('exif-status');
    const resultEl = document.getElementById('exif-result');
    const btnDownload = document.getElementById('btn-exif-download');

    let imageFiles = [];
    let cleanedResults = [];
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
        const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (valid.length === 0) return;
        imageFiles.push(...valid);
        renderList();
    }

    function renderList() {
        fileListEl.innerHTML = '';
        if (imageFiles.length === 0) {
            fileListEl.classList.add('hidden');
            btnClean.disabled = true;
            return;
        }

        fileListEl.classList.remove('hidden');
        btnClean.disabled = false;
        btnClean.textContent = `Clean & Strip Metadata from ${imageFiles.length} Image${imageFiles.length > 1 ? 's' : ''}`;

        imageFiles.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            item.innerHTML = `
                <div class="tool-file-info">
                    <span class="tool-file-num">🛡️</span>
                    <span class="tool-file-name" title="${f.name}">${f.name}</span>
                    <span class="tool-file-size">${(f.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="tool-file-actions">
                    <button class="btn-tool-action btn-remove-exif" data-index="${idx}">✕</button>
                </div>
            `;
            fileListEl.appendChild(item);
        });

        fileListEl.querySelectorAll('.btn-remove-exif').forEach(btn => {
            btn.onclick = (e) => {
                const i = parseInt(e.currentTarget.dataset.index, 10);
                imageFiles.splice(i, 1);
                renderList();
            };
        });
    }

    btnClean.addEventListener('click', async () => {
        if (imageFiles.length === 0) return;
        btnClean.disabled = true;
        statusEl.classList.remove('hidden');
        resultEl.classList.add('hidden');
        cleanedResults = [];
        finalZipBlob = null;

        try {
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                statusEl.textContent = `Scrubbing metadata ${i + 1} of ${imageFiles.length}: ${file.name}...`;

                const cleanedBlob = await stripMetadataViaCanvas(file);
                cleanedResults.push({
                    name: `clean_${file.name}`,
                    blob: cleanedBlob
                });
            }

            if (cleanedResults.length > 1 && window.JSZip) {
                statusEl.textContent = 'Packaging cleaned images...';
                const zip = new window.JSZip();
                cleanedResults.forEach(r => zip.file(r.name, r.blob));
                finalZipBlob = await zip.generateAsync({ type: 'blob' });
            }

            statusEl.textContent = '✨ All GPS & Camera Metadata Completely Removed!';
            resultEl.classList.remove('hidden');

            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            console.error('EXIF Removal Error:', err);
            statusEl.textContent = `Error: ${err.message || 'Could not clean metadata'}`;
        } finally {
            btnClean.disabled = false;
        }
    });

    btnDownload.addEventListener('click', () => {
        if (cleanedResults.length === 1) {
            const single = cleanedResults[0];
            if (window.saveAs) window.saveAs(single.blob, single.name);
            else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(single.blob);
                a.download = single.name;
                a.click();
            }
        } else if (finalZipBlob) {
            if (window.saveAs) window.saveAs(finalZipBlob, 'privacy_cleaned_images.zip');
        }
    });
}

function stripMetadataViaCanvas(file) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(url);

                const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error('Canvas blob generation failed'));
                }, mime, 0.95);
            } catch (e) {
                URL.revokeObjectURL(url);
                reject(e);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image for EXIF cleaning'));
        };
        img.src = url;
    });
}
