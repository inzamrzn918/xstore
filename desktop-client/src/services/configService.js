const fs = require('fs');
const path = require('path');
const os = require('os');

/**
 * Configuration Service - Handles shop configuration persistence
 */

class ConfigService {
    constructor() {
        this.configPath = this.getConfigPath();
        this.config = {
            shopName: '',
            location: '',
            shopID: '',
            ip: '',
            port: 8888
        };
    }

    getConfigPath() {
        try {
            const appDataPath = process.env.APPDATA ||
                (process.platform === 'darwin' ?
                    process.env.HOME + '/Library/Application Support' :
                    '/var/local');
            const configDir = path.join(appDataPath, 'PrintShare');

            if (!fs.existsSync(configDir)) {
                fs.mkdirSync(configDir, { recursive: true });
            }

            return path.join(configDir, 'config.json');
        } catch (e) {
            const fallbackDir = path.join(os.homedir(), '.printshare');
            if (!fs.existsSync(fallbackDir)) {
                fs.mkdirSync(fallbackDir, { recursive: true });
            }
            return path.join(fallbackDir, 'config.json');
        }
    }

    load() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = fs.readFileSync(this.configPath, 'utf8');
                this.config = { ...this.config, ...JSON.parse(data) };
                console.log('Config loaded from:', this.configPath);
                return this.config;
            }
        } catch (error) {
            console.error('Error loading config:', error);
        }
        return null;
    }

    save(config) {
        try {
            this.config = { ...this.config, ...config };
            fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
            console.log('Config saved to:', this.configPath);
            return true;
        } catch (error) {
            console.error('Error saving config:', error);
            return false;
        }
    }

    get() {
        return this.config;
    }

    update(updates) {
        this.config = { ...this.config, ...updates };
        return this.save(this.config);
    }
}

module.exports = new ConfigService();
