const http = require('http');
const path = require('path');
const fs = require('fs');
const Busboy = require('busboy');
const appStateModule = require('../state/appState');
const QRCode = require('qrcode');
const {
    shopConfig,
    shopSettings,
    activeSessions,
    receivedFiles,
    clientFiles
} = appStateModule;

const { storeFile } = require('./storageService');
const { updateFilesList, displayClientFiles, updateStats } = require('../ui/fileManagerUI');
const { updateClientsListUI } = require('../ui/clientManagerUI');

let httpServer = null;
let isTunnelling = false;
let publicTunnelURL = null;
let tunnelProcess = null; // Store the cloudflared process

/* ========================== UI HELPERS ========================== */

function updateStatus(text, color = '#10b981') {
    const el = document.getElementById('statusText');
    const dot = document.querySelector('.status-dot');
    if (el) el.textContent = text;
    if (dot) dot.style.background = color;
}

function notify(msg, color = '#10b981') {
    console.log('[Notify]', msg);
    updateStatus(msg, color);
    setTimeout(() => updateStatus('Ready to Receive', '#10b981'), 3000);
}

/* ========================== HTTP SERVER ========================== */

function startHTTPServer() {
    if (httpServer) return;

    try {
        httpServer = http.createServer(handleRequest);

        // Handle PORT IN USE errors gracefully
        httpServer.on('error', (e) => {
            if (e.code === 'EADDRINUSE') {
                console.error(`[Server] Port ${shopConfig.port} is already in use.`);
                updateStatus(`Error: Port ${shopConfig.port} in use`, '#ef4444');
                alert(`Error: Port ${shopConfig.port} is already in use by another application. Please close other instances of XStore or free up the port and restart.`);
            } else {
                console.error('[Server] Fatal Error:', e);
            }
        });

        httpServer.listen(shopConfig.port, '0.0.0.0', () => {
            console.log(`[Server] Listening at http://${shopConfig.ip}:${shopConfig.port}`);
            updateStatus('Ready to Receive');
            srv_generateShopQR();

            // Re-enabled auto-tunnel on startup with robust named-rescue
            if (shopSettings.publicAccess) {
                startPublicTunnel().catch(err => {
                    console.error('[Tunnel] Startup failed:', err.message);
                });
            }
        });
    } catch (err) {
        console.error('[Server] Startup error:', err);
    }
}

function handleRequest(req, res) {
    setCORS(res);

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const clientIP = req.socket.remoteAddress.replace('::ffff:', '');

    if (shopSettings.blockedIPs.includes(clientIP)) {
        res.writeHead(403);
        return res.end('Access Denied');
    }

    if (url.pathname === '/upload' && req.method === 'POST') {
        return handleFileUpload(req, res);
    }

    if (url.pathname.startsWith('/session')) {
        return handleSession(req, res, url.pathname);
    }

    if (url.pathname === '/info') {
        return sendJSON(res, {
            shopID: shopConfig.shopID,
            shopName: shopConfig.shopName,
            location: shopConfig.location
        });
    }

    if (req.method === 'GET') {
        return serveWebClient(req, res);
    }

    res.writeHead(404);
    res.end('Not Found');
}

