import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as NetworkService from '../services/networkService';
import * as StorageService from '../services/storageService';
import * as FileService from '../services/fileService';
import { FileCard } from '../components/FileCard';
import { DeviceCard } from '../components/DeviceCard';

export default function SendScreen({ navigation }) {
    const [selectedFile, setSelectedFile] = useState(null);
    const [localIP, setLocalIP] = useState(null);
    const [nearbyDevices, setNearbyDevices] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [transferStatus, setTransferStatus] = useState('idle');
    const [connectionStatus, setConnectionStatus] = useState(''); // New: track connection status
    const [selectedDevice, setSelectedDevice] = useState(null);
    const [showQRScanner, setShowQRScanner] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            const ip = await NetworkService.getLocalIP();
            setLocalIP(ip);
        } catch (error) {
            console.error('Initialization error:', error);
        }
    };

    const handlePickDocument = async () => {
        try {
            const file = await FileService.pickDocument();
            if (file) {
                setSelectedFile(file);
            }
        } catch (error) {
            Alert.alert('Error', 'Failed to pick document');
        }
    };

    const handleScanDevices = async () => {
        if (!selectedFile) {
            Alert.alert('Select File First', 'Please select a file before scanning for devices');
            return;
        }

        setIsScanning(true);
        setNearbyDevices([]);

        try {
            const devices = await NetworkService.scanNearbyDevices(localIP, {
                scanRange: 10,
                timeout: 10000,
            });

            setNearbyDevices(devices);

            if (devices.length === 0) {
                Alert.alert(
                    'No Devices Found',
                    'Make sure desktop clients are running on the same network'
                );
            }
        } catch (error) {
            console.error('Scan error:', error);
            Alert.alert('Error', error.message || 'Failed to scan for devices');
        } finally {
            setIsScanning(false);
        }
    };

    const handleOpenQRScanner = async () => {
        if (!selectedFile) {
            Alert.alert('Select File First', 'Please select a file before scanning QR code');
            return;
        }

        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required');
                return;
            }
        }

        setShowQRScanner(true);
        setScanned(false);
    };

    const handleBarCodeScanned = ({ data }) => {
        if (scanned) return;

        setScanned(true);
        setShowQRScanner(false);

        try {
            let qrData = null;

            // Check if it's the new custom URL scheme format
            if (data.startsWith('xstore://connect?data=')) {
                try {
                    // Extract base64 data from URL
                    const urlParams = new URLSearchParams(data.split('?')[1]);
                    const base64Data = urlParams.get('data');

                    if (!base64Data) {
                        throw new Error('Invalid QR code format');
                    }

                    // Decode base64
                    const decodedString = atob(base64Data);
                    qrData = JSON.parse(decodedString);

                    console.log('Decoded custom URL scheme QR code');
                } catch (error) {
                    console.error('Error parsing custom URL scheme:', error);
                    Alert.alert(
                        'Invalid QR Code',
                        'This QR code appears to be corrupted or from an incompatible version of XStore.'
                    );
                    return;
                }
            }
            // Fallback to legacy JSON format for backward compatibility
            else if (data.startsWith('{')) {
                try {
                    qrData = JSON.parse(data);
                    console.log('Parsed legacy JSON QR code');
                } catch (error) {
                    console.error('Error parsing JSON:', error);
                    Alert.alert(
                        'Invalid QR Code',
                        'This QR code is not in a recognized format.'
                    );
                    return;
                }
            }
            // Not a recognized format
            else {
                Alert.alert(
                    'Unsupported QR Code',
                    'This QR code is not from XStore. Please scan the QR code displayed on the desktop application.',
                    [{ text: 'OK', onPress: () => setShowQRScanner(true) }]
                );
                return;
            }

            // Validate the parsed data
            if (!qrData || qrData.type !== 'printshare') {
                Alert.alert(
                    'Invalid QR Code',
                    'This is not a valid XStore QR code. Please scan the QR code from the desktop application.',
                    [{ text: 'OK', onPress: () => setShowQRScanner(true) }]
                );
                return;
            }

            // Check for required fields
            if (!qrData.shopName || !qrData.ip || !qrData.port) {
                Alert.alert(
                    'Incomplete QR Code',
                    'This QR code is missing required information. Please regenerate the QR code on the desktop application.',
                    [{ text: 'OK', onPress: () => setShowQRScanner(true) }]
                );
                return;
            }

            // Check version compatibility (if version field exists)
            if (qrData.version) {
                const majorVersion = parseInt(qrData.version.split('.')[0]);
                if (majorVersion > 1) {
                    Alert.alert(
                        'Version Mismatch',
                        'The desktop application is using a newer version. Please update your mobile app.',
                        [{ text: 'OK' }]
                    );
                    return;
                }
            }

            // Check if QR code is too old (if timestamp exists)
            if (qrData.timestamp) {
                const ageInHours = (Date.now() - qrData.timestamp) / (1000 * 60 * 60);
                if (ageInHours > 24) {
                    Alert.alert(
                        'QR Code Expired',
                        'This QR code is more than 24 hours old. Please scan a fresh QR code from the desktop application.',
                        [{ text: 'OK', onPress: () => setShowQRScanner(true) }]
                    );
                    return;
                }
            }

            // Create device object
            const device = {
                ip: qrData.ip,
                port: qrData.port,
                shopName: qrData.shopName,
                shopID: qrData.shopID,
                location: qrData.location,
            };

            // Confirm before sending
            Alert.alert(
                'Device Found',
                `Send file to ${device.shopName}?${device.location ? '\n📍 ' + device.location : ''}`,
                [
                    { text: 'Cancel', style: 'cancel', onPress: () => setShowQRScanner(true) },
                    { text: 'Send', onPress: () => handleSendToDevice(device) }
                ]
            );

        } catch (error) {
            console.error('QR code processing error:', error);
            Alert.alert(
                'Error',
                'Failed to process QR code. Please try again.',
                [{ text: 'OK', onPress: () => setShowQRScanner(true) }]
            );
        }
    };

    const handleSendToDevice = async (device) => {
        if (!selectedFile) return;

        setSelectedDevice(device);
        setTransferStatus('transferring');
        setConnectionStatus('Establishing connection...');

        try {
            // Show connection status
            console.log(`Connecting to ${device.shopName}...`);

            setConnectionStatus('Uploading file...');
            await NetworkService.sendFileToDevice(device, selectedFile);

            setConnectionStatus('Transfer complete!');
            setTransferStatus('complete');
            Alert.alert('Success!', `File sent to ${device.shopName}`);

            const historyItem = StorageService.createHistoryItem(
                selectedFile.name,
                `Sent to ${device.shopName}`,
                { deviceIP: device.ip, devicePort: device.port }
            );
            await StorageService.addToHistory(historyItem, []);

            setTimeout(() => {
                setSelectedFile(null);
                setNearbyDevices([]);
                setSelectedDevice(null);
                setTransferStatus('idle');
                setConnectionStatus('');
                if (navigation) {
                    navigation.navigate('History');
                }
            }, 1500);

        } catch (error) {
            console.error('Upload error:', error);
            setTransferStatus('idle');
            setConnectionStatus('');

            // Provide more detailed error messages
            let errorMessage = 'Failed to send file';
            if (error.message) {
                if (error.message.includes('session')) {
                    errorMessage = 'Could not establish connection with desktop client. Please ensure the desktop app is running.';
                } else if (error.message.includes('timeout')) {
                    errorMessage = 'Connection timed out. Please check your network connection.';
                } else if (error.message.includes('Network')) {
                    errorMessage = 'Network error. Please check if both devices are on the same network.';
                } else {
                    errorMessage = error.message;
                }
            }

            Alert.alert('Transfer Failed', errorMessage);
        }
    };

    if (showQRScanner) {
        return (
            <View style={styles.qrContainer}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    facing="back"
                    onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                />
                <View style={styles.qrOverlay}>
                    <View style={styles.qrHeader}>
                        <Text style={styles.qrTitle}>Scan QR Code</Text>
                        <Text style={styles.qrSubtitle}>Point at desktop QR code</Text>
                    </View>

                    <View style={styles.qrFrame}>
                        <View style={[styles.corner, styles.cornerTL]} />
                        <View style={[styles.corner, styles.cornerTR]} />
                        <View style={[styles.corner, styles.cornerBL]} />
                        <View style={[styles.corner, styles.cornerBR]} />
                    </View>

                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={() => setShowQRScanner(false)}
                    >
                        <Text style={styles.closeButtonText}>Close</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* File Selection Card */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Select File</Text>
                    {selectedFile ? (
                        <FileCard file={selectedFile} formatFileSize={FileService.formatFileSize} />
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyIcon}>📄</Text>
                            <Text style={styles.emptyText}>No file selected</Text>
                        </View>
                    )}
                    <TouchableOpacity style={styles.primaryButton} onPress={handlePickDocument}>
                        <Text style={styles.buttonText}>
                            {selectedFile ? 'Change File' : 'Select File'}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Connection Methods */}
                {selectedFile && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>Send To</Text>

                        <TouchableOpacity
                            style={styles.methodButton}
                            onPress={handleOpenQRScanner}
                        >
                            <View style={styles.methodIcon}>
                                <Text style={styles.methodIconText}>📷</Text>
                            </View>
                            <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>Scan QR Code</Text>
                                <Text style={styles.methodSubtitle}>Quick & accurate</Text>
                            </View>
                            <Text style={styles.methodArrow}>›</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.methodButton}
                            onPress={handleScanDevices}
                            disabled={isScanning}
                        >
                            <View style={styles.methodIcon}>
                                <Text style={styles.methodIconText}>📡</Text>
                            </View>
                            <View style={styles.methodInfo}>
                                <Text style={styles.methodTitle}>
                                    {isScanning ? 'Scanning...' : 'Find Nearby'}
                                </Text>
                                <Text style={styles.methodSubtitle}>Auto-discover devices</Text>
                            </View>
                            {isScanning ? (
                                <ActivityIndicator color="#6366f1" />
                            ) : (
                                <Text style={styles.methodArrow}>›</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                )}

                {/* Connection Status Banner */}
                {connectionStatus && (
                    <View style={styles.statusBanner}>
                        <ActivityIndicator size="small" color="#6366f1" style={styles.statusSpinner} />
                        <Text style={styles.statusText}>{connectionStatus}</Text>
                    </View>
                )}

                {/* Nearby Devices */}
                {nearbyDevices.length > 0 && (
                    <View style={styles.card}>
                        <Text style={styles.cardTitle}>
                            Found {nearbyDevices.length} Device{nearbyDevices.length !== 1 ? 's' : ''}
                        </Text>
                        {nearbyDevices.map((device, index) => (
                            <DeviceCard
                                key={`${device.ip}-${index}`}
                                device={device}
                                onPress={handleSendToDevice}
                                isTransferring={transferStatus === 'transferring'}
                                isSelected={selectedDevice?.ip === device.ip}
                            />
                        ))}
                    </View>
                )}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    content: {
        padding: 16,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1f2937',
        marginBottom: 16,
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 8,
        opacity: 0.3,
    },
    emptyText: {
        fontSize: 14,
        color: '#9ca3af',
    },
    primaryButton: {
        backgroundColor: '#6366f1',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginTop: 12,
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    methodButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        marginBottom: 12,
    },
    methodIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#eef2ff',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    methodIconText: {
        fontSize: 24,
    },
    methodInfo: {
        flex: 1,
    },
    methodTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 2,
    },
    methodSubtitle: {
        fontSize: 13,
        color: '#6b7280',
    },
    methodArrow: {
        fontSize: 24,
        color: '#d1d5db',
    },
    // QR Scanner
    qrContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    qrOverlay: {
        flex: 1,
        justifyContent: 'space-between',
        paddingVertical: 60,
        alignItems: 'center',
    },
    qrHeader: {
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 20,
        borderRadius: 12,
        marginHorizontal: 20,
    },
    qrTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    qrSubtitle: {
        fontSize: 14,
        color: '#e0e7ff',
    },
    qrFrame: {
        width: 250,
        height: 250,
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: '#10b981',
        borderWidth: 4,
    },
    cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0 },
    cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0 },
    cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0 },
    cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0 },
    statusBanner: {
        backgroundColor: '#eef2ff',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 16,
        marginBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#c7d2fe',
    },
    statusSpinner: {
        marginRight: 12,
    },
    statusText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6366f1',
        flex: 1,
    },
    closeButton: {
        backgroundColor: '#ef4444',
        paddingHorizontal: 32,
        paddingVertical: 16,
        borderRadius: 12,
    },
    closeButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});
