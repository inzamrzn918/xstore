const http = require('http');
const Busboy = require('busboy');
const fs = require('fs');
const path = require('path');

/**
 * HTTP Server Service - Handles incoming connections and file uploads
 */

class HTTPServerService {
    constructor(config, handlers) {
        this.config = config;
        this.handlers = handlers || {};
        this.server = null;
    }

    start() {
        if (this.server) {
            this.server.close();
        }

        this.server = http.createServer((req, res) => {
            this.handleRequest(req, res);
        });

        this.server.listen(this.config.port, '0.0.0.0', () => {
            console.log(`Server running on ${this.config.ip}:${this.config.port}`);
            if (this.handlers.onStart) {
                this.handlers.onStart();
            }
        });

        this.server.on('error', (error) => {
            console.error('Server error:', error);
            if (error.code === 'EADDRINUSE') {
                this.config.port++;
                this.start();
            }
        });

        return this.server;
    }

    handleRequest(req, res) {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Customer-ID, X-Session-Key');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Route handling
        if (req.method === 'GET' && req.url === '/info') {
            this.handleInfo(req, res);
        } else if (req.method === 'GET' && req.url === '/ping') {
            this.handlePing(req, res);
        } else if (req.method === 'GET' && req.url.startsWith('/web')) {
            this.handleWebClient(req, res);
        } else if (req.method === 'POST' && req.url.startsWith('/upload')) {
            this.handleUpload(req, res);
        } else if (req.method === 'POST' && req.url === '/session/start') {
            this.handleSessionStart(req, res);
        } else if (req.method === 'POST' && req.url === '/session/heartbeat') {
            this.handleSessionHeartbeat(req, res);
        } else if (req.method === 'POST' && req.url === '/session/end') {
            this.handleSessionEnd(req, res);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    }

    handleInfo(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            shopName: this.config.shopName,
            shopID: this.config.shopID,
            location: this.config.location,
            status: 'online'
        }));
    }

    handlePing(req, res) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            type: 'printshare',
            shopName: this.config.shopName,
            shopID: this.config.shopID,
            location: this.config.location,
            status: 'online',
            encryption: true
        }));
    }

    handleUpload(req, res) {
        if (this.handlers.onUpload) {
            this.handlers.onUpload(req, res);
        } else {
            res.writeHead(501);
            res.end('Upload handler not implemented');
        }
    }

    handleSessionStart(req, res) {
        if (this.handlers.onSessionStart) {
            this.handlers.onSessionStart(req, res);
        } else {
            res.writeHead(501);
            res.end('Session handler not implemented');
        }
    }

    handleSessionHeartbeat(req, res) {
        if (this.handlers.onSessionHeartbeat) {
            this.handlers.onSessionHeartbeat(req, res);
        } else {
            res.writeHead(501);
            res.end('Heartbeat handler not implemented');
        }
    }

    handleSessionEnd(req, res) {
        if (this.handlers.onSessionEnd) {
            this.handlers.onSessionEnd(req, res);
        } else {
            res.writeHead(501);
            res.end('Session end handler not implemented');
        }
    }

    handleWebClient(req, res) {
        try {
            let filePath;

            // Parse URL
            if (req.url === '/web' || req.url.startsWith('/web?')) {
                // Serve index.html
                filePath = path.join(__dirname, '../../web-client/index.html');
            } else if (req.url.startsWith('/web/assets/')) {
                // Serve static assets
                const assetPath = req.url.replace('/web/assets/', '');
                filePath = path.join(__dirname, '../../web-client', assetPath);
            } else {
                res.writeHead(404);
                res.end('Not found');
                return;
            }

            // Check if file exists
            if (!fs.existsSync(filePath)) {
                res.writeHead(404);
                res.end('File not found');
                return;
            }

            // Determine content type
            const ext = path.extname(filePath).toLowerCase();
            const contentTypes = {
                '.html': 'text/html',
                '.css': 'text/css',
                '.js': 'application/javascript',
                '.json': 'application/json',
                '.png': 'image/png',
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.gif': 'image/gif',
                '.svg': 'image/svg+xml',
                '.ico': 'image/x-icon'
            };

            const contentType = contentTypes[ext] || 'application/octet-stream';

            // Read and serve file
            fs.readFile(filePath, (err, data) => {
                if (err) {
                    res.writeHead(500);
                    res.end('Error reading file');
                    return;
                }

                res.writeHead(200, { 'Content-Type': contentType });
                res.end(data);
            });

        } catch (error) {
            console.error('Web client error:', error);
            res.writeHead(500);
            res.end('Internal server error');
        }
    }

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

module.exports = HTTPServerService;
