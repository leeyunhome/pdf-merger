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
const splitDropZone = document.getElementById('split-drop-zone');
const splitFileInput = document.getElementById('split-file-input');
const splitPanel = document.getElementById('split-panel');
const btnSplit = document.getElementById('btn-split');
const btnSplitReset = document.getElementById('btn-split-reset');
const rangesInput = document.getElementById('split-ranges-input');
const rangeTags = document.getElementById('range-tags');

let splitFile = null;
let splitPageCount = 0;
let parsedRanges = [];

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
    try {
        const pdf = await PDFDocument.load(await file.arrayBuffer());
        splitFile = file;
        splitPageCount = pdf.getPageCount();
        document.getElementById('split-file-name').textContent = file.name;
        document.getElementById('split-page-count').textContent = `총 ${splitPageCount}페이지`;
        splitPanel.style.display = 'block';
        splitDropZone.style.display = 'none';
        parsedRanges = [];
        renderRangeTags();
    } catch (e) {
        alert('PDF를 불러오는 중 오류가 발생했습니다: ' + e.message);
    }
}

btnSplitReset.addEventListener('click', () => {
    splitFile = null;
    splitPageCount = 0;
    parsedRanges = [];
    splitPanel.style.display = 'none';
    splitDropZone.style.display = 'block';
    rangesInput.value = '';
    renderRangeTags();
});

document.getElementById('btn-add-range').addEventListener('click', () => {
    addRangeFromInput();
});

rangesInput.addEventListener('keydown', e => { if (e.key === 'Enter') addRangeFromInput(); });

function addRangeFromInput() {
    const raw = rangesInput.value.trim();
    if (!raw) return;
    const segments = raw.split(',').map(s => s.trim()).filter(Boolean);
    for (const seg of segments) {
        const range = parseRange(seg);
        if (!range) { alert(`잘못된 범위입니다: "${seg}"\n예시: 1-3 또는 5`); return; }
        if (range.from > splitPageCount || range.to > splitPageCount) {
            alert(`페이지 범위가 초과되었습니다. 총 ${splitPageCount}페이지입니다.`); return;
        }
        parsedRanges.push({ label: seg, from: range.from, to: range.to });
    }
    rangesInput.value = '';
    renderRangeTags();
}

function parseRange(str) {
    const single = /^(\d+)$/.exec(str);
    if (single) { const n = parseInt(single[1]); return n >= 1 ? { from: n, to: n } : null; }
    const range = /^(\d+)-(\d+)$/.exec(str);
    if (range) { const [, a, b] = range.map(Number); return a >= 1 && b >= a ? { from: a, to: b } : null; }
    return null;
}

function renderRangeTags() {
    rangeTags.innerHTML = '';
    parsedRanges.forEach((r, i) => {
        const tag = document.createElement('span');
        tag.className = 'range-tag';
        tag.innerHTML = `${r.label} <button onclick="removeRange(${i})">✕</button>`;
        rangeTags.appendChild(tag);
    });
}

window.removeRange = i => { parsedRanges.splice(i, 1); renderRangeTags(); };

btnSplit.addEventListener('click', async () => {
    if (!splitFile) return;
    const mode = document.querySelector('input[name="split-mode"]:checked').value;

    try {
        btnSplit.classList.add('is-merging');
        btnSplit.disabled = true;

        const srcPdf = await PDFDocument.load(await splitFile.arrayBuffer());

        if (mode === 'all') {
            for (let i = 0; i < splitPageCount; i++) {
                const doc = await PDFDocument.create();
                const [page] = await doc.copyPages(srcPdf, [i]);
                doc.addPage(page);
                downloadBlob(await doc.save(), `page_${i + 1}.pdf`, 'application/pdf');
                await delay(100);
            }
        } else {
            if (!parsedRanges.length) { alert('범위를 하나 이상 추가해 주세요.'); return; }
            for (let i = 0; i < parsedRanges.length; i++) {
                const { label, from, to } = parsedRanges[i];
                const doc = await PDFDocument.create();
                const indices = Array.from({ length: to - from + 1 }, (_, k) => from - 1 + k);
                const pages = await doc.copyPages(srcPdf, indices);
                pages.forEach(p => doc.addPage(p));
                const safeName = label.replace(/\s/g, '');
                downloadBlob(await doc.save(), `split_p${safeName}.pdf`, 'application/pdf');
                await delay(100);
            }
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
