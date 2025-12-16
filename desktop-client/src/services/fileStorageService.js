const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * File Storage Service - Handles file storage (memory and chunked)
 */

const MEMORY_THRESHOLD = 20 * 1024 * 1024; // 20MB
const CHUNK_COUNT = 100;

class FileStorageService {
    constructor() {
        this.memoryStorage = new Map();
        this.chunkIndex = new Map();
        this.receivedFiles = [];
    }

    storeFile(fileId, fileName, buffer, encrypted, customerID) {
        let savePath = null;
        let storageType = 'memory';

        if (buffer.length < MEMORY_THRESHOLD) {
            // Store in memory (<20MB)
            this.memoryStorage.set(fileId, buffer);
            storageType = 'memory';
            console.log(`📦 ${fileName} stored in memory (${this.formatFileSize(buffer.length)})`);
        } else {
            // Split into chunks (≥20MB)
            storageType = 'chunked';
            savePath = this.storeChunked(fileId, fileName, buffer, encrypted);
            console.log(`📦 ${fileName} split into chunks (${this.formatFileSize(buffer.length)})`);
        }

        return { savePath, storageType };
    }

    storeChunked(fileId, fileName, buffer, encrypted) {
        const chunkSize = Math.ceil(buffer.length / CHUNK_COUNT);
        const chunks = [];

        const chunksDir = path.join(os.homedir(), 'PrintShare', 'chunks', fileId.toString());
        if (!fs.existsSync(chunksDir)) {
            fs.mkdirSync(chunksDir, { recursive: true });
        }

        // Split and save each chunk
        for (let i = 0; i < CHUNK_COUNT; i++) {
            const start = i * chunkSize;
            const end = Math.min(start + chunkSize, buffer.length);
            const chunk = buffer.slice(start, end);

            if (chunk.length > 0) {
                const chunkData = encrypted ? chunk.toString('utf8') : chunk;
                const chunkPath = path.join(chunksDir, `chunk_${i}.dat`);
                fs.writeFileSync(chunkPath, chunkData);

                chunks.push({
                    index: i,
                    path: chunkPath,
                    size: chunk.length
                });
            }
        }

        // Store chunk index
        this.chunkIndex.set(fileId, {
            chunks: chunks,
            totalChunks: chunks.length,
            originalSize: buffer.length,
            fileName: fileName,
            encrypted: encrypted
        });

        return chunksDir;
    }

    retrieveFile(fileId) {
        const file = this.receivedFiles.find(f => f.id == fileId);
        if (!file) return null;

        if (file.storageType === 'memory') {
            return this.memoryStorage.get(fileId);
        } else if (file.storageType === 'chunked') {
            return this.retrieveChunked(fileId);
        }

        return null;
    }

    retrieveChunked(fileId) {
        const index = this.chunkIndex.get(fileId);
        if (!index) return null;

        const chunks = [];
        for (const chunkInfo of index.chunks) {
            const chunkData = fs.readFileSync(chunkInfo.path);
            chunks.push(chunkData);
        }

        return Buffer.concat(chunks);
    }

    deleteFile(fileId) {
        const file = this.receivedFiles.find(f => f.id == fileId);
        if (!file) return;

        if (file.storageType === 'memory') {
            this.memoryStorage.delete(fileId);
            console.log(`🗑️ Removed ${file.name} from memory`);
        } else if (file.storageType === 'chunked') {
            const index = this.chunkIndex.get(fileId);
            if (index && file.path) {
                try {
                    fs.rmSync(file.path, { recursive: true, force: true });
                    this.chunkIndex.delete(fileId);
                    console.log(`🗑️ Deleted ${index.totalChunks} chunks for ${file.name}`);
                } catch (error) {
                    console.error('Error deleting chunks:', error);
                }
            }
        }
    }

    getStats() {
        let totalMemorySize = 0;
        let memoryFileCount = 0;
        let chunkedFileCount = 0;
        let totalChunks = 0;

        this.receivedFiles.forEach(file => {
            if (file.storageType === 'memory') {
                totalMemorySize += file.size;
                memoryFileCount++;
            } else if (file.storageType === 'chunked') {
                chunkedFileCount++;
                const index = this.chunkIndex.get(file.id);
                if (index) totalChunks += index.totalChunks;
            }
        });

        return {
            memoryFiles: memoryFileCount,
            memorySize: totalMemorySize,
            chunkedFiles: chunkedFileCount,
            totalChunks: totalChunks
        };
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    setReceivedFiles(files) {
        this.receivedFiles = files;
    }

    getReceivedFiles() {
        return this.receivedFiles;
    }
}

module.exports = new FileStorageService();
