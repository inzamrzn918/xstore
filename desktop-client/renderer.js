require('dotenv').config();
const { ipcRenderer } = require('electron');
const path = require('path');

console.log('Renderer process started');

// Immediate Heartbeat to Main
ipcRenderer.send('renderer-ready');

// Helper to log to the disk-based crash.log via Main Process
const logToDisk = (msg) => {
    ipcRenderer.send('log-to-disk', msg);
};

// Global Error Handlers for Diagnostics
window.onerror = (message, source, lineno, colno, error) => {
    const errStr = `[Renderer Error] ${message} at ${source}:${lineno}:${colno}`;
    console.error(errStr, error);
    logToDisk(errStr);
};

window.onunhandledrejection = (event) => {
    const reason = event.reason?.stack || event.reason;
    console.error(' [Renderer] Unhandled Rejection:', reason);
    logToDisk(`[Renderer Rejection] ${reason}`);
};
// alert('Renderer Loaded'); // Debugging

// Import Modules
console.log('[Renderer] Loading appState...');
const { shopConfig, shopSettings, selectedClientId } = require('./src/state/appState');
console.log('[Renderer] Loading configService...');
const { loadShopConfig, loadSettings, saveSettings } = require('./src/services/configService');
console.log('[Renderer] Loading autoUpdateService...');
const { initAutoUpdate } = require('./src/services/autoUpdateService');
console.log('[Renderer] Loading serverService...');
const { startHTTPServer, generateShopQR, showNotification } = require('./src/services/serverService');
console.log('[Renderer] Loading storageService...');
const { loadReceivedFiles } = require('./src/services/storageService');
console.log('[Renderer] Loading network utility...');
const { monitorNetworkChanges } = require('./src/utils/network');

// Import UI Modules
console.log('[Renderer] Loading UI modules...');
const {
    switchTab,
    showSettings,
    closeSettings,
    updateWebClientURL,
    renderBlockedIPs,
    saveShopDetails,
    saveShopSetup
} = require('./src/ui/settingsUI');
console.log('[Renderer] Loading fileManagerUI...');
const { updateFilesList, displayClientFiles, updateStats } = require('./src/ui/fileManagerUI');
console.log('[Renderer] Loading clientManagerUI...');
const { updateClientsListUI, updateClientManagementButtons } = require('./src/ui/clientManagerUI');
console.log('[Renderer] All modules loaded successfully');

// --- Global Event Bindings (Expose to Window immediately) ---
window.switchTab = switchTab;
window.showSettings = showSettings;
window.closeSettings = closeSettings;
window.saveShopDetails = saveShopDetails;
window.saveShopSetup = saveShopSetup;
window.resetSettings = require('./src/ui/settingsUI').resetSettings;

window.toggleSetting = (setting, value) => {
    shopSettings[setting] = value;
    saveSettings();
    console.log('Setting updated:', setting, value);

    if (setting === 'useCustomDomain') {
        const section = document.getElementById('customDomainSection');
        if (section) {
            if (value) section.classList.remove('hidden');
            else section.classList.add('hidden');
        }
        // If public access is already running, we should restart the tunnel to apply changes
        if (shopSettings.publicAccess) {
            const { stopPublicTunnel, startPublicTunnel } = require('./src/services/serverService');
            stopPublicTunnel();
            setTimeout(() => startPublicTunnel(), 500);
        }
    }

    if (setting === 'publicAccess') {
        const { startPublicTunnel, stopPublicTunnel } = require('./src/services/serverService');
        const { generateQRInSettings } = require('./src/ui/settingsUI');

        if (value) {
            startPublicTunnel();
        } else {
            stopPublicTunnel();
            // Refresh settings UI after tunnel stops
            generateQRInSettings();
            const statusEl = document.getElementById('publicModeStatus');
            if (statusEl) {
                statusEl.textContent = 'Disabled';
                statusEl.className = 'status-badge';
            }
        }
    }
};

window.updateSetting = (setting, value) => {
    shopSettings[setting] = value;
    saveSettings();
    console.log('Text setting updated:', setting, value);
};

window.unblockIP = (ip) => {
    shopSettings.blockedIPs = shopSettings.blockedIPs.filter(i => i !== ip);
    saveSettings();
    renderBlockedIPs(); // UI update
    showNotification('Address unblocked');
};

