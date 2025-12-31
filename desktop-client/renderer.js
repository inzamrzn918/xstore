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
const { shopConfig, shopSettings, selectedClientId } = require('./src/state/appState');
const { loadShopConfig, loadSettings, saveSettings } = require('./src/services/configService');
const { initAutoUpdate } = require('./src/services/autoUpdateService');
const { startHTTPServer, generateShopQR, showNotification } = require('./src/services/serverService');
const { loadReceivedFiles } = require('./src/services/storageService');
const { monitorNetworkChanges } = require('./src/utils/network');

// Import UI Modules
// Import UI Modules
const {
    switchTab,
    showSettings,
    closeSettings,
    updateWebClientURL,
    renderBlockedIPs,
    saveShopDetails,
    saveShopSetup
} = require('./src/ui/settingsUI');
const { updateFilesList, displayClientFiles, updateStats } = require('./src/ui/fileManagerUI');
const { updateClientsListUI, updateClientManagementButtons } = require('./src/ui/clientManagerUI');

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

    if (setting === 'publicAccess') {
        const { startPublicTunnel, stopPublicTunnel } = require('./src/services/serverService');
        const { generateQRInSettings } = require('./src/ui/settingsUI');

        if (value) {
            // Wait for tunnel to connect, then update UI
            startPublicTunnel().then(() => {
                // Refresh settings UI after tunnel connects
                generateQRInSettings();
                // Update status badge
                const statusEl = document.getElementById('publicModeStatus');
                if (statusEl) {
                    const appStateModule = require('./src/state/appState');
                    statusEl.textContent = appStateModule.publicURL ? 'Active (Connected)' : 'Active (Connecting...)';
                }
            }).catch(err => {
                console.error('Failed to start tunnel:', err);
            });
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
    if (setting === 'publicAccess') {
        const value = document.getElementById('publicAccessToggle').checked;
        ipcRenderer.send('update-setting', { key: 'publicAccess', value });
    }
    else shopSettings[setting] = parseInt(value);
    saveSettings();
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
