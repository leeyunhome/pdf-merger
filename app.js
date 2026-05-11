const { PDFDocument } = PDFLib;

// ─── Tab switching ───────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const tab = btn.dataset.tab;
        document.getElementById('tab-merge').style.display = tab === 'merge' ? 'block' : 'none';
        document.getElementById('tab-split').style.display = tab === 'split' ? 'block' : 'none';
    });
});

// ─── MERGE ───────────────────────────────────────────────────────
const mergeDropZone = document.getElementById('merge-drop-zone');
const mergeFileInput = document.getElementById('merge-file-input');
const mergeFileList = document.getElementById('merge-file-list');
const mergeActionBar = document.getElementById('merge-action-bar');
const btnMerge = document.getElementById('btn-merge');
const btnClear = document.getElementById('btn-clear');

let uploadedFiles = [];

mergeDropZone.addEventListener('click', () => mergeFileInput.click());
mergeDropZone.addEventListener('dragover', e => { e.preventDefault(); mergeDropZone.classList.add('dragover'); });
mergeDropZone.addEventListener('dragleave', () => mergeDropZone.classList.remove('dragover'));
mergeDropZone.addEventListener('drop', e => {
    e.preventDefault();
    mergeDropZone.classList.remove('dragover');
    handleMergeFiles(Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf'));
});
mergeFileInput.addEventListener('change', e => {
    handleMergeFiles(Array.from(e.target.files).filter(f => f.type === 'application/pdf'));
    mergeFileInput.value = '';
});

function handleMergeFiles(files) {
    if (!files.length) return;
    files.forEach(file => uploadedFiles.push({ id: Math.random().toString(36).slice(2, 11), file, name: file.name, size: formatBytes(file.size) }));
    renderMergeList();
}

function renderMergeList() {
    mergeFileList.innerHTML = '';
    if (!uploadedFiles.length) { mergeActionBar.style.display = 'none'; return; }
    mergeActionBar.style.display = 'flex';
    uploadedFiles.forEach((fileObj, index) => {
        const item = document.createElement('div');
        item.className = 'file-item';
        item.innerHTML = `
            <span class="file-icon">📄</span>
            <div class="file-info">
                <span class="file-name">${fileObj.name}</span>
                <span class="file-size">${fileObj.size}</span>
            </div>
            <div class="file-actions">
                <button class="btn-icon" onclick="moveFile(${index}, -1)" ${index === 0 ? 'disabled' : ''}>↑</button>
                <button class="btn-icon" onclick="moveFile(${index}, 1)" ${index === uploadedFiles.length - 1 ? 'disabled' : ''}>↓</button>
                <button class="btn-icon btn-remove" onclick="removeFile('${fileObj.id}')">✕</button>
            </div>`;
        mergeFileList.appendChild(item);
    });
}

window.removeFile = id => { uploadedFiles = uploadedFiles.filter(f => f.id !== id); renderMergeList(); };
window.moveFile = (index, dir) => {
    const newIdx = index + dir;
    if (newIdx < 0 || newIdx >= uploadedFiles.length) return;
    [uploadedFiles[index], uploadedFiles[newIdx]] = [uploadedFiles[newIdx], uploadedFiles[index]];
    renderMergeList();
};

btnClear.addEventListener('click', () => { if (confirm('모든 파일을 삭제하시겠습니까?')) { uploadedFiles = []; renderMergeList(); } });

btnMerge.addEventListener('click', async () => {
    if (uploadedFiles.length < 2) { alert('최소 2개 이상의 PDF 파일을 추가해 주세요.'); return; }
    try {
        btnMerge.classList.add('is-merging');
        btnMerge.disabled = true;
        const mergedPdf = await PDFDocument.create();
        for (const fileObj of uploadedFiles) {
            const pdf = await PDFDocument.load(await fileObj.file.arrayBuffer());
            const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            pages.forEach(p => mergedPdf.addPage(p));
        }
        downloadBlob(await mergedPdf.save(), 'merged_document.pdf', 'application/pdf');
    } catch (e) {
        alert('PDF 병합 중 오류가 발생했습니다: ' + e.message);
    } finally {
        btnMerge.classList.remove('is-merging');
        btnMerge.disabled = false;
    }
});

// ─── SPLIT ───────────────────────────────────────────────────────
pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const splitDropZone = document.getElementById('split-drop-zone');
const splitFileInput = document.getElementById('split-file-input');
const splitPanel = document.getElementById('split-panel');
const btnSplit = document.getElementById('btn-split');
const btnSplitReset = document.getElementById('btn-split-reset');
const pageGrid = document.getElementById('page-grid');
const selectionCountEl = document.getElementById('selection-count');
const splitGroupsEl = document.getElementById('split-groups');

let splitFile = null;
let splitPageCount = 0;
let selectedPages = new Set();
let groups = [];

splitDropZone.addEventListener('click', () => splitFileInput.click());
splitDropZone.addEventListener('dragover', e => { e.preventDefault(); splitDropZone.classList.add('dragover'); });
splitDropZone.addEventListener('dragleave', () => splitDropZone.classList.remove('dragover'));
splitDropZone.addEventListener('drop', e => {
    e.preventDefault();
    splitDropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
    if (files.length) loadSplitFile(files[0]);
});
splitFileInput.addEventListener('change', e => { if (e.target.files[0]) loadSplitFile(e.target.files[0]); splitFileInput.value = ''; });

async function loadSplitFile(file) {
    splitFile = file;
    selectedPages.clear();
    groups = [];
    splitPanel.style.display = 'block';
    splitDropZone.style.display = 'none';
    document.getElementById('split-file-name').textContent = file.name;
    pageGrid.innerHTML = '<div class="thumb-loading"><span class="loader" style="display:inline-block;border-color:rgba(255,255,255,0.2);border-top-color:var(--primary);"></span> 미리보기 생성 중...</div>';
    renderGroups();
    updateSelectionUI();

    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        splitPageCount = pdfDoc.numPages;
        document.getElementById('split-page-count').textContent = `총 ${splitPageCount}페이지`;
        pageGrid.innerHTML = '';

        for (let i = 1; i <= splitPageCount; i++) {
            const page = await pdfDoc.getPage(i);
            const baseViewport = page.getViewport({ scale: 1 });
            const scale = 130 / baseViewport.width;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;

            const thumb = document.createElement('div');
            thumb.className = 'page-thumb';
            thumb.dataset.page = i;
            thumb.appendChild(canvas);
            thumb.innerHTML += `<div class="thumb-check">✓</div><span class="thumb-num">${i}</span>`;
            thumb.addEventListener('click', () => togglePage(i));
            pageGrid.appendChild(thumb);
        }
    } catch (e) {
        pageGrid.innerHTML = `<p style="color:var(--danger);padding:1rem;">미리보기 생성 실패: ${e.message}</p>`;
    }
}

