const fs = require('fs');
const path = require('path');
const { memoryStorage, chunkIndex, shopSettings, receivedFiles } = require('../state/appState');
// We need saveReceivedFiles logic here or in configService.
// Actually, saveReceivedFiles is more of a data persistence logic for the app state, fitting in Config or Storage.
// Let's implement active persistence here or import from config. 
// Ah, I put saveSettings/loadSettings in configService, but loadReceivedFiles not yet.
// Let's implement load/save helpers for files here and use them.

function getStorageDir() {
    // Determine storage path
    const configDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'PrintShare') : path.join(require('os').homedir(), '.printshare');
    return configDir;
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
            chunks: chunks, // Storing buffers in memory for now, could be improved to disk
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
    try {
        const configDir = getStorageDir();
        const filesPath = path.join(configDir, 'files.json');
        if (fs.existsSync(filesPath)) {
            const savedFiles = JSON.parse(fs.readFileSync(filesPath, 'utf8'));
            // Filter out old files if auto-delete is enabled? 
            // Better to load all and let cleanup logic handle it.
            // We need to update the receivedFiles array in state.
            // Direct assignment or splice
            const { receivedFiles: globalFiles } = require('../state/appState');
            globalFiles.length = 0; // Clear
            globalFiles.push(...savedFiles);
            // Note: In appState.js we exported the array reference but reassigning the variable 'receivedFiles = val' only works if we use the setter.
            // Since we imported the array object via destructuring (if it was exported directly), mutating it is fine. 
            // But appState exports `receivedFiles` getter/setter.
            // Wait, destructured export `const { receivedFiles } = ...` gets the value at that moment if it's a primitive or reference. 
            // Since it's an array, it's a reference. Mutating it via push is fine.
            // But if appState reassigns `receivedFiles = []`, our reference is stale.
            // For now, assume appState initializes it and we mutate.
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

function saveReceivedFilesLogic() {
    try {
        const configDir = getStorageDir();
        const filesPath = path.join(configDir, 'files.json');
        const { receivedFiles } = require('../state/appState');
        // Persist only metadata, not content (content is in memory map)
        fs.writeFileSync(filesPath, JSON.stringify(receivedFiles, null, 2));
    } catch (error) {
        console.error('Error saving files list:', error);
    }
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
    getMemoryStats
};
