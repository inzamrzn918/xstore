const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const http = require('http');
const os = require('os');
const QRCode = require('qrcode');
const Busboy = require('busboy');
const CryptoJS = require('crypto-js');

// Shop Configuration
let shopConfig = {
    shopName: '',
    location: '',
    shopID: '',
    ip: '',
    port: 8888
};

// State
let httpServer = null;
let receivedFiles = [];
let currentPreviewFile = null;
let activeSessions = new Map(); // customerID -> { sessionKey, lastSeen, files: [] }
let memoryStorage = new Map(); // fileId -> Buffer (for files < 20MB)
let chunkIndex = new Map(); // fileId -> { chunks: [], totalChunks, originalSize }

// Constants
const MEMORY_THRESHOLD = 20 * 1024 * 1024; // 20MB
const CHUNK_COUNT = 100;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    console.log('PrintShare Shop initialized');
    loadShopConfig();

    // Clean up inactive sessions every 10 seconds
    setInterval(cleanupInactiveSessions, 10000);
});

// Session cleanup
function cleanupInactiveSessions() {
    const now = Date.now();
    const timeout = 30000; // 30 seconds

    for (const [customerID, session] of activeSessions.entries()) {
        if (now - session.lastSeen > timeout) {
            console.log(`Session timeout for ${customerID}`);
            activeSessions.delete(customerID);
            updateFilesList(); // Update UI to show files as locked
            updateStatus('Ready to Receive', '#10b981');
        }
    }
}

// Load shop configuration
function loadShopConfig() {
    try {
        let configPath;

        // Try AppData first
        try {
            const appDataPath = process.env.APPDATA ||
                (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
            configPath = path.join(appDataPath, 'PrintShare', 'config.json');
        } catch (e) {
            configPath = path.join(os.homedir(), '.printshare', 'config.json');
        }

        if (fs.existsSync(configPath)) {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            shopConfig = { ...shopConfig, ...config };
            console.log('Config loaded from:', configPath);
            showMainScreen();
        } else {
            console.log('No config found, showing setup');
            showSetup();
        }
    } catch (error) {
        console.error('Error loading config:', error);
        showSetup();
    }
}

// Save shop configuration
function saveShopSetup() {
    const shopName = document.getElementById('setupShopName').value.trim();
    const location = document.getElementById('setupLocation').value.trim();

    if (!shopName) {
        alert('Please enter shop name');
        return;
    }

    // Generate unique shop ID
    shopConfig.shopName = shopName;
    shopConfig.location = location;
    shopConfig.shopID = generateShopID();
    shopConfig.ip = getLocalIP();

    // Save to file - try multiple locations
    try {
        let configDir;
        let configPath;

        // Try user data directory first (better for Electron apps)
        try {
            const appDataPath = process.env.APPDATA ||
                (process.platform == 'darwin' ? process.env.HOME + '/Library/Application Support' : '/var/local');
            configDir = path.join(appDataPath, 'PrintShare');
        } catch (e) {
            // Fallback to home directory
            configDir = path.join(os.homedir(), '.printshare');
        }

        // Create directory
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }

        configPath = path.join(configDir, 'config.json');
        fs.writeFileSync(configPath, JSON.stringify(shopConfig, null, 2));

        console.log('Config saved to:', configPath);
        showMainScreen();
    } catch (error) {
        console.error('Error saving config:', error);

        // If save fails, still continue but warn user
        alert('Warning: Could not save configuration permanently. Settings will be lost on restart.\n\nError: ' + error.message);

        // Continue anyway with in-memory config
        showMainScreen();
    }
}

// Show setup screen
function showSetup() {
    document.getElementById('setupScreen').style.display = 'flex';
    document.getElementById('mainScreen').style.display = 'none';

    // Pre-fill if exists
    if (shopConfig.shopName) {
        document.getElementById('setupShopName').value = shopConfig.shopName;
        document.getElementById('setupLocation').value = shopConfig.location || '';
    }
}

