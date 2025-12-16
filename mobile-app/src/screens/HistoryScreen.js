import React, { useState, useEffect } from 'react';
import {
    StyleSheet,
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import * as StorageService from '../services/storageService';
import { HistoryItem } from '../components/HistoryItem';

export default function HistoryScreen() {
    const [history, setHistory] = useState([]);
    const [refreshing, setRefreshing] = useState(false);
    const navigation = useNavigation();

    useEffect(() => {
        loadHistory();
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            loadHistory();
        }, [])
    );

    const loadHistory = async () => {
        setRefreshing(true);
        try {
            const loadedHistory = await StorageService.loadHistory();
            setHistory(loadedHistory);
        } catch (error) {
            console.error('Error loading history:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleClearHistory = () => {
        Alert.alert(
            'Clear History',
            'Are you sure you want to clear all transfer history?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await StorageService.clearHistory();
                            setHistory([]);
                        } catch (error) {
                            Alert.alert('Error', 'Failed to clear history');
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView style={styles.content}>
                {history.length > 0 ? (
                    <>
                        <View style={styles.header}>
                            <Text style={styles.title}>Transfer History</Text>
                            <TouchableOpacity onPress={handleClearHistory}>
                                <Text style={styles.clearButton}>Clear All</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.list}>
                            {history.map((item, index) => (
                                <View key={index} style={styles.historyCard}>
                                    <HistoryItem item={item} />
                                </View>
                            ))}
                        </View>
                    </>
                ) : (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyIcon}>📋</Text>
                        <Text style={styles.emptyTitle}>No Transfer History</Text>
                        <Text style={styles.emptySubtitle}>
                            Your file transfers will appear here
                        </Text>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f7fa',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        paddingBottom: 12,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#1f2937',
    },
    clearButton: {
        fontSize: 14,
        fontWeight: '600',
        color: '#ef4444',
    },
    list: {
        padding: 16,
        paddingTop: 0,
    },
    historyCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 100,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
        opacity: 0.3,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: '#1f2937',
        marginBottom: 8,
    },
    emptySubtitle: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
    },
});