function setCORS(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/* ========================== WEB CLIENT ========================== */

function serveWebClient(req, res) {
    let urlPath = req.url.split('?')[0];
    if (urlPath.startsWith('/web')) urlPath = urlPath.slice(4);
    if (!urlPath || urlPath === '/') urlPath = '/index.html';

    const baseDir = path.join(__dirname, '../../web-client');
    const filePath = path.normalize(path.join(baseDir, urlPath));

    if (!filePath.startsWith(baseDir)) {
        res.writeHead(403);
        return res.end();
    }

    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.ico': 'image/x-icon'
    }[path.extname(filePath)] || 'text/plain';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            return res.end('File error');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

/* ========================== FILE UPLOAD ========================== */

function handleFileUpload(req, res) {
    const busboy = Busboy({ headers: req.headers });
    const buffers = [];
    const meta = {};

    busboy.on('field', (k, v) => meta[k] = v);
    busboy.on('file', (name, file, info) => {
        // Capture filename from info if available (Busboy 1.0+)
        if (info && info.filename) meta.fileName = info.filename;
        if (info && info.mimeType) meta.fileType = info.mimeType;

        file.on('data', d => buffers.push(d));
    });

    busboy.on('finish', () => {
        if (!buffers.length) {
            return sendJSON(res, { success: false, error: 'No file' }, 400);
        }

        const data = Buffer.concat(buffers);

        // Extract metadata with fallbacks (Busboy fields OR Headers)
        const customerID = meta.customerID || req.headers['x-customer-id'] || 'guest';
        const senderName = meta.senderName || req.headers['x-sender-name'] || 'Anonymous';
        const deviceInfo = meta.deviceInfo || req.headers['x-device-info'] || 'Unknown';

        const fileObj = {
            id: Date.now().toString(),
            name: meta.fileName || 'Unknown',
            size: data.length,
            type: meta.fileType || 'application/octet-stream',
            timestamp: Date.now(),
            sender: senderName,
            deviceInfo: deviceInfo,
            ip: req.socket.remoteAddress.replace('::ffff:', ''),
            customerID
        };

        storeFile(fileObj.id, fileObj.name, data, false, customerID);
        receivedFiles.unshift(fileObj);

        if (!clientFiles.has(customerID)) clientFiles.set(customerID, []);
        clientFiles.get(customerID).push(fileObj);

        updateFilesList();
        updateStats();
        updateClientsListUI();

        const { selectedClientId } = require('../state/appState');
        if (selectedClientId === customerID) {
            displayClientFiles(customerID);
        }

        notify(`Received: ${fileObj.name}`);
        sendJSON(res, { success: true, fileId: fileObj.id });
    });

    req.pipe(busboy);
}

/* ========================== SESSIONS ========================== */

function handleSession(req, res, path) {
    if (path === '/session/start') return sessionStart(req, res);
    if (path === '/session/heartbeat') return sendJSON(res, { success: true });
    if (path === '/session/end') return sessionEnd(req, res);
    res.writeHead(404).end();
}

function sessionStart(req, res) {
    collectJSON(req, data => {
        const id = data.customerID || `client_${Date.now()}`;

        activeSessions.set(id, {
            lastSeen: Date.now(),
            ip: req.socket.remoteAddress.replace('::ffff:', ''),
            device: data.deviceInfo || 'Unknown'
        });

        if (!clientFiles.has(id)) clientFiles.set(id, []);
        updateClientsListUI();

        sendJSON(res, { success: true });
    });
}

function sessionEnd(req, res) {
    const id = req.headers['x-customer-id'];
    if (id) activeSessions.delete(id);
    updateClientsListUI();
    sendJSON(res, { success: true });
}

/* ========================== PUBLIC TUNNEL (Localtunnel) ========================== */

async function startPublicTunnel() {
    if (isTunnelling) return;
    isTunnelling = true;

    try {
        const port = shopSettings.serverPort || 8888;
        updateStatus('⏳ Starting Cloudflare Tunnel...', '#3b82f6');
        const { bin } = require('cloudflared');
        const { spawn } = require('child_process');

        // Check for Professional Access / Named Tunnel
        if (shopSettings.useCustomDomain && shopSettings.cloudflareToken) {
            console.log('[Tunnel] Starting Permanent Tunnel with Token...');

            // Generate hostname: Custom Hostname Override (Env) OR (ShopID + Master Domain)
            let hostname = process.env.CUSTOM_HOSTNAME;
            if (!hostname && shopSettings.masterDomain) {
                hostname = `${shopConfig.shopID}.${shopSettings.masterDomain}`;
            }

            // If custom hostname is provided or generated, use it for QR immediately
            if (hostname) {
                appStateModule.publicURL = hostname.startsWith('http')
                    ? hostname
                    : `https://${hostname}`;
                srv_updateAllQRDisplays();
            }

            tunnelProcess = spawn(bin, ['tunnel', 'run', '--token', shopSettings.cloudflareToken]);

            tunnelProcess.stdout.on('data', (data) => console.log(`[Tunnel] ${data}`));
            tunnelProcess.stderr.on('data', (data) => {
                const msg = data.toString();
                console.log(`[Tunnel Log] ${msg}`);
            });

            tunnelProcess.on('close', (code) => {
                console.log(`[Tunnel] Process closed with code ${code}`);
                isTunnelling = false;
            });

            updateStatus('Public Access Active', '#10b981');
            return;
        }

        // Ephemeral Tunnel (Default)
        console.log('[Tunnel] Spawning cloudflared for port ' + port);

        // Spawn cloudflared tunnel directly from its bin path
        tunnelProcess = spawn(bin, ['tunnel', '--url', `http://localhost:${port}`]);

        return new Promise((resolve, reject) => {
            let capturedUrl = null;

            tunnelProcess.stderr.on('data', (data) => {
                const line = data.toString();
                // Look for the .trycloudflare.com URL
                const match = line.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                if (match && !capturedUrl) {
                    capturedUrl = match[0];
                    console.log('[Tunnel] SUCCESS! URL:', capturedUrl);
                    publicTunnelURL = capturedUrl;
                    appStateModule.publicURL = capturedUrl;

                    updateStatus('Public Access Active', '#10b981');
                    srv_updateAllQRDisplays();
                    isTunnelling = false;
                    resolve(capturedUrl);
                }
            });

            tunnelProcess.on('error', (err) => {
                console.error('[Tunnel] Spawn error:', err);
                isTunnelling = false;
                reject(err);
            });

            // Fallback timeout
            setTimeout(() => {
                if (!capturedUrl) {
                    isTunnelling = false;
                    reject(new Error('Tunnel setup timed out'));
                }
            }, 10000);
        });

    } catch (err) {
        console.error('[Tunnel] Cloudflare Error:', err.message);
        notify(`Tunnel Error: ${err.message}`, '#ef4444');
        publicTunnelURL = null;
        appStateModule.publicURL = null;
        srv_updateAllQRDisplays();
        updateStatus('Public Access Error', '#ef4444');
        isTunnelling = false;
    }
}

async function stopPublicTunnel() {
    if (tunnelProcess) {
        try {
            tunnelProcess.kill();
            console.log('[Tunnel] Cloudflare tunnel stopped');
        } catch (err) {
            console.error('[Tunnel] Kill error:', err);
        }
    }
    tunnelProcess = null;
    publicTunnelURL = null;
    appStateModule.publicURL = null;
    updateStatus('Public Access Stopped', '#64748b');
    require('../ui/settingsUI').updateWebClientURL('');
    srv_updateAllQRDisplays();
}

/* ========================== QR CODE ========================== */

function srv_updateAllQRDisplays() {
    srv_generateShopQR();
    // Use dynamic require to avoid circular dependency at top level
    const settingsUI = require('../ui/settingsUI');
    if (settingsUI && settingsUI.generateQRInSettings) {
        settingsUI.generateQRInSettings();
    }
}

function srv_generateShopQR() {
    const canvas = document.getElementById('shopQRCode');
    if (!canvas) return;

    // Use Public URL if enabled AND connected, otherwise Local
    const usePublic = shopSettings.publicAccess && appStateModule.publicURL;
    const baseURL = usePublic ? appStateModule.publicURL : `http://${shopConfig.ip}:${shopConfig.port}`;
    const qrData = `${baseURL}/web?shop=${shopConfig.shopID}`;

    console.log('[QR] Generating QR. Mode:', usePublic ? 'Public' : 'Local');

    QRCode.toCanvas(canvas, qrData, { width: 200, margin: 1 });

    const link = document.getElementById('webClientLink');
    if (link) {
        link.href = `${baseURL}/web`;
        link.textContent = `${baseURL}/web`;
    }
}

/* ========================== UTIL ========================== */

function sendJSON(res, obj, code = 200) {
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(obj));
}

function collectJSON(req, cb) {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => cb(JSON.parse(body || '{}')));
}

/* ========================== EXPORT ========================== */

module.exports = {
    startHTTPServer,
    startPublicTunnel,
    stopPublicTunnel,
    generateShopQR: srv_generateShopQR,
    updateAllQRDisplays: srv_updateAllQRDisplays,
    showNotification: notify
};