// Show main screen
function showMainScreen() {
    document.getElementById('setupScreen').style.display = 'none';
    document.getElementById('mainScreen').style.display = 'grid';

    // Update header
    document.getElementById('shopName').textContent = shopConfig.shopName;

    // Display shop info
    document.getElementById('displayShopName').textContent = shopConfig.shopName;
    document.getElementById('displayShopIP').textContent = shopConfig.ip + ':' + shopConfig.port;
    document.getElementById('displayShopID').textContent = shopConfig.shopID;

    // Generate QR code
    generateShopQR();

    // Start HTTP server
    startHTTPServer();

    // Load received files
    loadReceivedFiles();
}

// Generate shop QR code (static, like UPI)
function generateShopQR() {
    // Create connection data
    const connectionData = {
        type: 'printshare',
        version: '1.0',
        shopName: shopConfig.shopName,
        shopID: shopConfig.shopID,
        ip: shopConfig.ip,
        port: shopConfig.port,
        location: shopConfig.location,
        encryption: true,
        timestamp: Date.now()
    };

    // Encode as base64 for custom URL scheme
    const dataString = JSON.stringify(connectionData);
    const base64Data = Buffer.from(dataString).toString('base64');

    // Use custom URL scheme: xstore://connect?data=<base64>
    const qrData = `xstore://connect?data=${base64Data}`;

    const canvas = document.getElementById('shopQRCode');
    QRCode.toCanvas(canvas, qrData, {
        width: 220,
        margin: 2,
        color: {
            dark: '#000000',
            light: '#FFFFFF'
        }
    }, (error) => {
        if (error) console.error('QR generation error:', error);
        else console.log('Shop QR code generated with custom URL scheme');
    });
}

// Start HTTP server to receive files
function startHTTPServer() {
    if (httpServer) {
        httpServer.close();
    }

    httpServer = http.createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Customer-ID, X-Session-Key');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Ping endpoint for discovery
        if (req.method === 'GET' && req.url === '/ping') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                type: 'printshare',
                shopName: shopConfig.shopName,
                shopID: shopConfig.shopID,
                location: shopConfig.location,
                status: 'online',
                encryption: true
            }));
            return;
        }

        // Info endpoint for nearby device discovery
        if (req.method === 'GET' && req.url === '/info') {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                shopName: shopConfig.shopName,
                shopID: shopConfig.shopID,
                location: shopConfig.location,
                status: 'online'
            }));
            return;
        }

        // Session start - customer connects
        if (req.method === 'POST' && req.url === '/session/start') {
            handleSessionStart(req, res);
            return;
        }

        // Session heartbeat - keep session alive
        if (req.method === 'POST' && req.url === '/session/heartbeat') {
            handleSessionHeartbeat(req, res);
            return;
        }

        // Session end - customer disconnects
        if (req.method === 'POST' && req.url === '/session/end') {
            handleSessionEnd(req, res);
            return;
        }

        // Decrypt file - only works if session active
        if (req.method === 'POST' && req.url.startsWith('/decrypt/')) {
            handleDecrypt(req, res);
            return;
        }

        // Handle file upload
        if (req.method === 'POST' && req.url.startsWith('/upload')) {
            handleFileUpload(req, res);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });

    httpServer.listen(shopConfig.port, '0.0.0.0', () => {
        console.log(`Shop server running on ${shopConfig.ip}:${shopConfig.port}`);
        updateStatus('Ready to Receive', '#10b981');
    });

    httpServer.on('error', (error) => {
        console.error('Server error:', error);
        if (error.code === 'EADDRINUSE') {
            shopConfig.port = shopConfig.port + 1;
            startHTTPServer();
        }
    });
}

