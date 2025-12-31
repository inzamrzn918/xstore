const { clientFiles, activeSessions, selectedClientId, shopSettings } = require('../state/appState');
const { formatTime } = require('../utils/formatting');

function updateClientsListUI() {
    const clientListEl = document.getElementById('clientsList');
    const onlineBadgeEl = document.getElementById('clientCount');
    if (!clientListEl) return;

    const clients = Array.from(clientFiles.keys());
    const onlineCount = activeSessions.size;

    // Update the "0 online" badge
    if (onlineBadgeEl) {
        onlineBadgeEl.textContent = `${onlineCount} online`;
    }

    if (clients.length === 0) {
        clientListEl.innerHTML = '<div class="empty-state">No clients connected</div>';
        return;
    }

    clientListEl.innerHTML = clients.map(clientId => {
        const session = activeSessions.get(clientId);
        const files = clientFiles.get(clientId) || [];
        const isOnline = !!session;
        const lastSeen = session ? session.lastSeen : (files[0] ? files[0].timestamp : Date.now());
        const isSelected = clientId === selectedClientId;

        // Better name resolution
        let clientName = clientId.startsWith('WEB-') ? 'Web Client' : clientId.substring(0, 8);
        let deviceType = 'Unknown Device';

        if (session && session.device) {
            deviceType = session.device;
            clientName = session.device; // Use device name as primary label if online
        } else if (files.length > 0) {
            clientName = files[0].sender || clientName;
            deviceType = files[0].deviceInfo || deviceType;
        }

        return `
            <div class="client-item ${isSelected ? 'selected' : ''}" onclick="selectClient('${clientId}')">
                <div class="client-avatar">${deviceType.toLowerCase().includes('mobile') || deviceType.toLowerCase().includes('phone') || deviceType.toLowerCase().includes('android') ? '📱' : '💻'}</div>
                <div class="client-info">
                    <div class="client-name" title="${clientId}">${clientName}</div>
                    <div class="client-status">
                        <span class="status-indicator ${isOnline ? 'online' : 'offline'}"></span>
                        ${isOnline ? 'Online' : formatTime(lastSeen)}
                    </div>
                </div>
                <div class="client-meta">
                    <div class="file-count-badge">${files.length}</div>
                </div>
            </div>
        `;
    }).join('');
}

function updateClientManagementButtons(clientId) {
    const btnDisconnect = document.getElementById('btnDisconnect');
    const btnBlock = document.getElementById('btnBlock');

    if (!btnDisconnect || !btnBlock) return;

    if (!clientId) {
        btnDisconnect.disabled = true;
        btnBlock.disabled = true;
        return;
    }

    const session = activeSessions.get(clientId);
    const files = clientFiles.get(clientId) || [];
    const clientIP = session ? session.ip : (files[0] ? files[0].ip : null);
    const isBlocked = clientIP && shopSettings.blockedIPs.includes(clientIP);

    btnDisconnect.disabled = !session;
    btnBlock.disabled = !clientIP;

    btnBlock.innerHTML = isBlocked ? '🔓' : '🚫';
    btnBlock.title = isBlocked ? 'Unblock IP' : 'Block IP';
}

function disconnectSelectedClient() {
    const { selectedClientId, activeSessions } = require('../state/appState');
    if (!selectedClientId) return;

    const session = activeSessions.get(selectedClientId);
    if (!session) return;

    if (confirm(`Disconnect ${session.device || 'this client'}?`)) {
        activeSessions.delete(selectedClientId);
        updateClientsListUI();
        updateClientManagementButtons(null);

        const { showNotification } = require('../services/serverService');
        showNotification('Client disconnected');
    }
}

function blockSelectedClient() {
    const { selectedClientId, activeSessions, clientFiles, shopSettings } = require('../state/appState');
    const { saveSettings } = require('../services/configService');
    const { showNotification } = require('../services/serverService');

    if (!selectedClientId) return;

    const session = activeSessions.get(selectedClientId);
    const files = clientFiles.get(selectedClientId) || [];
    const clientIP = session ? session.ip : (files[0] ? files[0].ip : null);

    if (!clientIP) {
        showNotification('Cannot identify client IP', '#ef4444');
        return;
    }

    const isBlocked = shopSettings.blockedIPs.includes(clientIP);

    if (isBlocked) {
        shopSettings.blockedIPs = shopSettings.blockedIPs.filter(ip => ip !== clientIP);
        showNotification('IP Unblocked');
    } else {
        if (confirm(`Block IP address ${clientIP}? This will disconnect the client.`)) {
            shopSettings.blockedIPs.push(clientIP);
            activeSessions.delete(selectedClientId); // Auto-disconnect
            showNotification('IP Blocked', '#ef4444');
        }
    }

    saveSettings();
    updateClientsListUI();
    updateClientManagementButtons(selectedClientId);

    // Refresh blocked list in settings if open
    const settingsUI = require('./settingsUI');
    if (settingsUI && settingsUI.renderBlockedIPs) {
        settingsUI.renderBlockedIPs();
    }
}

function addManualBlock() {
    const input = document.getElementById('manualBlockIP');
    const ip = input?.value.trim();
    if (!ip) return;

    const { shopSettings } = require('../state/appState');
    const { saveSettings } = require('../services/configService');
    const { showNotification } = require('../services/serverService');

    if (shopSettings.blockedIPs.includes(ip)) {
        showNotification('IP already blocked');
        return;
    }

    shopSettings.blockedIPs.push(ip);
    saveSettings();

    if (input) input.value = '';

    const settingsUI = require('./settingsUI');
    if (settingsUI && settingsUI.renderBlockedIPs) {
        settingsUI.renderBlockedIPs();
    }

    showNotification(`Blocked: ${ip}`, '#ef4444');
}

module.exports = {
    updateClientsListUI,
    updateClientManagementButtons,
    disconnectSelectedClient,
    blockSelectedClient,
    addManualBlock
};
