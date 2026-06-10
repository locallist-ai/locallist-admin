/**
 * Runs an async action with a boolean "in flight" flag raised around it.
 * The flag is always lowered — also when the action throws — so the UI can
 * never be left stuck in a loading state.
 */
export async function withFlag<T>(
    setFlag: (value: boolean) => void,
    action: () => Promise<T>,
): Promise<T> {
    setFlag(true);
    try {
        return await action();
    } finally {
        setFlag(false);
    }
}
