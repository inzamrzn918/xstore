import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Platform } from 'react-native';

/**
 * DeviceCard Component - Displays a nearby device
 */
export const DeviceCard = ({ device, onPress, isTransferring, isSelected }) => {
    return (
        <TouchableOpacity
            style={styles.deviceCard}
            onPress={() => onPress(device)}
            disabled={isTransferring}
        >
            <View style={styles.deviceIcon}>
                <Text style={styles.deviceIconText}>🖥️</Text>
            </View>
            <View style={styles.deviceInfo}>
                <Text style={styles.deviceName}>{device.shopName}</Text>
                {device.location && (
                    <Text style={styles.deviceLocation}>📍 {device.location}</Text>
                )}
                <Text style={styles.deviceIP}>
                    {device.ip}:{device.port}
                </Text>
            </View>
            <View style={styles.deviceAction}>
                {isTransferring && isSelected ? (
                    <ActivityIndicator size="small" color="#6366f1" />
                ) : (
                    <Text style={styles.sendIcon}>→</Text>
                )}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    deviceCard: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e5e7eb',
        alignItems: 'center',
    },
    deviceIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#ede9fe',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    deviceIconText: {
        fontSize: 24,
    },
    deviceInfo: {
        flex: 1,
    },
    deviceName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 4,
    },
    deviceLocation: {
        fontSize: 12,
        color: '#6b7280',
        marginBottom: 2,
    },
    deviceIP: {
        fontSize: 11,
        color: '#9ca3af',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    deviceAction: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sendIcon: {
        fontSize: 24,
        color: '#6366f1',
    },
});
