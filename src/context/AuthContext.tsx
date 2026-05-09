import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { getFirebaseAuth } from '../lib/firebase';

interface AuthState {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    signOut: async () => {},
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const auth = getFirebaseAuth();
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // Domain check must happen before any backend interaction
                if (!firebaseUser.email?.endsWith('@locallist.ai')) {
                    await firebaseSignOut(auth);
                    setUser(null);
                    setToken(null);
                    setIsLoading(false);
                    return;
                }

                const idToken = await firebaseUser.getIdToken();
                setUser(firebaseUser);
                setToken(idToken);

                // Sync user with backend DB (fire and forget)
                syncUserWithBackend(idToken);
            } else {
                setUser(null);
                setToken(null);
            }
            setIsLoading(false);
        });

        return unsubscribe;
    }, []);

    // Refresh the Firebase ID token every 50 min to prevent silent 401s after 1h expiry (H10)
    useEffect(() => {
        if (!user) return;
        const interval = setInterval(async () => {
            const refreshed = await user.getIdToken(true);
            setToken(refreshed);
        }, 50 * 60 * 1000);
        return () => clearInterval(interval);
    }, [user]);

    const signOut = async () => {
        await firebaseSignOut(getFirebaseAuth());
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

async function syncUserWithBackend(idToken: string) {
    try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL ?? '';

        await fetch(`${apiUrl}/auth/sync`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`,
            },
        });
    } catch {
        // Non-critical — user sync can fail silently on first load
    }
}
