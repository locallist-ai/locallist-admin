import { Alert, Platform } from 'react-native';
import { runWebAlert, type DialogButton } from './webAlert';

/**
 * Reemplazo drop-in de Alert.alert que funciona también en web.
 * Misma firma que Alert.alert(title, message?, buttons?).
 */
export function showAlert(title: string, message?: string, buttons?: DialogButton[]): void {
    if (Platform.OS === 'web') {
        runWebAlert(title, message, buttons, {
            alert: (m) => window.alert(m),
            confirm: (m) => window.confirm(m),
        });
        return;
    }
    Alert.alert(title, message, buttons);
}

export type { DialogButton };
