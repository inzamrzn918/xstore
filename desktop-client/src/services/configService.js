const fs = require('fs');
const path = require('path');
const os = require('os');
const { shopConfig, shopSettings } = require('../state/appState');
const { getLocalIP } = require('../utils/network');
const { generateShopID } = require('../utils/formatting');

function getConfigDir() {
    return process.env.APPDATA ? path.join(process.env.APPDATA, 'PrintShare') : path.join(os.homedir(), '.printshare');
}

function loadSettings() {
    try {
        const configDir = getConfigDir();
        const settingsPath = path.join(configDir, 'settings.json');
        if (fs.existsSync(settingsPath)) {
            const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            Object.assign(shopSettings, savedSettings);
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
}

function saveSettings() {
    try {
        const configDir = getConfigDir();
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const settingsPath = path.join(configDir, 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(shopSettings, null, 2));
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

function loadShopConfig() {
    try {
        const configDir = getConfigDir();
        if (!fs.existsSync(configDir)) {
            fs.mkdirSync(configDir, { recursive: true });
        }
        const configPath = path.join(configDir, 'shop-config.json');

        if (fs.existsSync(configPath)) {
            const savedConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            Object.assign(shopConfig, savedConfig);
        } else {
            // Initialize default values
            shopConfig.shopName = 'My Print Shop';
            shopConfig.location = 'Unknown Location';
            shopConfig.shopID = generateShopID();
            shopConfig.port = 8888;
        }

        // Always update IP to current machine IP
        shopConfig.ip = getLocalIP();

    } catch (error) {
        console.error('Error loading shop config:', error);
        shopConfig.shopName = 'My Print Shop';
        shopConfig.shopID = generateShopID();
        shopConfig.ip = getLocalIP();
    }
}

function saveShopConfig() {
    try {
        const configDir = getConfigDir();
        const configPath = path.join(configDir, 'shop-config.json');
        fs.writeFileSync(configPath, JSON.stringify(shopConfig, null, 2));
        console.log('Shop details saved to:', configPath);
    } catch (e) {
        console.error('Error saving shop config:', e);
    }
}

module.exports = {
    loadSettings,
    saveSettings,
    loadShopConfig,
    saveShopConfig,
    getConfigDir
};
