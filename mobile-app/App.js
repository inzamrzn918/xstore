import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StyleSheet, Text, View } from 'react-native';

// Screens
import SendScreen from './src/screens/SendScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Tab = createBottomTabNavigator();

function TabBarIcon({ focused, icon }) {
    return (
        <View style={[styles.iconContainer, focused && styles.iconContainerActive]}>
            <Text style={styles.icon}>{icon}</Text>
        </View>
    );
}

function TabBarLabel({ focused, label }) {
    return (
        <Text style={[styles.label, focused && styles.labelActive]}>
            {label}
        </Text>
    );
}

export default function App() {
    return (
        <NavigationContainer>
            <Tab.Navigator
                screenOptions={{
                    headerStyle: {
                        backgroundColor: '#6366f1',
                        elevation: 0,
                        shadowOpacity: 0,
                    },
                    headerTintColor: '#fff',
                    headerTitleStyle: {
                        fontWeight: '700',
                        fontSize: 20,
                    },
                    tabBarStyle: {
                        backgroundColor: '#fff',
                        borderTopWidth: 1,
                        borderTopColor: '#f3f4f6',
                        height: 60,
                        paddingBottom: 8,
                        paddingTop: 8,
                    },
                    tabBarActiveTintColor: '#6366f1',
                    tabBarInactiveTintColor: '#9ca3af',
                }}
            >
                <Tab.Screen
                    name="Send"
                    component={SendScreen}
                    options={{
                        title: 'Send File',
                        tabBarIcon: ({ focused }) => (
                            <TabBarIcon focused={focused} icon="📤" />
                        ),
                        tabBarLabel: ({ focused }) => (
                            <TabBarLabel focused={focused} label="Send" />
                        ),
                    }}
                />
                <Tab.Screen
                    name="History"
                    component={HistoryScreen}
                    options={{
                        title: 'Transfer History',
                        tabBarIcon: ({ focused }) => (
                            <TabBarIcon focused={focused} icon="📋" />
                        ),
                        tabBarLabel: ({ focused }) => (
                            <TabBarLabel focused={focused} label="History" />
                        ),
                    }}
                />
                <Tab.Screen
                    name="Settings"
                    component={SettingsScreen}
                    options={{
                        title: 'Settings',
                        tabBarIcon: ({ focused }) => (
                            <TabBarIcon focused={focused} icon="⚙️" />
                        ),
                        tabBarLabel: ({ focused }) => (
                            <TabBarLabel focused={focused} label="Settings" />
                        ),
                    }}
                />
            </Tab.Navigator>
        </NavigationContainer>
    );
}

const styles = StyleSheet.create({
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconContainerActive: {
        backgroundColor: '#eef2ff',
    },
    icon: {
        fontSize: 22,
    },
    label: {
        fontSize: 11,
        fontWeight: '600',
        color: '#9ca3af',
    },
    labelActive: {
        color: '#6366f1',
    },
});
