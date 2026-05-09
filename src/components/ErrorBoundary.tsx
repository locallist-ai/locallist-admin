import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
    state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    render() {
        if (this.state.error) {
            return (
                <View style={styles.container}>
                    <Text style={styles.title}>Error de configuración</Text>
                    <Text style={styles.message}>{this.state.error.message}</Text>
                </View>
            );
        }
        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#fff' },
    title: { fontSize: 20, fontWeight: '700', color: '#dc2626', marginBottom: 12, textAlign: 'center' },
    message: { fontSize: 13, color: '#374151', textAlign: 'center', lineHeight: 22, fontFamily: 'monospace' },
});
