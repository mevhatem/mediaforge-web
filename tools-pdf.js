// PDF Tools Module (Merge & Split via pdf-lib)

let pdfLibLoaded = false;
async function loadPdfLib() {
    if (pdfLibLoaded && window.PDFLib) return window.PDFLib;
    return new Promise((resolve, reject) => {
        if (window.PDFLib) {
            pdfLibLoaded = true;
            return resolve(window.PDFLib);
        }
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/pdf-lib/dist/pdf-lib.min.js';
        script.onload = () => {
            pdfLibLoaded = true;
            resolve(window.PDFLib);
        };
        script.onerror = () => reject(new Error('Failed to load pdf-lib'));
        document.head.appendChild(script);
    });
}

export function initPdfTools() {
    const dropArea = document.getElementById('pdf-drop-area');
    const fileInput = document.getElementById('pdf-file-input');
    const fileListEl = document.getElementById('pdf-file-list');
    const btnMerge = document.getElementById('btn-pdf-merge');
    const pdfStatus = document.getElementById('pdf-status');
    const pdfResult = document.getElementById('pdf-result');
    const btnDownload = document.getElementById('btn-pdf-download');
    
    let pdfFiles = [];
    let mergedPdfBlob = null;

    if (!dropArea || !fileInput) return;

    dropArea.addEventListener('click', () => fileInput.click());
    dropArea.addEventListener('dragover', (e) => { e.preventDefault(); dropArea.classList.add('dragover'); });
    dropArea.addEventListener('dragleave', () => dropArea.classList.remove('dragover'));
    dropArea.addEventListener('drop', (e) => {
        e.preventDefault();
        dropArea.classList.remove('dragover');
        handlePdfFiles(e.dataTransfer.files);
    });
    fileInput.addEventListener('change', (e) => handlePdfFiles(e.target.files));

    async function handlePdfFiles(files) {
        const valid = Array.from(files).filter(f => f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf');
        if (valid.length === 0) return;
        
        pdfFiles.push(...valid);
        renderPdfList();
    }

    function renderPdfList() {
        fileListEl.innerHTML = '';
        if (pdfFiles.length === 0) {
            fileListEl.classList.add('hidden');
            btnMerge.disabled = true;
            return;
        }

        fileListEl.classList.remove('hidden');
        btnMerge.disabled = pdfFiles.length < 2;
        btnMerge.textContent = pdfFiles.length < 2 ? 'Add at least 2 PDFs to Merge' : `Merge ${pdfFiles.length} PDFs`;

        pdfFiles.forEach((file, index) => {
            const item = document.createElement('div');
            item.className = 'tool-file-item';
            item.innerHTML = `
                <div class="tool-file-info">
                    <span class="tool-file-num">${index + 1}</span>
                    <span class="tool-file-name" title="${file.name}">${file.name}</span>
                    <span class="tool-file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                <div class="tool-file-actions">
                    <button class="btn-tool-action btn-move-up" data-index="${index}" ${index === 0 ? 'disabled' : ''}>▲</button>
                    <button class="btn-tool-action btn-move-down" data-index="${index}" ${index === pdfFiles.length - 1 ? 'disabled' : ''}>▼</button>
                    <button class="btn-tool-action btn-remove-pdf" data-index="${index}">✕</button>
                </div>
            `;
            fileListEl.appendChild(item);
        });

        // Event listeners for reorder and delete
        fileListEl.querySelectorAll('.btn-move-up').forEach(btn => {
            btn.onclick = (e) => {
                const i = parseInt(e.currentTarget.dataset.index, 10);
                if (i > 0) {
                    const temp = pdfFiles[i];
                    pdfFiles[i] = pdfFiles[i - 1];
                    pdfFiles[i - 1] = temp;
                    renderPdfList();
                }
            };
        });

        fileListEl.querySelectorAll('.btn-move-down').forEach(btn => {
            btn.onclick = (e) => {
                const i = parseInt(e.currentTarget.dataset.index, 10);
                if (i < pdfFiles.length - 1) {
                    const temp = pdfFiles[i];
                    pdfFiles[i] = pdfFiles[i + 1];
                    pdfFiles[i + 1] = temp;
                    renderPdfList();
                }
            };
        });

        fileListEl.querySelectorAll('.btn-remove-pdf').forEach(btn => {
            btn.onclick = (e) => {
                const i = parseInt(e.currentTarget.dataset.index, 10);
                pdfFiles.splice(i, 1);
                renderPdfList();
            };
        });
    }

    btnMerge.addEventListener('click', async () => {
        if (pdfFiles.length < 2) return;
        btnMerge.disabled = true;
        pdfStatus.textContent = 'Merging PDFs in browser...';
        pdfStatus.classList.remove('hidden');

        try {
            const PDFLib = await loadPdfLib();
            const mergedPdf = await PDFLib.PDFDocument.create();

            for (let i = 0; i < pdfFiles.length; i++) {
                pdfStatus.textContent = `Merging file ${i + 1} of ${pdfFiles.length}: ${pdfFiles[i].name}...`;
                const arrayBuffer = await pdfFiles[i].arrayBuffer();
                const pdf = await PDFLib.PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach(page => mergedPdf.addPage(page));
            }

            pdfStatus.textContent = 'Generating merged PDF file...';
            const mergedBytes = await mergedPdf.save();
            mergedPdfBlob = new Blob([mergedBytes], { type: 'application/pdf' });

            pdfStatus.textContent = '✨ Merge Complete!';
            pdfResult.classList.remove('hidden');

            if (typeof window.confetti === 'function') {
                window.confetti({ particleCount: 75, spread: 70, origin: { y: 0.6 } });
            }
        } catch (err) {
            console.error('PDF Merge Error:', err);
            pdfStatus.textContent = `Error: ${err.message || 'Could not merge PDFs'}`;
        } finally {
            btnMerge.disabled = false;
        }
    });

    btnDownload.addEventListener('click', () => {
        if (!mergedPdfBlob) return;
        if (window.saveAs) {
            window.saveAs(mergedPdfBlob, 'mediaforge_merged.pdf');
        } else {
            const a = document.createElement('a');
            a.href = URL.createObjectURL(mergedPdfBlob);
            a.download = 'mediaforge_merged.pdf';
            a.click();
        }
    });
}