// Handle file upload from mobile
function handleFileUpload(req, res) {
    try {
        const busboy = Busboy({ headers: req.headers });
        let fileName = 'unknown';
        let fileData = [];
        let fileSize = 0;
        const customerID = req.headers['x-customer-id'] || 'Unknown';
        const encrypted = req.headers['x-encrypted'] === 'true';

        busboy.on('file', (fieldname, file, info) => {
            const { filename, encoding, mimeType } = info;
            fileName = filename || 'unknown';

            console.log(`Receiving ${encrypted ? 'encrypted' : 'plain'} file: ${fileName}`);

            file.on('data', (data) => {
                fileData.push(data);
                fileSize += data.length;
            });

            file.on('end', () => {
                console.log(`File ${fileName} received: ${fileSize} bytes`);
            });
        });

        busboy.on('finish', () => {
            try {
                const buffer = Buffer.concat(fileData);
                const timestamp = Date.now();

                // Store file (memory or chunks)
                const { savePath, storageType } = storeFile(
                    timestamp,
                    fileName,
                    buffer,
                    encrypted,
                    customerID
                );

                // Add to received files
                const fileInfo = {
                    id: timestamp,
                    name: fileName,
                    size: buffer.length,
                    path: savePath,
                    timestamp: new Date().toISOString(),
                    from: customerID,
                    encrypted: encrypted,
                    storageType: storageType,
                    inMemory: storageType === 'memory'
                };

                receivedFiles.unshift(fileInfo);
                saveReceivedFiles();
                updateFilesList();

                // Response
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({
                    success: true,
                    message: 'File received successfully',
                    fileId: timestamp,
                    fileName: fileName,
                    fileSize: buffer.length
                }));

                // Show notification
                showNotification(`New ${encrypted ? 'encrypted ' : ''}file received: ${fileName}`);

            } catch (error) {
                console.error('Save error:', error);
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: error.message }));
            }
        });

        busboy.on('error', (error) => {
            console.error('Busboy error:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ success: false, error: error.message }));
        });

        req.pipe(busboy);

    } catch (error) {
        console.error('Upload error:', error);
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: error.message }));
    }
}

// Storage Helper Functions
function storeFile(fileId, fileName, buffer, encrypted, customerID) {
    const timestamp = fileId;
    let savePath = null;
    let storageType = 'memory';

    if (buffer.length < MEMORY_THRESHOLD) {
        // Store in memory only (< 20MB)
        memoryStorage.set(timestamp, buffer);
        storageType = 'memory';
        console.log(`📦 ${fileName} stored in memory (${formatFileSize(buffer.length)})`);
    } else {
        // Split into chunks (≥ 20MB)
        storageType = 'chunked';
        const chunkSize = Math.ceil(buffer.length / CHUNK_COUNT);
        const chunks = [];

        const chunksDir = path.join(os.homedir(), 'PrintShare', 'chunks', timestamp.toString());
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
        chunkIndex.set(timestamp, {
            chunks: chunks,
            totalChunks: chunks.length,
            originalSize: buffer.length,
            fileName: fileName,
            encrypted: encrypted
        });

        savePath = chunksDir;
        console.log(`📦 ${fileName} split into ${chunks.length} chunks (${formatFileSize(buffer.length)})`);
    }

    return { savePath, storageType };
}

function retrieveFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) return null;

    if (file.storageType === 'memory') {
        // Get from memory
        return memoryStorage.get(fileId);
    } else if (file.storageType === 'chunked') {
        // Reconstruct from chunks
        const index = chunkIndex.get(fileId);
        if (!index) return null;

        const chunks = [];
        for (const chunkInfo of index.chunks) {
            const chunkData = fs.readFileSync(chunkInfo.path);
            chunks.push(chunkData);
        }

        return Buffer.concat(chunks);
    }

    return null;
}

function deleteStoredFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) return;

    if (file.storageType === 'memory') {
        // Remove from memory
        memoryStorage.delete(fileId);
        console.log(`🗑️ Removed ${file.name} from memory`);
    } else if (file.storageType === 'chunked') {
        // Delete chunk directory
        const index = chunkIndex.get(fileId);
        if (index && file.path) {
            try {
                fs.rmSync(file.path, { recursive: true, force: true });
                chunkIndex.delete(fileId);
                console.log(`🗑️ Deleted ${index.totalChunks} chunks for ${file.name}`);
            } catch (error) {
                console.error('Error deleting chunks:', error);
            }
        }
    }
}

// Retrieve file from storage (memory or chunked)
function retrieveFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) {
        console.error('File not found in receivedFiles:', fileId);
        return null;
    }

    if (file.storageType === 'memory') {
        // Try to get buffer - handle both string and number keys
        let buffer = memoryStorage.get(fileId);
        if (!buffer) {
            // Try converting to number if it's a string
            const numericId = typeof fileId === 'string' ? parseInt(fileId) : fileId;
            buffer = memoryStorage.get(numericId);
        }
        if (!buffer) {
            // Try converting to string if it's a number
            const stringId = String(fileId);
            buffer = memoryStorage.get(stringId);
        }
        if (!buffer) {
            console.error('File not found in memoryStorage:', fileId);
            console.log('Available keys in memoryStorage:', Array.from(memoryStorage.keys()));
            console.log('Key types:', Array.from(memoryStorage.keys()).map(k => typeof k));
        }
        return buffer;
    } else if (file.storageType === 'chunked') {
        return retrieveChunkedFile(fileId);
    }

    return null;
}