window.previewFile = (fileId) => {
    const { previewFile } = require('./src/ui/fileManagerUI');
    previewFile(fileId);
};

window.closePreview = () => {
    const { closePreview } = require('./src/ui/fileManagerUI');
    closePreview();
};

window.acceptFile = () => {
    const { acceptFile } = require('./src/ui/fileManagerUI');
    acceptFile();
};

window.downloadFile = (fileId) => {
    const { downloadFile } = require('./src/ui/fileManagerUI');
    downloadFile(fileId);
};

window.editImage = (fileId) => {
    const { editImage } = require('./src/ui/fileManagerUI');
    editImage(fileId);
};

window.disconnectSelectedClient = () => {
    const { disconnectSelectedClient } = require('./src/ui/clientManagerUI');
    disconnectSelectedClient();
};

window.blockSelectedClient = () => {
    const { blockSelectedClient } = require('./src/ui/clientManagerUI');
    blockSelectedClient();
};

window.addManualBlock = () => {
    const { addManualBlock } = require('./src/ui/clientManagerUI');
    addManualBlock();
};

window.printFile = (fileId) => {
    const { printFile } = require('./src/ui/fileManagerUI');
    printFile(fileId);
};

window.printPoster = () => {
    const { printPoster } = require('./src/ui/settingsUI');
    printPoster();
};

window.deleteFile = (fileId) => {
    const { deleteStoredFile, saveReceivedFiles } = require('./src/services/storageService');
    const { receivedFiles } = require('./src/state/appState');

    if (!confirm('Delete this file?')) return;
    const index = receivedFiles.findIndex(f => f.id == fileId);
    if (index !== -1) {
        deleteStoredFile(fileId);
        receivedFiles.splice(index, 1);
        saveReceivedFiles(); // Save list
        updateFilesList();
        // update clients UI if needed
        const { selectedClientId } = require('./src/state/appState');
        if (selectedClientId) displayClientFiles(selectedClientId);
    }
};

window.selectClient = (clientId) => {
    require('./src/state/appState').selectedClientId = clientId;
    updateClientsListUI();
    displayClientFiles(clientId);
    updateClientManagementButtons(clientId);

    // Mobile UI handling
    const clientsPanel = document.querySelector('.clients-panel');
    const filesPanel = document.querySelector('.files-panel');
    if (clientsPanel && filesPanel) {
        // Toggle visibility on mobile if needed (common pattern for chat apps)
        // For now, just ensure they exist to avoid crashes
    }
};

window.copyWebURL = () => {
    const url = document.getElementById('settingsWebClientURL').textContent;
    navigator.clipboard.writeText(url).then(() => showNotification('URL Copied'));
};


// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('PrintShare Shop initialized (Modular)');

        // Load Configuration
        loadSettings();
        loadShopConfig();
        loadReceivedFiles(); // Ensure files are loaded

        // Update Shop Name in UI
        const shopNameEl = document.getElementById('shopName');
        if (shopNameEl && shopConfig.shopName) {
            shopNameEl.textContent = shopConfig.shopName;
        }

        // Initialize Auto Update
        const autoUpdateControls = initAutoUpdate({
            updateNotification: document.getElementById('updateNotification'),
            updateMessage: document.getElementById('updateMessage'),
            restartButton: document.getElementById('restartButton')
        });

        // Bind Auto Update Globals
        window.closeUpdateNotification = autoUpdateControls.closeUpdateNotification;
        window.restartApp = autoUpdateControls.restartApp;

        // Start Server
        startHTTPServer();

        // Initial UI Update
        updateFilesList();
        updateClientsListUI();

        // Monitor Network
        monitorNetworkChanges({
            onNetworkChange: (newIP) => {
                const { updateAllQRDisplays } = require('./src/services/serverService');
                updateAllQRDisplays(); // Update all QR displays with new local IP
                showNotification(`Network changed. New IP: ${newIP}`);
            }
        });

        // Initialize Stats Update Interval
        setInterval(updateStats, 5000);

    } catch (error) {
        console.error('Initialization Error:', error);
        alert('Startup Error: ' + error.message);
    }
});