function togglePage(n) {
    selectedPages.has(n) ? selectedPages.delete(n) : selectedPages.add(n);
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedPages.size;
    selectionCountEl.textContent = count > 0 ? `${count}개 페이지 선택됨` : '페이지를 클릭하여 선택하세요';

    document.querySelectorAll('.page-thumb').forEach(thumb => {
        const n = parseInt(thumb.dataset.page);
        thumb.classList.toggle('selected', selectedPages.has(n));

        let badge = thumb.querySelector('.thumb-group-badge');
        const gi = groups.findIndex(g => g.pages.includes(n));
        if (gi >= 0) {
            if (!badge) { badge = document.createElement('span'); badge.className = 'thumb-group-badge'; thumb.appendChild(badge); }
            badge.textContent = `G${gi + 1}`;
        } else if (badge) {
            badge.remove();
        }
    });
}

document.getElementById('btn-select-all').addEventListener('click', () => {
    for (let i = 1; i <= splitPageCount; i++) selectedPages.add(i);
    updateSelectionUI();
});

document.getElementById('btn-clear-sel').addEventListener('click', () => {
    selectedPages.clear();
    updateSelectionUI();
});

document.getElementById('btn-add-group').addEventListener('click', () => {
    if (!selectedPages.size) { alert('페이지를 먼저 선택해 주세요.'); return; }
    groups.push({ id: Date.now(), pages: Array.from(selectedPages).sort((a, b) => a - b) });
    selectedPages.clear();
    updateSelectionUI();
    renderGroups();
});

document.getElementById('btn-split-all-pages').addEventListener('click', () => {
    if (!splitPageCount) return;
    if (!confirm(`${splitPageCount}개의 PDF가 생성됩니다. 계속하시겠습니까?`)) return;
    groups = Array.from({ length: splitPageCount }, (_, i) => ({ id: i, pages: [i + 1] }));
    selectedPages.clear();
    updateSelectionUI();
    renderGroups();
});

function renderGroups() {
    splitGroupsEl.innerHTML = '';
    if (!groups.length) return;
    const title = document.createElement('p');
    title.className = 'groups-title';
    title.textContent = `분리 그룹 — ${groups.length}개의 PDF가 생성됩니다`;
    splitGroupsEl.appendChild(title);

    groups.forEach((g, i) => {
        const card = document.createElement('div');
        card.className = 'group-card';
        card.innerHTML = `
            <span class="group-num">PDF ${i + 1}</span>
            <span class="group-pages">${formatPageList(g.pages)}</span>
            <button class="btn-icon btn-remove" onclick="removeGroup(${i})">✕</button>`;
        splitGroupsEl.appendChild(card);
    });
}

function formatPageList(pages) {
    const ranges = [];
    let start = pages[0], prev = pages[0];
    for (let i = 1; i <= pages.length; i++) {
        if (pages[i] === prev + 1) { prev = pages[i]; continue; }
        ranges.push(start === prev ? `${start}p` : `${start}-${prev}p`);
        start = prev = pages[i];
    }
    return ranges.join(', ');
}

window.removeGroup = i => { groups.splice(i, 1); renderGroups(); updateSelectionUI(); };

btnSplitReset.addEventListener('click', () => {
    splitFile = null;
    splitPageCount = 0;
    selectedPages.clear();
    groups = [];
    splitPanel.style.display = 'none';
    splitDropZone.style.display = 'block';
    pageGrid.innerHTML = '';
    renderGroups();
    updateSelectionUI();
});

btnSplit.addEventListener('click', async () => {
    if (!splitFile || !groups.length) { alert('분리할 그룹을 먼저 추가해 주세요.'); return; }
    try {
        btnSplit.classList.add('is-merging');
        btnSplit.disabled = true;
        const srcPdf = await PDFDocument.load(await splitFile.arrayBuffer());
        for (let i = 0; i < groups.length; i++) {
            const doc = await PDFDocument.create();
            const pages = await doc.copyPages(srcPdf, groups[i].pages.map(p => p - 1));
            pages.forEach(p => doc.addPage(p));
            downloadBlob(await doc.save(), `split_${i + 1}.pdf`, 'application/pdf');
            await delay(120);
        }
    } catch (e) {
        alert('PDF 나누기 중 오류가 발생했습니다: ' + e.message);
    } finally {
        btnSplit.classList.remove('is-merging');
        btnSplit.disabled = false;
    }
});

// ─── Utilities ───────────────────────────────────────────────────
function formatBytes(bytes, decimals = 2) {
    if (!bytes) return '0 Bytes';
    const k = 1024, sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function downloadBlob(data, filename, type) {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
