const { receivedFiles, clientFiles, selectedClientId, activeSessions } = require('../state/appState');
const { formatFileSize, formatTime, getFileIcon } = require('../utils/formatting');

function updateFilesList() {
    // If using the new client-based view, delegate
    if (document.getElementById('chatViewPanel')) {
        // logic routed via client selection
        // If no client selected, maybe show recent?
    }
    // Update dashboard stats
    updateStats();
}

function displayClientFiles(clientId) {
    const list = document.getElementById('filesList'); // This is the chat message area
    const clientNameEl = document.getElementById('selectedClientName');
    const clientMetaEl = document.getElementById('selectedClientMeta');

    // Robust session lookup to avoid ReferenceError
    const state = require('../state/appState');
    const sessions = state.activeSessions || activeSessions || new Map();

    if (!clientId || !clientFiles.has(clientId)) {
        if (list) list.innerHTML = '<div class="empty-state">Select a client to view files</div>';
        if (clientNameEl) clientNameEl.textContent = 'Select a Client';
        if (clientMetaEl) clientMetaEl.textContent = '';
        return;
    }

    const files = clientFiles.get(clientId);

    // Update Header
    if (clientNameEl) {
        const session = sessions.get(clientId);
        const name = files[0]?.sender || clientId.substring(0, 8);
        clientNameEl.textContent = name;

        if (clientMetaEl) {
            clientMetaEl.textContent = session ? 'Online' : 'Offline';
        }
    }

    if (list) {
        if (files.length === 0) {
            list.innerHTML = '<div class="empty-state">No files received from this client</div>';
            return;
        }

        list.innerHTML = files.map(file => `
            <div class="chat-message-file" onclick="previewFile('${file.id}')">
                <div class="file-icon">${getFileIcon(file.name)}</div>
                <div class="file-details">
                    <div class="file-name">${file.name}</div>
                    <div class="file-meta">${formatFileSize(file.size)} • ${formatTime(file.timestamp)}</div>
                </div>
                <div class="file-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); previewFile('${file.id}')" title="Preview">👁️</button>
                    ${['.jpg', '.jpeg', '.png'].some(ext => file.name.toLowerCase().endsWith(ext)) ?
                `<button class="btn-icon" onclick="event.stopPropagation(); editImage('${file.id}')" title="Edit">✏️</button>` : ''}
                    <button class="btn-icon" onclick="event.stopPropagation(); downloadFile('${file.id}')" title="Save">💾</button>
                    ${['.pdf', '.jpg', '.jpeg', '.png', '.txt'].some(ext => file.name.toLowerCase().endsWith(ext)) ?
                `<button class="btn-icon" onclick="event.stopPropagation(); printFile('${file.id}')" title="Print">🖨️</button>` : ''}
                    <button class="btn-icon" onclick="event.stopPropagation(); deleteFile('${file.id}')" title="Delete">🗑️</button>
                </div>
            </div>
        `).join('');
    }
}

function updateStats() {
    const totalSize = receivedFiles.reduce((sum, f) => sum + f.size, 0);
    const today = new Date().toDateString();
    const todayFiles = receivedFiles.filter(f => new Date(f.timestamp).toDateString() === today).length;

    const elTotal = document.getElementById('totalFiles');
    const elSize = document.getElementById('totalSize');
    const elToday = document.getElementById('todayFiles');

    if (elTotal) elTotal.textContent = receivedFiles.length;
    if (elSize) elSize.textContent = formatFileSize(totalSize);
    if (elToday) elToday.textContent = todayFiles;
}

