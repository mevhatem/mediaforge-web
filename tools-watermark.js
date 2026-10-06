// Batch Watermark Studio Module

export function initWatermarkTools() {
    const dropArea = document.getElementById('wm-drop-area');
    const fileInput = document.getElementById('wm-file-input');
    const fileListEl = document.getElementById('wm-file-list');
    const textInput = document.getElementById('wm-text');
    const colorInput = document.getElementById('wm-color');
    const opacityInput = document.getElementById('wm-opacity');
    const opacityVal = document.getElementById('wm-opacity-val');
    const posSelect = document.getElementById('wm-position');
    const sizeSelect = document.getElementById('wm-size');
    const previewContainer = document.getElementById('wm-preview-container');
    const previewCanvas = document.getElementById('wm-preview-canvas');
    const btnApply = document.getElementById('btn-wm-apply');
    const statusEl = document.getElementById('wm-status');
    const resultEl = document.getElementById('wm-result');
    const btnDownload = document.getElementById('btn-wm-download');

    let imageFiles = [];
    let watermarkedResults = [];
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

    // Live update preview
    if (opacityInput && opacityVal) {
        opacityInput.addEventListener('input', () => {
            opacityVal.textContent = `${Math.round(opacityInput.value * 100)}%`;
            updatePreview();
        });
    }
    if (textInput) textInput.addEventListener('input', updatePreview);
    if (colorInput) colorInput.addEventListener('input', updatePreview);
    if (posSelect) posSelect.addEventListener('change', updatePreview);
    if (sizeSelect) sizeSelect.addEventListener('change', updatePreview);

    function handleFiles(files) {
        const valid = Array.from(files).filter(f => f.type.startsWith('image/'));
        if (valid.length === 0) return;
        imageFiles.push(...valid);
        renderList();
        updatePreview();
    }

    function renderList() {
        fileListEl.innerHTML = '';
        if (imageFiles.length === 0) {
            fileListEl.classList.add('hidden');
            previewContainer.classList.add('hidden');
            btnApply.disabled = true;
            return;
        }

        fileListEl.classList.remove('hidden');
        previewContainer.classList.remove('hidden');
        btnApply.disabled = false;
        btnApply.textContent = `Watermark ${imageFiles.length} Image${imageFiles.length > 1 ? 's' : ''}`;

        imageFiles.forEach((f, idx) => {
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            item.innerHTML = `
                <div class="tool-file-info">
                    <span class="tool-file-num">💧</span>
                    <span class="tool-file-name" title="${f.name}">${f.name}</span>
                    <span class="tool-file-size">${(f.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="tool-file-actions">
                    <button class="btn-tool-action btn-remove-wm" data-index="${idx}">✕</button>
                </div>
            `;
            fileListEl.appendChild(item);
        });

        fileListEl.querySelectorAll('.btn-remove-wm').forEach(btn => {
            btn.onclick = (e) => {
                const i = parseInt(e.currentTarget.dataset.index, 10);
                imageFiles.splice(i, 1);
                renderList();
                updatePreview();
            };
        });
    }

    function updatePreview() {
        if (imageFiles.length === 0 || !previewCanvas) return;
        const firstFile = imageFiles[0];
        const img = new Image();
        const url = URL.createObjectURL(firstFile);

        img.onload = () => {
            // Draw thumbnail preview (scaled down for UI)
            const maxW = 500;
            const scale = Math.min(1, maxW / img.naturalWidth);
            previewCanvas.width = img.naturalWidth * scale;
            previewCanvas.height = img.naturalHeight * scale;

            const ctx = previewCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0, previewCanvas.width, previewCanvas.height);
            applyWatermarkToContext(ctx, previewCanvas.width, previewCanvas.height);
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    function applyWatermarkToContext(ctx, width, height) {
        const text = (textInput ? textInput.value : '') || 'Media Forge';
        const opacity = opacityInput ? parseFloat(opacityInput.value) : 0.5;
        const color = colorInput ? colorInput.value : '#ffffff';
        const pos = posSelect ? posSelect.value : 'bottom-right';
        const sizeMultiplier = sizeSelect ? parseFloat(sizeSelect.value) : 0.05; // 5% of height

        const fontSize = Math.max(16, Math.round(height * sizeMultiplier));
        ctx.save();
        ctx.font = `bold ${fontSize}px sans-serif`;
        ctx.fillStyle = color;
        ctx.globalAlpha = opacity;

        const metrics = ctx.measureText(text);
        const textW = metrics.width;
        const textH = fontSize;

        let x = width - textW - 20;
        let y = height - 20;

        if (pos === 'center') {
            x = (width - textW) / 2;
            y = (height + textH) / 2;
        } else if (pos === 'bottom-left') {
            x = 20;
            y = height - 20;
        } else if (pos === 'top-right') {
            x = width - textW - 20;
            y = textH + 20;
        } else if (pos === 'top-left') {
            x = 20;
            y = textH + 20;
        } else if (pos === 'tile') {
            // Diagonal repeating tile
            ctx.rotate(-Math.PI / 6);
            ctx.globalAlpha = opacity * 0.4;
            const stepX = textW * 2;
            const stepY = textH * 4;
            for (let tx = -width; tx < width * 2; tx += stepX) {
                for (let ty = -height; ty < height * 2; ty += stepY) {
                    ctx.fillText(text, tx, ty);
                }
            }
            ctx.restore();
            return;
        }

        // Draw shadow for readability
        ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;

        ctx.fillText(text, x, y);
        ctx.restore();
    }

    btnApply.addEventListener('click', async () => {
        if (imageFiles.length === 0) return;
        btnApply.disabled = true;
        statusEl.classList.remove('hidden');
        resultEl.classList.add('hidden');
        watermarkedResults = [];
        finalZipBlob = null;

        try {
            for (let i = 0; i < imageFiles.length; i++) {
                const file = imageFiles[i];
                statusEl.textContent = `Watermarking ${i + 1} of ${imageFiles.length}: ${file.name}...`;

                const blob = await new Promise((resolve, reject) => {
                    const img = new Image();
                    const url = URL.createObjectURL(file);
                    img.onload = () => {
                        try {
                            const canvas = document.createElement('canvas');
                            canvas.width = img.naturalWidth;
                            canvas.height = img.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(img, 0, 0);
                            applyWatermarkToContext(ctx, canvas.width, canvas.height);
                            URL.revokeObjectURL(url);

                            const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
                            canvas.toBlob((b) => {
                                if (b) resolve(b);
                                else reject(new Error('Canvas blob failed'));
                            }, mime, 0.95);
                        } catch (err) {
                            URL.revokeObjectURL(url);
                            reject(err);
                        }
                    };
                    img.onerror = () => {
                        URL.revokeObjectURL(url);
                        reject(new Error('Failed to load image for watermarking'));
                    };
                    img.src = url;
                });

                watermarkedResults.push({
                    name: `watermarked_${file.name}`,
                    blob: blob
                });
            }

            if (watermarkedResults.length > 1 && window.JSZip) {
                statusEl.textContent = 'Packaging watermarked images...';
                const zip = new window.JSZip();
                watermarkedResults.forEach(r => zip.file(r.name, r.blob));
                finalZipBlob = await zip.generateAsync({ type: 'blob' });
            }

            statusEl.textContent = '✨ Watermarking Complete!';
            resultEl.classList.remove('hidden');

            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            console.error('Watermark Error:', err);
            statusEl.textContent = `Error: ${err.message || 'Watermark failed'}`;
        } finally {
            btnApply.disabled = false;
        }
    });

    btnDownload.addEventListener('click', () => {
        if (watermarkedResults.length === 1) {
            const single = watermarkedResults[0];
            if (window.saveAs) window.saveAs(single.blob, single.name);
            else {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(single.blob);
                a.download = single.name;
                a.click();
            }
        } else if (finalZipBlob) {
            if (window.saveAs) window.saveAs(finalZipBlob, 'watermarked_images.zip');
        }
    });
}
