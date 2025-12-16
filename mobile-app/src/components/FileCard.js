import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * FileCard Component - Displays selected file information
 */
export const FileCard = ({ file, formatFileSize }) => {
    if (!file) return null;

    return (
        <View style={styles.fileInfo}>
            <Text style={styles.fileName}>📄 {file.name}</Text>
            <Text style={styles.fileSize}>
                {formatFileSize(file.size)}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    fileInfo: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    fileName: {
        fontSize: 16,
        fontWeight: '500',
        color: '#1f2937',
        marginBottom: 4,
    },
    fileSize: {
        fontSize: 14,
        color: '#6b7280',
    },
});
