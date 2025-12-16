import * as FileSystem from 'expo-file-system/legacy';

/**
 * Storage Service - Handles local data persistence
 */

const HISTORY_FILE = 'transfer_history.json';
const MAX_HISTORY_ITEMS = 50;

// Load transfer history from local storage
export const loadHistory = async () => {
    try {
        const historyPath = FileSystem.documentDirectory + HISTORY_FILE;
        const historyData = await FileSystem.readAsStringAsync(historyPath)
            .catch(() => '[]');
        return JSON.parse(historyData);
    } catch (error) {
        console.error('Error loading history:', error);
        return [];
    }
};

// Save transfer history to local storage
export const saveHistory = async (history) => {
    try {
        const historyPath = FileSystem.documentDirectory + HISTORY_FILE;
        await FileSystem.writeAsStringAsync(
            historyPath,
            JSON.stringify(history, null, 2)
        );
    } catch (error) {
        console.error('Error saving history:', error);
        throw error;
    }
};

// Add item to history
export const addToHistory = async (item, currentHistory) => {
    try {
        const newHistory = [item, ...currentHistory].slice(0, MAX_HISTORY_ITEMS);
        await saveHistory(newHistory);
        return newHistory;
    } catch (error) {
        console.error('Error adding to history:', error);
        throw error;
    }
};

// Clear all history
export const clearHistory = async () => {
    try {
        const historyPath = FileSystem.documentDirectory + HISTORY_FILE;
        await FileSystem.writeAsStringAsync(historyPath, '[]');
        return [];
    } catch (error) {
        console.error('Error clearing history:', error);
        throw error;
    }
};

// Create history item
export const createHistoryItem = (fileName, action, metadata = {}) => {
    return {
        fileName,
        action,
        timestamp: new Date().toISOString(),
        ...metadata,
    };
};
