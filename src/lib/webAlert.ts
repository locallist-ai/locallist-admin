/**
 * Degradación de Alert.alert para web.
 *
 * react-native-web no implementa los botones de Alert: el alert se pinta pero
 * los callbacks onPress nunca se ejecutan, así que cualquier confirmación o
 * navegación montada sobre Alert es un no-op silencioso en el navegador.
 * En web degradamos a window.alert / window.confirm, que sí son bloqueantes
 * y nos dejan ejecutar el callback correcto.
 *
 * Módulo puro (sin imports de react-native) para poder testearlo con vitest;
 * el wrapper con Platform vive en `dialogs.ts`.
 */

export type DialogButton = {
    text: string;
    style?: 'default' | 'cancel' | 'destructive';
    onPress?: () => void;
};

export type WebDialogIo = {
    alert: (message: string) => void;
    confirm: (message: string) => boolean;
};

export function runWebAlert(
    title: string,
    message: string | undefined,
    buttons: DialogButton[] | undefined,
    io: WebDialogIo,
): void {
    const text = message ? `${title}\n\n${message}` : title;

    if (!buttons || buttons.length === 0) {
        io.alert(text);
        return;
    }

    if (buttons.length === 1) {
        io.alert(text);
        buttons[0].onPress?.();
        return;
    }

    // Dos o más botones: confirm(). La acción primaria es el primer botón
    // no-cancel; con 2+ botones de acción (sin style 'cancel') del segundo
    // en adelante se pierden, así que los call sites con menús de varias
    // opciones deben usar un modal propio (OptionsMenuModal).
    const action = buttons.find((b) => b.style !== 'cancel') ?? buttons[buttons.length - 1];
    const cancel = buttons.find((b) => b.style === 'cancel');

    if (io.confirm(`${text}\n\n[OK = ${action.text}]`)) {
        action.onPress?.();
    } else {
        cancel?.onPress?.();
    }
}
