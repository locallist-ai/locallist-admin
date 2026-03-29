import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '../lib/firebase';

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
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
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

    const signOut = async () => {
        await firebaseSignOut(auth);
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

async function syncUserWithBackend(idToken: string) {
    try {
        const apiUrl = process.env.EXPO_PUBLIC_API_URL
            || 'https://locallist-api-net-production.up.railway.app';

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
