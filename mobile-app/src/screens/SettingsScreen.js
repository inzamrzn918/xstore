import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Switch,
} from 'react-native';
import * as NetworkService from '../services/networkService';

export default function SettingsScreen() {
    const [localIP, setLocalIP] = useState(null);
    const [autoScan, setAutoScan] = useState(true);
    const [notifications, setNotifications] = useState(true);

    useEffect(() => {
        loadIP();
    }, []);

    const loadIP = async () => {
        try {
            const ip = await NetworkService.getLocalIP();
            setLocalIP(ip);
        } catch (error) {
            console.error('Error getting IP:', error);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                {/* Device Info */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Device Information</Text>
                    <View style={styles.card}>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Local IP Address</Text>
                            <Text style={styles.infoValue}>{localIP || 'Loading...'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>App Version</Text>
                            <Text style={styles.infoValue}>1.0.0</Text>
                        </View>
                    </View>
                </View>

                {/* Preferences */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Preferences</Text>
                    <View style={styles.card}>
                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Auto-scan on startup</Text>
                                <Text style={styles.settingDescription}>
                                    Automatically search for nearby devices
                                </Text>
                            </View>
                            <Switch
                                value={autoScan}
                                onValueChange={setAutoScan}
                                trackColor={{ false: '#d1d5db', true: '#a5b4fc' }}
                                thumbColor={autoScan ? '#6366f1' : '#f3f4f6'}
                            />
                        </View>

                        <View style={styles.divider} />

                        <View style={styles.settingRow}>
                            <View style={styles.settingInfo}>
                                <Text style={styles.settingLabel}>Notifications</Text>
                                <Text style={styles.settingDescription}>
                                    Show transfer status notifications
                                </Text>
                            </View>
                            <Switch
                                value={notifications}
                                onValueChange={setNotifications}
                                trackColor={{ false: '#d1d5db', true: '#a5b4fc' }}
                                thumbColor={notifications ? '#6366f1' : '#f3f4f6'}
                            />
                        </View>
                    </View>
                </View>

                {/* About */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>About</Text>
                    <View style={styles.card}>
                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuLabel}>Help & Support</Text>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuLabel}>Privacy Policy</Text>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>

                        <View style={styles.divider} />

                        <TouchableOpacity style={styles.menuItem}>
                            <Text style={styles.menuLabel}>Terms of Service</Text>
                            <Text style={styles.menuArrow}>›</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>QuickShare P2P File Transfer</Text>
                    <Text style={styles.footerSubtext}>Made with ❤️ for seamless sharing</Text>
                </View>
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
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6b7280',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: 12,
        marginLeft: 4,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    infoRow: {
        paddingVertical: 12,
    },
    infoLabel: {
        fontSize: 14,
        color: '#6b7280',
        marginBottom: 4,
    },
    infoValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
    },
    settingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    settingInfo: {
        flex: 1,
        marginRight: 12,
    },
    settingLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    settingDescription: {
        fontSize: 13,
        color: '#6b7280',
    },
    divider: {
        height: 1,
        backgroundColor: '#f3f4f6',
        marginVertical: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
    },
    menuLabel: {
        fontSize: 16,
        color: '#1f2937',
    },
    menuArrow: {
        fontSize: 20,
        color: '#d1d5db',
    },
    footer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    footerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
        marginBottom: 4,
    },
    footerSubtext: {
        fontSize: 12,
        color: '#9ca3af',
    },
});
