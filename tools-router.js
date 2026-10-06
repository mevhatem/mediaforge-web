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
    const suiteNav = document.getElementById('suite-nav');
    const btnNavPrev = document.getElementById('btn-nav-prev');
    const btnNavNext = document.getElementById('btn-nav-next');

    // 1. Arrow Button Controls
    if (btnNavPrev && suiteNav) {
        btnNavPrev.addEventListener('click', () => {
            suiteNav.scrollBy({ left: -200, behavior: 'smooth' });
        });
    }
    if (btnNavNext && suiteNav) {
        btnNavNext.addEventListener('click', () => {
            suiteNav.scrollBy({ left: 200, behavior: 'smooth' });
        });
    }

    // 2. Mouse Wheel Scroll (Translates vertical wheel to horizontal scroll on PC)
    if (suiteNav) {
        suiteNav.addEventListener('wheel', (e) => {
            if (e.deltaY !== 0) {
                e.preventDefault();
                suiteNav.scrollLeft += e.deltaY;
            }
        }, { passive: false });

        // 3. Mouse Drag-to-Scroll (Desktop grab and swipe)
        let isDown = false;
        let startX = 0;
        let startScrollLeft = 0;

        suiteNav.addEventListener('mousedown', (e) => {
            isDown = true;
            suiteNav.classList.add('grabbing');
            startX = e.pageX - suiteNav.offsetLeft;
            startScrollLeft = suiteNav.scrollLeft;
        });

        window.addEventListener('mouseup', () => {
            if (isDown) {
                isDown = false;
                suiteNav.classList.remove('grabbing');
            }
        });

        suiteNav.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - suiteNav.offsetLeft;
            const walk = (x - startX) * 1.5;
            suiteNav.scrollLeft = startScrollLeft - walk;
        });
    }

    function switchTool(toolId) {
        if (!toolId) toolId = 'converter';
        // Normalize hash (remove # if present)
        toolId = toolId.replace('#', '');

        // Valid tools fallback
        const validTools = ['converter', 'pdf', 'heic', 'exif', 'watermark', 'ocr', 'bgremover'];
        if (!validTools.includes(toolId)) toolId = 'converter';

        // Update nav buttons
        navLinks.forEach(btn => {
            if (btn.dataset.tool === toolId) {
                btn.classList.add('active');
                // Scroll button into view inside suiteNav
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            } else {
                btn.classList.remove('active');
            }
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
