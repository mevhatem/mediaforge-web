// Suite Router & Tool Navigator

import { initPdfTools } from './tools-pdf.js';
import { initHeicTools } from './tools-heic.js';
import { initExifTools } from './tools-exif.js';
import { initWatermarkTools } from './tools-watermark.js';
import { initOcrTools } from './tools-ocr.js';
import { initBgRemoverTools } from './tools-bgremover.js';

const initializedTools = new Set();

export function initSuiteRouter() {
    const navLinks = document.querySelectorAll('.nav-tab-btn');
    const toolWorkspaces = document.querySelectorAll('.tool-workspace');

    function switchTool(toolId) {
        if (!toolId) toolId = 'converter';
        // Normalize hash (remove # if present)
        toolId = toolId.replace('#', '');

        // Valid tools fallback
        const validTools = ['converter', 'pdf', 'heic', 'exif', 'watermark', 'ocr', 'bgremover'];
        if (!validTools.includes(toolId)) toolId = 'converter';

        // Update nav buttons
        navLinks.forEach(btn => {
            if (btn.dataset.tool === toolId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        // Update workspaces
        toolWorkspaces.forEach(ws => {
            if (ws.id === `workspace-${toolId}`) ws.classList.add('active');
            else ws.classList.remove('active');
        });

        // Lazy initialize tool logic on first activation
        if (!initializedTools.has(toolId)) {
            initializedTools.add(toolId);
            if (toolId === 'pdf') initPdfTools();
            else if (toolId === 'heic') initHeicTools();
            else if (toolId === 'exif') initExifTools();
            else if (toolId === 'watermark') initWatermarkTools();
            else if (toolId === 'ocr') initOcrTools();
            else if (toolId === 'bgremover') initBgRemoverTools();
        }

        // Smooth scroll to tool container if clicked from page
        const container = document.getElementById('app-container');
        if (container && window.location.hash) {
            container.scrollIntoView({ behavior: 'smooth' });
        }
    }

    // Attach click listeners to nav tabs and tool hub cards
    document.querySelectorAll('[data-tool]').forEach(el => {
        el.addEventListener('click', (e) => {
            const toolId = e.currentTarget.dataset.tool;
            window.location.hash = toolId;
            switchTool(toolId);
        });
    });

    window.addEventListener('hashchange', () => {
        switchTool(window.location.hash);
    });

    // Initial tool on page load
    const initialHash = window.location.hash || 'converter';
    switchTool(initialHash);
}