function previewFile(fileId) {
    const { receivedFiles } = require('../state/appState');
    const { retrieveFile } = require('../services/storageService');
    const { ipcRenderer } = require('electron');

    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) return;

    const content = retrieveFile(fileId);
    if (!content) {
        alert('File content not found in memory');
        return;
    }

    const blob = new Blob([content], { type: file.type });
    const url = URL.createObjectURL(blob);

    // Open PDFs in dedicated window
    if (file.type === 'application/pdf') {
        ipcRenderer.invoke('open-pdf-window', {
            pdfUrl: url,
            fileName: file.name
        });
        return;
    }

    // Use modal for images and other types
    const modal = document.getElementById('filePreviewModal');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.style.display = 'flex';

    const container = document.getElementById('previewContent');
    if (container) {
        container.innerHTML = '';
        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.src = url;
            img.classList.add('preview-image');
            container.appendChild(img);
        } else {
            container.innerHTML = `
                <div class="no-preview">
                    <div class="empty-icon">📂</div>
                    <p>No preview available for this file type</p>
                    <p class="empty-subtitle">${file.name}</p>
                </div>`;
        }
    }

    // Update info labels
    const sizeEl = document.getElementById('previewSize');
    const typeEl = document.getElementById('previewType');
    const fromEl = document.getElementById('previewFrom');
    const nameEl = document.getElementById('previewFileName');

    if (sizeEl) sizeEl.textContent = formatFileSize(file.size);
    if (typeEl) typeEl.textContent = file.type;
    if (fromEl) fromEl.textContent = file.sender;
    if (nameEl) nameEl.textContent = file.name;

    require('../state/appState').currentPreviewFile = { ...file, url };
}

function closePreview() {
    const modal = document.getElementById('filePreviewModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
    }

    const state = require('../state/appState');
    if (state.currentPreviewFile && state.currentPreviewFile.url) {
        URL.revokeObjectURL(state.currentPreviewFile.url);
    }
    state.currentPreviewFile = null;
}

function acceptFile() {
    const { currentPreviewFile } = require('../state/appState');
    if (!currentPreviewFile) return;

    // Create a virtual download link
    const link = document.createElement('a');
    link.href = currentPreviewFile.url;
    link.download = currentPreviewFile.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    closePreview();
    const { showNotification } = require('../services/serverService');
    showNotification('File saved successfully');
}

function downloadFile(fileId) {
    const { receivedFiles } = require('../state/appState');
    const { retrieveFile } = require('../services/storageService');
    const { showNotification } = require('../services/serverService');

    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) {
        alert('File not found');
        return;
    }

    const content = retrieveFile(fileId);
    if (!content) {
        alert('File content not found in memory');
        return;
    }

    const blob = new Blob([content], { type: file.type });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showNotification('Download started');
}

async function printFile(fileId) {
    const { receivedFiles } = require('../state/appState');
    const { retrieveFile } = require('../services/storageService');
    const { ipcRenderer } = require('electron');
    const fs = require('fs');
    const path = require('path');
    const os = require('os');

    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) {
        alert('File not found in session');
        return;
    }

    try {
        const content = retrieveFile(fileId);
        if (!content) {
            alert('File content not found in memory. (Files are cleared on app restart)');
            return;
        }

        const tempDir = path.join(os.tmpdir(), 'PrintShareTemp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempPath = path.join(tempDir, file.name);
        fs.writeFileSync(tempPath, content);

        const { showNotification } = require('../services/serverService');
        showNotification('Preparing print...');

        const result = await ipcRenderer.invoke('print-file', {
            filePath: tempPath,
            fileName: file.name
        });

        if (!result.success) {
            alert('Print failed: ' + result.error);
        }
    } catch (error) {
        console.error('Print Error:', error);
        alert('Failed to process file for printing: ' + error.message);
    }
}

function editImage(fileId) {
    const { receivedFiles } = require('../state/appState');
    const { retrieveFile } = require('../services/storageService');
    const { ipcRenderer } = require('electron');

    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) {
        alert('File not found');
        return;
    }

    const content = retrieveFile(fileId);
    if (!content) {
        alert('File content not found in memory');
        return;
    }

    const blob = new Blob([content], { type: file.type });
    const url = URL.createObjectURL(blob);

    ipcRenderer.invoke('open-image-editor', {
        imageUrl: url,
        fileId: file.id,
        fileName: file.name
    });
}

module.exports = {
    updateFilesList,
    displayClientFiles,
    updateStats,
    previewFile,
    closePreview,
    acceptFile,
    downloadFile,
    editImage,
    printFile
};