function getMemoryStats() {
    let totalMemorySize = 0;
    let memoryFileCount = 0;
    let chunkedFileCount = 0;
    let totalChunks = 0;

    receivedFiles.forEach(file => {
        if (file.storageType === 'memory') {
            totalMemorySize += file.size;
            memoryFileCount++;
        } else if (file.storageType === 'chunked') {
            chunkedFileCount++;
            const index = chunkIndex.get(file.id);
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

// Session Management Functions
function handleSessionStart(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
        try {
            const { customerID, sessionKey } = JSON.parse(body);

            activeSessions.set(customerID, {
                sessionKey,
                lastSeen: Date.now(),
                files: []
            });

            console.log(`Session started for ${customerID}`);
            updateStatus(`Customer connected: ${customerID.substring(0, 12)}...`, '#10b981');
            updateFilesList(); // Update UI to show unlocked files

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Session started' }));
        } catch (error) {
            res.writeHead(400);
            res.end(JSON.stringify({ success: false, error: error.message }));
        }
    });
}

function handleSessionHeartbeat(req, res) {
    const customerID = req.headers['x-customer-id'];

    if (activeSessions.has(customerID)) {
        activeSessions.get(customerID).lastSeen = Date.now();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
    } else {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'Session not found' }));
    }
}

function handleSessionEnd(req, res) {
    const customerID = req.headers['x-customer-id'];

    if (activeSessions.has(customerID)) {
        const session = activeSessions.get(customerID);
        console.log(`Session ended for ${customerID}`);
        activeSessions.delete(customerID);
        updateFilesList(); // Update UI to show files as locked
        updateStatus('Ready to Receive', '#10b981');
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
}

function handleDecrypt(req, res) {
    const fileId = req.url.split('/').pop();
    const customerID = req.headers['x-customer-id'];
    const sessionKey = req.headers['x-session-key'];

    if (!activeSessions.has(customerID)) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: 'Session not active - sender must be connected' }));
        return;
    }

    const session = activeSessions.get(customerID);
    if (session.sessionKey !== sessionKey) {
        res.writeHead(403);
        res.end(JSON.stringify({ success: false, error: 'Invalid session key' }));
        return;
    }

    const file = receivedFiles.find(f => f.id == fileId);
    if (!file || !file.encrypted) {
        res.writeHead(404);
        res.end(JSON.stringify({ success: false, error: 'File not found or not encrypted' }));
        return;
    }

    try {
        // Read encrypted file
        const encryptedData = fs.readFileSync(file.path, 'utf8');

        // Decrypt
        const decrypted = CryptoJS.AES.decrypt(encryptedData, sessionKey);
        const decryptedData = decrypted.toString(CryptoJS.enc.Base64);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            success: true,
            data: decryptedData,
            fileName: file.name
        }));
    } catch (error) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: 'Decryption failed' }));
    }
}

