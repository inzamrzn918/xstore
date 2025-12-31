const fs = require('fs');
const path = require('path');
const { memoryStorage, chunkIndex, shopSettings, receivedFiles } = require('../state/appState');
// We need saveReceivedFiles logic here or in configService.
// Actually, saveReceivedFiles is more of a data persistence logic for the app state, fitting in Config or Storage.
// Let's implement active persistence here or import from config. 
// Ah, I put saveSettings/loadSettings in configService, but loadReceivedFiles not yet.
// Let's implement load/save helpers for files here and use them.

function getStorageDir() {
    return process.env.APPDATA ? path.join(process.env.APPDATA, 'PrintShare') : path.join(require('os').homedir(), '.printshare');
}

function storeFile(fileId, fileName, buffer, encrypted, customerID) {
    const MEMORY_THRESHOLD = 20 * 1024 * 1024; // 20MB
    const CHUNK_COUNT = 100;

    if (buffer.length <= MEMORY_THRESHOLD) {
        memoryStorage.set(fileId, buffer);
    } else {
        // Chunk storage
        const chunkSize = Math.ceil(buffer.length / CHUNK_COUNT);
        const chunks = [];
        for (let i = 0; i < CHUNK_COUNT; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, buffer.length);
            if (start >= buffer.length) break;
            chunks.push(buffer.slice(start, end));
        }

        chunkIndex.set(fileId, {
            chunks: chunks,
            totalChunks: chunks.length,
            originalSize: buffer.length
        });
    }
}

function retrieveFile(fileId) {
    if (memoryStorage.has(fileId)) {
        return memoryStorage.get(fileId);
    }

    if (chunkIndex.has(fileId)) {
        const index = chunkIndex.get(fileId);
        return Buffer.concat(index.chunks);
    }

    return null;
}

function deleteStoredFile(fileId) {
    memoryStorage.delete(fileId);
    chunkIndex.delete(fileId);
}

function loadReceivedFiles() {
    // No-op: Persistence disabled
}

function saveSessions() {
    // No-op: Persistence disabled
}

function saveReceivedFilesLogic() {
    // No-op: Data persistence disabled as per user request
}

function getMemoryStats() {
    let memorySize = 0;
    for (const buf of memoryStorage.values()) memorySize += buf.length;

    let chunkedSize = 0;
    for (const idx of chunkIndex.values()) chunkedSize += idx.originalSize;

    return {
        memoryFiles: memoryStorage.size,
        memorySize: memorySize,
        chunkedFiles: chunkIndex.size,
        totalChunks: Array.from(chunkIndex.values()).reduce((sum, i) => sum + i.totalChunks, 0),
        chunkedSize: chunkedSize
    };
}

module.exports = {
    storeFile,
    retrieveFile,
    deleteStoredFile,
    loadReceivedFiles,
    saveReceivedFiles: saveReceivedFilesLogic,
    saveSessions,
    getMemoryStats
};
