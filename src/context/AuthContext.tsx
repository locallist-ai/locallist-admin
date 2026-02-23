import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { getAccessToken, setTokens as apiSetTokens, clearTokens as apiClearTokens } from '../lib/api';

interface AuthState {
    token: string | null;
    isLoading: boolean;
    signIn: (token: string) => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
    token: null,
    isLoading: true,
    signIn: async () => { },
    signOut: async () => { },
});

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Check for existing token on mount
        getAccessToken().then(storedToken => {
            setToken(storedToken);
            setIsLoading(false);
        });
    }, []);

    const signIn = async (newToken: string) => {
        await apiSetTokens(newToken);
        setToken(newToken);
    };

    const signOut = async () => {
        await apiClearTokens();
        setToken(null);
    };

    return (
        <AuthContext.Provider value={{ token, isLoading, signIn, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}
