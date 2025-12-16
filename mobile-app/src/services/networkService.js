import axios from 'axios';
import * as Network from 'expo-network';

/**
 * Network Service - Handles device discovery and file transfers
 */

// Get device's local IP address
export const getLocalIP = async () => {
    try {
        const ip = await Network.getIpAddressAsync();
        return ip;
    } catch (error) {
        console.error('Error getting IP:', error);
        throw new Error('Could not get local IP address');
    }
};

// Check if a device is available at given IP:port
export const checkDevice = async (ip, port, timeout = 1000) => {
    try {
        const response = await axios.get(`http://${ip}:${port}/info`, {
            timeout,
        });

        if (response.data && response.data.shopName) {
            return {
                ip,
                port,
                shopName: response.data.shopName,
                shopID: response.data.shopID,
                location: response.data.location,
            };
        }
        return null;
    } catch (error) {
        return null;
    }
};

// Scan for nearby devices on the local network
export const scanNearbyDevices = async (localIP, options = {}) => {
    const {
        scanRange = 10,
        ports = [8888, 8889, 8890, 8891, 8892],
        timeout = 10000,
    } = options;

    if (!localIP) {
        throw new Error('Local IP address is required');
    }

    const ipParts = localIP.split('.');
    const subnet = `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}`;
    const currentDeviceNum = parseInt(ipParts[3]);

    const foundDevices = [];
    const ipsToScan = [];

    // Generate list of IPs to scan
    for (let i = Math.max(1, currentDeviceNum - scanRange);
        i <= Math.min(254, currentDeviceNum + scanRange);
        i++) {
        if (i !== currentDeviceNum) {
            ipsToScan.push(`${subnet}.${i}`);
        }
    }

    // Create scan promises for all IP:port combinations
    const scanPromises = [];
    for (const ip of ipsToScan) {
        for (const port of ports) {
            scanPromises.push(
                checkDevice(ip, port)
                    .then(device => {
                        if (device) {
                            foundDevices.push(device);
                        }
                    })
                    .catch(() => { })
            );
        }
    }

    // Wait for all scans with timeout
    await Promise.race([
        Promise.all(scanPromises),
        new Promise(resolve => setTimeout(resolve, timeout))
    ]);

    return foundDevices;
};

// Generate a unique customer ID
const generateCustomerID = () => {
    return `customer_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
};

// Generate a session key for encryption
const generateSessionKey = () => {
    return Math.random().toString(36).substring(2, 15) +
        Math.random().toString(36).substring(2, 15) +
        Date.now().toString(36);
};

// Start a session with the desktop client
export const startSession = async (device, customerID, sessionKey) => {
    try {
        const response = await axios.post(
            `http://${device.ip}:${device.port}/session/start`,
            {
                customerID,
                sessionKey
            },
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                timeout: 5000,
            }
        );
        return response.data;
    } catch (error) {
        console.error('Session start error:', error);
        throw new Error('Failed to establish session with desktop client');
    }
};

// End a session with the desktop client
export const endSession = async (device, customerID) => {
    try {
        await axios.post(
            `http://${device.ip}:${device.port}/session/end`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Customer-ID': customerID,
                },
                timeout: 5000,
            }
        );
    } catch (error) {
        console.error('Session end error:', error);
        // Don't throw - session end is best effort
    }
};

// Send heartbeat to keep session alive
export const sendHeartbeat = async (device, customerID) => {
    try {
        await axios.post(
            `http://${device.ip}:${device.port}/session/heartbeat`,
            {},
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Customer-ID': customerID,
                },
                timeout: 3000,
            }
        );
    } catch (error) {
        console.error('Heartbeat error:', error);
    }
};

// Send file to a device (with session management)
export const sendFileToDevice = async (device, file, onProgress) => {
    if (!file) {
        throw new Error('No file selected');
    }

    // Generate session credentials
    const customerID = generateCustomerID();
    const sessionKey = generateSessionKey();

    let heartbeatInterval = null;

    try {
        // Step 1: Establish session
        console.log('Establishing session with desktop client...');
        await startSession(device, customerID, sessionKey);
        console.log('Session established successfully');

        // Step 2: Start heartbeat to keep session alive
        heartbeatInterval = setInterval(() => {
            sendHeartbeat(device, customerID);
        }, 10000); // Send heartbeat every 10 seconds

        // Step 3: Send file
        const formData = new FormData();
        formData.append('file', {
            uri: file.uri,
            type: file.mimeType || 'application/octet-stream',
            name: file.name,
        });

        const response = await axios.post(
            `http://${device.ip}:${device.port}/upload`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                    'X-Customer-ID': customerID,
                    'X-Session-Key': sessionKey,
                    'X-Encrypted': 'false', // Not encrypting for now
                },
                timeout: 60000, // Increased timeout for larger files
                onUploadProgress: (progressEvent) => {
                    if (onProgress) {
                        const percentCompleted = Math.round(
                            (progressEvent.loaded * 100) / progressEvent.total
                        );
                        onProgress(percentCompleted);
                    }
                },
            }
        );

        // Step 4: End session after successful transfer
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }
        await endSession(device, customerID);

        return response.data;

    } catch (error) {
        // Clean up on error
        if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
        }

        // Try to end session even on error
        try {
            await endSession(device, customerID);
        } catch (e) {
            // Ignore cleanup errors
        }

        throw error;
    }
};
