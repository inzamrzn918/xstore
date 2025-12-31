const QRCode = require('qrcode');
const appStateModule = require('../state/appState');
const { shopConfig, shopSettings, httpServer, publicTunnel } = appStateModule;
const { saveSettings } = require('../services/configService');
// generateShopQR will be required dynamically when needed to avoid circular dependencies
// If generateShopQR depends on Server (address) and UI calls it.
// Use dependency injection or global "App" object.
// For now, let's export the functions and expect the main logic or Server to hook them up, 
// OR define `generateShopQR` in a shared place. 
// Actually `generateShopQR` is UI logic (creates canvas). It needs `shopConfig`.
// Let's implement it here.

function switchTab(tabName, event) {
    document.querySelectorAll('.settings-tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.settings-tab').forEach(tab => tab.classList.remove('active'));

    const tabMap = { 'qr': 'qrTab', 'general': 'generalTab', 'shop': 'shopTab', 'features': 'featuresTab' };
    const tabId = tabMap[tabName];
    if (tabId && document.getElementById(tabId)) {
        document.getElementById(tabId).classList.add('active');
    }

    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    } else {
        const textMap = { 'qr': 'QR Code', 'shop': 'Shop Details', 'general': 'General', 'features': 'Features' };
        document.querySelectorAll('.settings-tab').forEach(btn => {
            if (btn.textContent.trim() === textMap[tabName]) btn.classList.add('active');
        });
    }

    if (tabName === 'qr') {
        setTimeout(generateQRInSettings, 100);
    }
}

function generateQRInSettings() {
    const canvas = document.getElementById('settingsQRCode');
    if (!canvas || !shopConfig.shopID) return;

    // Logic: Use tunnel if enabled AND connected, otherwise local
    const usePublic = shopSettings.publicAccess && appStateModule.publicURL;
    const baseURL = usePublic ? appStateModule.publicURL : `http://${shopConfig.ip}:${shopConfig.port}`;
    const qrData = `${baseURL}/web?shop=${shopConfig.shopID}`;

    console.log('[QR Settings] Generating. Mode:', usePublic ? 'Public' : 'Local');

    const webUrlElement = document.getElementById('settingsWebClientURL');
    if (webUrlElement) {
        webUrlElement.textContent = qrData;
        webUrlElement.href = qrData;
    }

    // Update Shop Name and IP in Settings
    const shopNameDisplay = document.getElementById('settingsDisplayShopName');
    if (shopNameDisplay) shopNameDisplay.textContent = shopConfig.shopName || 'Unknown Shop';

    const shopIPDisplay = document.getElementById('settingsDisplayShopIP');
    if (shopIPDisplay) {
        shopIPDisplay.textContent = baseURL;
        shopIPDisplay.title = usePublic ? 'Connected via public tunnel' : 'Local network only';
    }

    QRCode.toCanvas(canvas, qrData, {
        width: 220,
        margin: 2,
        color: { dark: '#000000', light: '#FFFFFF' }
    }, (error) => {
        if (error) console.error('QR generation error:', error);
        else console.log('[QR Settings] ✅ QR code generated successfully');
    });
}

function showSettings() {
    console.log('showSettings called');
    try {
        require('../services/configService').loadSettings(); // Ensure fresh

        // Fill form
        const ids = {
            'enableWebClient': 'webClient',
            'maxFileSize': 'maxFileSize',
            'autoDeleteHours': 'autoDeleteHours',
            'soundNotifications': 'soundNotifications',
            'desktopNotifications': 'desktopNotifications',
            'sessionTimeout': 'sessionTimeout',
            'enablePublicAccess': 'publicAccess',
            'serverPort': 'serverPort'
        };

        for (const [id, key] of Object.entries(ids)) {
            const el = document.getElementById(id);
            if (!el) continue;
            if (el.type === 'checkbox') el.checked = shopSettings[key];
            else el.value = shopSettings[key] || (key === 'sessionTimeout' ? 5 : '');
        }

        // Public Access Status
        const statusEl = document.getElementById('publicModeStatus');
        if (statusEl) {
            if (shopSettings.publicAccess) {
                statusEl.textContent = appStateModule.publicURL ? 'Active (Connected)' : 'Active (Connecting...)';
                statusEl.className = 'status-badge status-active';
            } else {
                statusEl.textContent = 'Disabled';
                statusEl.className = 'status-badge';
            }
        }

        const shopNameEl = document.getElementById('settingsShopName');
        if (shopNameEl) shopNameEl.value = shopConfig.shopName || '';

        const shopLocEl = document.getElementById('settingsLocation');
        if (shopLocEl) shopLocEl.value = shopConfig.location || '';

        const modal = document.getElementById('settingsModal');
        modal.classList.remove('hidden');
        modal.style.display = 'flex'; // Override initial inline style
        switchTab('qr');
    } catch (error) {
        console.error('Error showing settings:', error);
        alert('Error opening settings: ' + error.message);
    }
}

function closeSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
}

function updateWebClientURL(url) {
    const webUrlElement = document.getElementById('settingsWebClientURL');
    if (webUrlElement) {
        webUrlElement.textContent = url || 'Generating...';
        webUrlElement.href = url || '#';
    }

    // Also update the status badge if it exists
    const statusEl = document.getElementById('publicModeStatus');
    if (statusEl) {
        if (url) {
            statusEl.textContent = 'Active (Connected)';
            statusEl.className = 'status-badge status-active';
        } else if (shopSettings.publicAccess) {
            statusEl.textContent = 'Active (Connecting...)';
            statusEl.className = 'status-badge status-active';
        } else {
            statusEl.textContent = 'Disabled';
            statusEl.className = 'status-badge';
        }
    }

    // Regenerate QR code with the new URL
    generateQRInSettings();
}

function renderBlockedIPs() {
    const list = document.getElementById('blockedIPsList');
    if (!list) return;

    if (!shopSettings.blockedIPs || shopSettings.blockedIPs.length === 0) {
        list.innerHTML = '<li class="blocked-item"><p>No blocked addresses</p></li>';
        return;
    }

    list.innerHTML = shopSettings.blockedIPs.map(ip => `
        <li class="blocked-item">
            <span class="blocked-ip">${ip}</span>
            <button class="btn-remove" data-ip="${ip}" title="Unblock">✕</button>
        </li>
    `).join('');

    // Bind click events for unblock buttons
    list.querySelectorAll('.btn-remove').forEach(btn => {
        btn.onclick = () => window.unblockIP(btn.dataset.ip); // Assuming global function for now
    });
}

function saveShopSetup() {
    const name = document.getElementById('setupShopName').value;
    const location = document.getElementById('setupLocation').value;

    if (name) {
        shopConfig.shopName = name;
        shopConfig.location = location || '';
        require('../services/configService').saveShopConfig();

        document.getElementById('setupScreen').style.display = 'none';
        document.getElementById('mainScreen').style.display = 'block'; // Setup Flex/Grid in CSS? 
        // main-screen class usually handles layout.

        // Init UI
        const shopNameEl = document.getElementById('shopName');
        if (shopNameEl) shopNameEl.textContent = shopConfig.shopName;
        generateQRInSettings();
    } else {
        alert('Please enter a shop name');
    }
}

function saveShopDetails() {
    const name = document.getElementById('settingsShopName').value;
    const location = document.getElementById('settingsLocation').value;

    if (name) shopConfig.shopName = name;
    shopConfig.location = location || '';

    require('../services/configService').saveShopConfig();

    // Update UI
    const shopNameEl = document.getElementById('shopName');
    if (shopNameEl) shopNameEl.textContent = shopConfig.shopName;

    closeSettings();
    showSettings(); // Re-open to refresh or just keep closed? Original code closed it. 
    // Actually better to just generate QR again if needed.
    generateQRInSettings();
}

function resetSettings() {
    if (confirm('Reset all settings to defaults? This will not affect your shop name or files.')) {
        const defaultSettings = {
            webClient: true,
            mobileApp: true,
            maxFileSize: 100,
            autoDeleteHours: 0,
            soundNotifications: true,
            desktopNotifications: false,
            requireSession: true,
            sessionTimeout: 5,
            serverPort: 8888,
            blockedIPs: [],
            publicAccess: false
        };

        const { shopSettings } = appStateModule;
        Object.assign(shopSettings, defaultSettings);

        saveSettings();
        showNotification('Settings reset to defaults');

        // Refresh UI
        closeSettings();
        showSettings();
    }
}

module.exports = {
    switchTab,
    showSettings,
    closeSettings,
    saveShopDetails,
    saveShopSetup,
    updateWebClientURL,
    generateQRInSettings,
    renderBlockedIPs,
    resetSettings
};
