import * as DocumentPicker from 'expo-document-picker';

/**
 * File Picker Service - Handles file selection
 */

// Pick a document from device
export const pickDocument = async () => {
    try {
        const result = await DocumentPicker.getDocumentAsync({
            type: '*/*',
            copyToCacheDirectory: true,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
            return result.assets[0];
        }

        return null;
    } catch (error) {
        console.error('Error picking document:', error);
        throw new Error('Failed to pick document');
    }
};

// Format file size for display
export const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

// Get file extension
export const getFileExtension = (filename) => {
    return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
};

// Get file icon based on extension
export const getFileIcon = (filename) => {
    const ext = getFileExtension(filename).toLowerCase();

    const iconMap = {
        pdf: '📄',
        doc: '📝',
        docx: '📝',
        xls: '📊',
        xlsx: '📊',
        ppt: '📊',
        pptx: '📊',
        txt: '📃',
        jpg: '🖼️',
        jpeg: '🖼️',
        png: '🖼️',
        gif: '🖼️',
        zip: '📦',
        rar: '📦',
    };

    return iconMap[ext] || '📄';
};
