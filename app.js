const { PDFDocument } = PDFLib;

const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileListContainer = document.getElementById('file-list');
const actionBar = document.getElementById('action-bar');
const btnMerge = document.getElementById('btn-merge');
const btnClear = document.getElementById('btn-clear');

let uploadedFiles = [];

// Drag and Drop events
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(file => file.type === 'application/pdf');
    handleFiles(files);
});

fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files).filter(file => file.type === 'application/pdf');
    handleFiles(files);
    fileInput.value = ''; // Reset for same file re-upload
});

function handleFiles(files) {
    if (files.length === 0) return;

    files.forEach(file => {
        uploadedFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            file: file,
            name: file.name,
            size: formatBytes(file.size)
        });
    });

    renderFileList();
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function renderFileList() {
    fileListContainer.innerHTML = '';
    
    if (uploadedFiles.length === 0) {
        actionBar.style.display = 'none';
        return;
    }

    actionBar.style.display = 'flex';

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
            </div>
        `;
        fileListContainer.appendChild(item);
    });
}

window.removeFile = (id) => {
    uploadedFiles = uploadedFiles.filter(f => f.id !== id);
    renderFileList();
};

window.moveFile = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= uploadedFiles.length) return;
    
    const temp = uploadedFiles[index];
    uploadedFiles[index] = uploadedFiles[newIndex];
    uploadedFiles[newIndex] = temp;
    
    renderFileList();
};

btnClear.addEventListener('click', () => {
    if (confirm('모든 파일을 삭제하시겠습니까?')) {
        uploadedFiles = [];
        renderFileList();
    }
});

btnMerge.addEventListener('click', async () => {
    if (uploadedFiles.length < 2) {
        alert('최소 2개 이상의 PDF 파일을 추가해 주세요.');
        return;
    }

    try {
        btnMerge.classList.add('is-merging');
        btnMerge.disabled = true;

        const mergedPdf = await PDFDocument.create();

        for (const fileObj of uploadedFiles) {
            const arrayBuffer = await fileObj.file.arrayBuffer();
            const pdf = await PDFDocument.load(arrayBuffer);
            const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
            copiedPages.forEach((page) => mergedPdf.addPage(page));
        }

        const pdfBytes = await mergedPdf.save();
        download(pdfBytes, "merged_document.pdf", "application/pdf");

        btnMerge.classList.remove('is-merging');
        btnMerge.disabled = false;
    } catch (error) {
        console.error('Error merging PDFs:', error);
        alert('PDF 병합 중 오류가 발생했습니다: ' + error.message);
        btnMerge.classList.remove('is-merging');
        btnMerge.disabled = false;
    }
});

function download(data, filename, type) {
    const file = new Blob([data], { type: type });
    const a = document.createElement("a");
    const url = URL.createObjectURL(file);
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}