// Load received files from storage
function loadReceivedFiles() {
    try {
        const configDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'PrintShare') : path.join(os.homedir(), '.printshare');
        const filesPath = path.join(configDir, 'received_files.json');
        if (fs.existsSync(filesPath)) {
            receivedFiles = JSON.parse(fs.readFileSync(filesPath, 'utf8'));

            // Restore chunk index for chunked files
            receivedFiles.forEach(file => {
                if (file.storageType === 'chunked' && file.path) {
                    try {
                        // Rebuild chunk index from disk
                        const chunksDir = file.path;
                        if (fs.existsSync(chunksDir)) {
                            const chunkFiles = fs.readdirSync(chunksDir)
                                .filter(f => f.startsWith('chunk_') && f.endsWith('.dat'))
                                .sort((a, b) => {
                                    const aNum = parseInt(a.match(/chunk_(\d+)/)[1]);
                                    const bNum = parseInt(b.match(/chunk_(\d+)/)[1]);
                                    return aNum - bNum;
                                });

                            const chunks = chunkFiles.map((chunkFile, index) => {
                                const chunkPath = path.join(chunksDir, chunkFile);
                                const stats = fs.statSync(chunkPath);
                                return {
                                    index: index,
                                    path: chunkPath,
                                    size: stats.size
                                };
                            });

                            chunkIndex.set(file.id, {
                                chunks: chunks,
                                totalChunks: chunks.length,
                                originalSize: file.size,
                                fileName: file.name,
                                encrypted: file.encrypted
                            });

                            console.log(`✅ Restored ${chunks.length} chunks for ${file.name}`);
                        } else {
                            console.warn(`⚠️ Chunk directory not found for ${file.name}, marking as unavailable`);
                            file.unavailable = true;
                        }
                    } catch (error) {
                        console.error(`Error restoring chunks for ${file.name}:`, error);
                        file.unavailable = true;
                    }
                } else if (file.storageType === 'memory') {
                    // Memory files are lost on restart (by design)
                    console.log(`ℹ️ Memory file ${file.name} was cleared (stored in RAM only)`);
                    file.unavailable = true;
                }
            });

            updateFilesList();
            updateStats();
        }
    } catch (error) {
        console.error('Error loading files:', error);
    }
}

// Save received files list
function saveReceivedFiles() {
    try {
        const configDir = process.env.APPDATA ? path.join(process.env.APPDATA, 'PrintShare') : path.join(os.homedir(), '.printshare');
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const filesPath = path.join(configDir, 'received_files.json');
        fs.writeFileSync(filesPath, JSON.stringify(receivedFiles, null, 2));
        updateStats();
    } catch (error) {
        console.error('Error saving files:', error);
    }
}

