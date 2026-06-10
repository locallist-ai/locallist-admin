import { describe, it, expect, vi } from 'vitest';
import { runWebAlert, type DialogButton } from '../lib/webAlert';

function makeIo(confirmResult = true) {
    return {
        io: {
            alert: vi.fn(),
            confirm: vi.fn(() => confirmResult),
        },
        calls: { alert: [] as string[] },
    };
}

describe('runWebAlert', () => {
    it('sin botones: muestra alert con título y mensaje, no peta', () => {
        const { io } = makeIo();
        runWebAlert('Done', 'Translated: 5', undefined, io);
        expect(io.alert).toHaveBeenCalledWith('Done\n\nTranslated: 5');
        expect(io.confirm).not.toHaveBeenCalled();
    });

    it('sin mensaje: el texto es solo el título', () => {
        const { io } = makeIo();
        runWebAlert('Error', undefined, undefined, io);
        expect(io.alert).toHaveBeenCalledWith('Error');
    });

    it('un botón: muestra alert y ejecuta su onPress', () => {
        const { io } = makeIo();
        const onPress = vi.fn();
        runWebAlert('Import complete', '3 added', [{ text: 'Done', onPress }], io);
        expect(io.alert).toHaveBeenCalled();
        expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('un botón sin onPress: no peta', () => {
        const { io } = makeIo();
        expect(() => runWebAlert('Info', undefined, [{ text: 'OK' }], io)).not.toThrow();
    });

    it('dos botones, confirm acepta: ejecuta la acción no-cancel', () => {
        const { io } = makeIo(true);
        const onCancel = vi.fn();
        const onAction = vi.fn();
        const buttons: DialogButton[] = [
            { text: 'Cancel', style: 'cancel', onPress: onCancel },
            { text: 'Translate', onPress: onAction },
        ];
        runWebAlert('Translate All', 'Continue?', buttons, io);
        expect(onAction).toHaveBeenCalledTimes(1);
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('dos botones, confirm rechaza: ejecuta el cancel', () => {
        const { io } = makeIo(false);
        const onCancel = vi.fn();
        const onAction = vi.fn();
        runWebAlert('Delete', 'Sure?', [
            { text: 'Cancel', style: 'cancel', onPress: onCancel },
            { text: 'Delete', style: 'destructive', onPress: onAction },
        ], io);
        expect(onAction).not.toHaveBeenCalled();
        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('el mensaje del confirm indica qué hace OK', () => {
        const { io } = makeIo(true);
        runWebAlert('Reindex', 'Takes ~30s', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Reindex', onPress: vi.fn() },
        ], io);
        expect(io.confirm).toHaveBeenCalledWith('Reindex\n\nTakes ~30s\n\n[OK = Reindex]');
    });

    it('orden invertido (acción primero, cancel después): elige la acción igualmente', () => {
        const { io } = makeIo(true);
        const onAction = vi.fn();
        runWebAlert('Add', '', [
            { text: 'Create', onPress: onAction },
            { text: 'Cancel', style: 'cancel' },
        ], io);
        expect(onAction).toHaveBeenCalledTimes(1);
    });
});
