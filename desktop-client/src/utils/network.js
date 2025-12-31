const os = require('os');
const { shopConfig, shopSettings, publicTunnel } = require('../state/appState');
// Note: 'generateShopQR' and 'showNotification' need to be passed in or handled via events 
// because of circular dependencies if we imported UI/Server modules here.
// Instead, we export the logic and let the main controller (renderer.js) bind the callbacks.

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

async function fetchPublicIP() {
    try {
        // Try loca.lt first
        const response = await fetch('https://loca.lt/mytunnelpassword');
        if (!response.ok) throw new Error('Official IP check failed');

        const ip = (await response.text()).trim();

        if (!/^[0-9a-fA-F:.]+$/.test(ip)) {
            throw new Error('Received invalid IP format from official source');
        }
        return ip;
    } catch (officialError) {
        console.warn('Official IP source failed, trying ipify fallback:', officialError.message);
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            if (!response.ok) throw new Error('Network response was not ok');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            console.error('Error fetching public IP:', error.message);
            return null;
        }
    }
}

function monitorNetworkChanges(callbacks) {
    const { onNetworkChange } = callbacks || {};
    let currentIP = shopConfig.ip || getLocalIP();

    // Check every 5 seconds
    setInterval(() => {
        const newIP = getLocalIP();
        if (newIP !== currentIP && newIP !== 'localhost') {
            console.log(`Network change detected: ${currentIP} -> ${newIP}`);
            currentIP = newIP;
            shopConfig.ip = newIP;

            if (onNetworkChange) {
                onNetworkChange(newIP);
            }
        }
    }, 5000);
}

module.exports = {
    getLocalIP,
    fetchPublicIP,
    monitorNetworkChanges
};