// Update files list UI
function updateFilesList() {
    const container = document.getElementById('incomingFiles');
    document.getElementById('fileCount').textContent = `${receivedFiles.length} files`;

    if (receivedFiles.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <p>No files received yet</p>
                <p class="empty-subtitle">Files will appear here when customers send them</p>
            </div>
        `;
        return;
    }

    container.innerHTML = receivedFiles.map(file => {
        const isLocked = file.encrypted && !activeSessions.has(file.from);
        const isUnavailable = file.unavailable === true;
        const lockIcon = isLocked ? '🔒' : (file.encrypted ? '🔓' : '');
        const unavailableIcon = isUnavailable ? '❌' : '';
        const lockClass = isLocked ? 'file-locked' : (isUnavailable ? 'file-unavailable' : '');

        // Storage indicator
        const storageIcon = file.storageType === 'memory' ? '💾' :
            file.storageType === 'chunked' ? '📦' : '';
        const storageText = file.storageType === 'memory' ? 'In Memory' :
            file.storageType === 'chunked' ? chunkIndex.get(file.id)?.totalChunks + ' chunks' : '';

        return `
        <div class="file-item ${lockClass}" onclick="previewFile('${file.id}')">
            <div class="file-icon">${unavailableIcon || lockIcon || getFileIcon(file.name)}</div>
            <div class="file-details">
                <div class="file-name">${file.name} ${unavailableIcon} ${lockIcon} ${storageIcon}</div>
                <div class="file-meta">
                    <span>${formatFileSize(file.size)}</span>
                    <span>${formatTime(file.timestamp)}</span>
                    <span>From: ${file.from.substring(0, 15)}...</span>
                    ${isUnavailable ? '<span style="color: #ef4444;">❌ Unavailable</span>' : ''}
                    ${isLocked ? '<span style="color: #ef4444;">🔒 Locked</span>' : ''}
                    ${storageText ? '<span style="color: #6366f1;">' + storageText + '</span>' : ''}
                </div>
            </div>
            <div class="file-actions">
                <button class="icon-btn" onclick="event.stopPropagation(); printFile('${file.id}')" title="${isUnavailable ? 'File unavailable' : isLocked ? 'Locked - sender must be connected' : 'Print'}" ${isLocked || isUnavailable ? 'disabled' : ''}>
                    🖨️
                </button>
                <button class="icon-btn" onclick="event.stopPropagation(); saveFile('${file.id}')" title="${isUnavailable ? 'File unavailable' : isLocked ? 'Locked - sender must be connected' : 'Save As...'}" ${isLocked || isUnavailable ? 'disabled' : ''}>
                    💾
                </button>
                <button class="icon-btn" onclick="event.stopPropagation(); openFile('${file.id}')" title="${isUnavailable ? 'File unavailable' : isLocked ? 'Locked - sender must be connected' : 'Open'}" ${isLocked || isUnavailable ? 'disabled' : ''}>
                    📂
                </button>
                ${['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'].some(ext => file.name.toLowerCase().endsWith(ext)) ? `
                <button class="icon-btn" onclick="event.stopPropagation(); editFile('${file.id}')" title="${isUnavailable ? 'File unavailable' : isLocked ? 'Locked - sender must be connected' : 'Edit Image'}" ${isLocked || isUnavailable ? 'disabled' : ''}>
                    ✏️
                </button>
                ` : ''}
                <button class="icon-btn" onclick="event.stopPropagation(); deleteFile('${file.id}')" title="Delete">
                    🗑️
                </button>
            </div>
        </div>
    `}).join('');
}

// Preview file
function previewFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) return;

    // Check if file is locked
    if (file.encrypted && !activeSessions.has(file.from)) {
        alert('🔒 File is locked!\n\nThis file is encrypted and can only be viewed when the sender is connected.\n\nSender: ' + file.from);
        return;
    }

    currentPreviewFile = file;

    document.getElementById('previewFileName').textContent = file.name;
    document.getElementById('previewSize').textContent = formatFileSize(file.size);
    document.getElementById('previewType').textContent = path.extname(file.name).toUpperCase();
    document.getElementById('previewFrom').textContent = file.from;

    // Show preview based on file type
    const previewContent = document.getElementById('previewContent');
    const ext = path.extname(file.name).toLowerCase();

    if (file.encrypted) {
        previewContent.innerHTML = `<p>🔓 Encrypted File (Unlocked)</p><p style="font-size: 14px; color: #6b7280;">Sender is connected. Click "Accept & Save" to decrypt and open.</p>`;
    } else if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
        // For images, create a data URL from the buffer
        const fileBuffer = retrieveFile(file.id);
        if (fileBuffer) {
            const base64 = fileBuffer.toString('base64');
            const mimeType = ext === '.png' ? 'image/png' :
                ext === '.gif' ? 'image/gif' :
                    ext === '.webp' ? 'image/webp' : 'image/jpeg';
            previewContent.innerHTML = `<img src="data:${mimeType};base64,${base64}" style="max-width: 100%; max-height: 300px; border-radius: 8px;">`;
        } else {
            previewContent.innerHTML = `<p>🖼️ Image Preview Unavailable</p>`;
        }
    } else if (ext === '.pdf') {
        previewContent.innerHTML = `<p>📄 PDF Document</p><p style="font-size: 14px; color: #6b7280;">Click "Accept & Save" to open</p>`;
    } else {
        previewContent.innerHTML = `<p>${getFileIcon(file.name)} ${ext.toUpperCase()} File</p>`;
    }

    document.getElementById('filePreviewModal').style.display = 'flex';
}

function closePreview() {
    document.getElementById('filePreviewModal').style.display = 'none';
    currentPreviewFile = null;
}

function acceptFile() {
    if (currentPreviewFile) {
        openFile(currentPreviewFile.id);
        closePreview();
    }
}

// Open file in default application
function openFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) {
        console.error('File not found:', fileId);
        alert('Error: File not found');
        return;
    }

    console.log('Opening file:', file.name, 'Encrypted:', file.encrypted, 'Storage:', file.storageType);

    // Check if file is unavailable
    if (file.unavailable) {
        const reason = file.storageType === 'memory' ?
            'This file was stored in memory and was cleared when the app restarted.' :
            'The file data is no longer available on disk.';
        alert('❌ File Unavailable\n\n' + reason + '\n\nFile: ' + file.name);
        return;
    }

    // Check if file is locked
    if (file.encrypted && !activeSessions.has(file.from)) {
        alert('🔒 File is locked!\n\nThis file is encrypted and can only be viewed when the sender is connected.\n\nSender: ' + file.from);
        return;
    }

    if (file.encrypted) {
        const storageInfo = file.storageType === 'memory' ? 'in memory' :
            file.storageType === 'chunked' ? 'in ' + chunkIndex.get(file.id).totalChunks + ' chunks' : 'on disk';
        alert('Encrypted file opening requires mobile app integration.\n\nFile is stored ' + storageInfo);
        return;
    }

    // Retrieve file from storage
    console.log('Retrieving file from storage...');
    const fileBuffer = retrieveFile(fileId);
    if (!fileBuffer) {
        console.error('Could not retrieve file buffer for:', fileId);
        console.error('Storage type:', file.storageType);
        console.error('Memory storage has file:', memoryStorage.has(fileId));
        console.error('Chunk index has file:', chunkIndex.has(fileId));
        alert('Error: Could not retrieve file from storage.\n\nStorage type: ' + file.storageType + '\nCheck console for details.');
        return;
    }

    console.log('File retrieved successfully, size:', fileBuffer.length, 'bytes');

    // Create temporary file to open
    const tempPath = path.join(os.tmpdir(), file.name);
    console.log('Writing to temp file:', tempPath);

    try {
        fs.writeFileSync(tempPath, fileBuffer);
        console.log('Temp file written, opening...');
        ipcRenderer.send('open-file', tempPath);

        // Delete temp file after 5 seconds
        setTimeout(() => {
            try {
                fs.unlinkSync(tempPath);
                console.log('Temp file deleted');
            } catch (e) {
                console.error('Error deleting temp file:', e);
            }
        }, 5000);
    } catch (error) {
        console.error('Error writing/opening file:', error);
        alert('Error opening file: ' + error.message);
    }
}

// Edit file in photo editor (for images)
async function editFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) {
        console.error('File not found:', fileId);
        alert('Error: File not found');
        return;
    }

    // Check if file is an image
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const ext = path.extname(file.name).toLowerCase();
    if (!imageExtensions.includes(ext)) {
        alert('Only image files can be edited.\\n\\nSupported formats: JPG, PNG, GIF, BMP, WEBP');
        return;
    }

    // Check if file is unavailable
    if (file.unavailable) {
        const reason = file.storageType === 'memory' ?
            'This file was stored in memory and was cleared when the app restarted.' :
            'The file data is no longer available on disk.';
        alert('❌ File Unavailable\\n\\n' + reason + '\\n\\nFile: ' + file.name);
        return;
    }

    // Check if file is locked
    if (file.encrypted && !activeSessions.has(file.from)) {
        alert('🔒 File is locked!\\n\\nThis file is encrypted and can only be edited when the sender is connected.\\n\\nSender: ' + file.from);
        return;
    }

    // Retrieve file from storage
    console.log('Retrieving file for editing...');
    const fileBuffer = retrieveFile(fileId);
    if (!fileBuffer) {
        console.error('Could not retrieve file buffer for:', fileId);
        alert('Error: Could not retrieve file from storage.');
        return;
    }

    console.log('Opening photo editor for:', file.name);

    try {
        const result = await ipcRenderer.invoke('open-photo-editor', {
            buffer: fileBuffer,
            fileName: file.name
        });

        if (!result.success) {
            alert('Error opening photo editor: ' + (result.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error opening photo editor:', error);
        alert('Error opening photo editor: ' + error.message);
    }
}


// Save file to user-chosen location
async function saveFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) return;

    // Check if file is unavailable
    if (file.unavailable) {
        alert('❌ File Unavailable\n\nThis file is no longer available in storage.');
        return;
    }

    // Check if file is locked
    if (file.encrypted && !activeSessions.has(file.from)) {
        alert('🔒 File is locked!\n\nThis file is encrypted and can only be saved when the sender is connected.');
        return;
    }

    console.log('Saving file:', file.name);

    // Retrieve file from storage
    const fileBuffer = retrieveFile(fileId);
    if (!fileBuffer) {
        alert('Error: Could not retrieve file from storage.');
        return;
    }

    try {
        // Show save dialog
        const result = await ipcRenderer.invoke('save-file', {
            data: fileBuffer.toString('base64'),
            filename: file.name
        });

        if (result.success) {
            console.log('File saved to:', result.path);
            alert('✅ File saved successfully!\n\n' + result.path);
        }
    } catch (error) {
        console.error('Error saving file:', error);
        alert('Error saving file: ' + error.message);
    }
}

// Print file directly without saving
async function printFile(fileId) {
    const file = receivedFiles.find(f => f.id == fileId);
    if (!file) return;

    // Check if file is unavailable
    if (file.unavailable) {
        alert('❌ File Unavailable\n\nThis file is no longer available in storage.');
        return;
    }

    // Check if file is locked
    if (file.encrypted && !activeSessions.has(file.from)) {
        alert('🔒 File is locked!\n\nThis file is encrypted and can only be printed when the sender is connected.');
        return;
    }

    console.log('Printing file:', file.name);

    // Retrieve file from storage
    const fileBuffer = retrieveFile(fileId);
    if (!fileBuffer) {
        alert('Error: Could not retrieve file from storage.');
        return;
    }

    try {
        // Create temporary file for printing
        const tempPath = path.join(os.tmpdir(), `print_${Date.now()}_${file.name}`);
        console.log('Writing to temp file for printing:', tempPath);

        fs.writeFileSync(tempPath, fileBuffer);

        // Get file extension
        const ext = path.extname(file.name).toLowerCase();

        // Check if file type is printable
        const printableTypes = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.txt', '.doc', '.docx', '.xls', '.xlsx'];
        if (!printableTypes.includes(ext)) {
            alert('⚠️ File type may not be directly printable.\n\nFile: ' + file.name + '\n\nTry opening the file first, then print from the application.');
            fs.unlinkSync(tempPath);
            return;
        }

        // Show print dialog
        const result = await ipcRenderer.invoke('print-file', {
            filePath: tempPath,
            fileName: file.name
        });

        if (result.success) {
            console.log('Print dialog shown successfully');
        } else if (result.cancelled) {
            console.log('Print cancelled by user');
        }

        // Clean up temp file after a delay
        setTimeout(() => {
            try {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                    console.log('Print temp file deleted');
                }
            } catch (e) {
                console.error('Error deleting print temp file:', e);
            }
        }, 10000); // 10 seconds delay

    } catch (error) {
        console.error('Error printing file:', error);
        alert('Error printing file: ' + error.message);
    }
}

// Delete file
function deleteFile(fileId) {
    if (!confirm('Delete this file?')) return;

    const index = receivedFiles.findIndex(f => f.id == fileId);
    if (index !== -1) {
        // Delete from storage (memory or chunks)
        deleteStoredFile(fileId);

        // Remove from list
        receivedFiles.splice(index, 1);
        saveReceivedFiles();
        updateFilesList();
    }
}

// Update statistics
function updateStats() {
    const totalSize = receivedFiles.reduce((sum, f) => sum + f.size, 0);
    const today = new Date().toDateString();
    const todayFiles = receivedFiles.filter(f =>
        new Date(f.timestamp).toDateString() === today
    ).length;

    document.getElementById('totalFiles').textContent = receivedFiles.length;
    document.getElementById('totalSize').textContent = formatFileSize(totalSize);
    document.getElementById('todayFiles').textContent = todayFiles;

    // Log memory stats
    const memStats = getMemoryStats();
    console.log(`📊 Storage Stats:`);
    console.log(`   💾 Memory: ${memStats.memoryFiles} files (${formatFileSize(memStats.memorySize)})`);
    console.log(`   📦 Chunked: ${memStats.chunkedFiles} files (${memStats.totalChunks} chunks)`);
}

// Utility functions
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}

function generateShopID() {
    return 'SHOP-' + Math.random().toString(36).substring(2, 10).toUpperCase();
}

function getFileIcon(fileName) {
    const ext = path.extname(fileName).toLowerCase();
    const icons = {
        '.pdf': '📄',
        '.doc': '📝', '.docx': '📝',
        '.xls': '📊', '.xlsx': '📊',
        '.jpg': '🖼️', '.jpeg': '🖼️', '.png': '🖼️', '.gif': '🖼️',
        '.zip': '🗜️', '.rar': '🗜️',
        '.txt': '📃'
    };
    return icons[ext] || '📎';
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return date.toLocaleDateString();
}

function updateStatus(text, color = '#10b981') {
    document.getElementById('statusText').textContent = text;
    document.querySelector('.status-dot').style.background = color;
}

function showNotification(message) {
    console.log('Notification:', message);
    updateStatus(message, '#10b981');
    setTimeout(() => updateStatus('Ready to Receive', '#10b981'), 3000);
}
