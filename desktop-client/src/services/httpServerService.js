const http = require('http');
const Busboy = require('busboy');

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

    stop() {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}

module.exports = HTTPServerService;
