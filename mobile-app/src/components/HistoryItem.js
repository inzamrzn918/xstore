import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * HistoryItem Component - Displays a transfer history item
 */
export const HistoryItem = ({ item }) => {
    return (
        <View style={styles.historyItem}>
            <Text style={styles.historyDocument}>{item.fileName}</Text>
            <Text style={styles.historyAction}>{item.action}</Text>
            <Text style={styles.historyTime}>
                {new Date(item.timestamp).toLocaleString()}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    historyItem: {
        backgroundColor: '#fff',
        padding: 12,
        borderRadius: 8,
        marginBottom: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#6366f1',
    },
    historyDocument: {
        fontSize: 14,
        fontWeight: '500',
        color: '#1f2937',
    },
    historyAction: {
        fontSize: 12,
        color: '#6b7280',
        marginTop: 2,
    },
    historyTime: {
        fontSize: 11,
        color: '#9ca3af',
        marginTop: 2,
    },
});
