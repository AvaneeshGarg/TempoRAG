import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UserRole = 'physician' | 'researcher' | 'student' | 'guest';

export interface User {
    name: string;
    email: string;
    avatar?: string;
    role: UserRole;
    isGuest: boolean;
    provider?: string;
}

interface AuthContextValue {
    user: User | null;
    loading: boolean;
    loginWithGoogle: () => void;
    loginWithGitHub: () => void;
    loginAsGuest: () => void;
    logout: () => Promise<void>;
    canAccess: (page: 'chat' | 'risk' | 'research' | 'eval') => boolean;
    guestSearchCount: number;
    incrementGuestSearch: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
};

// ── Config ──────────────────────────────────────────────────────────────────
// In dev: proxied via Vite proxy (/auth → localhost:8001). In prod: direct to Render URL.
export const BACKEND_URL = ((import.meta.env.VITE_BACKEND_URL as string) || '').replace(/\/+$/, '');

const GUEST_KEY = 'crag_is_guest';
const MAX_GUEST_SEARCHES = 3;

// ── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [guestSearchCount, setGuestSearchCount] = useState(0);

    // On mount: check if there's a valid JWT session cookie (from OAuth callback)
    // or restore guest session from localStorage.
    useEffect(() => {
        const isGuest = localStorage.getItem(GUEST_KEY) === 'true';
        if (isGuest) {
            setUser({ name: 'Guest', email: 'guest@local', role: 'guest', isGuest: true });
            setLoading(false);
            return;
        }

        // Try to fetch the current user from the backend (reads httpOnly cookie)
        fetch(`${BACKEND_URL}/auth/me`, { credentials: 'include' })
            .then(async (res) => {
                if (res.ok) {
                    const data = await res.json();
                    setUser({ ...data, isGuest: false });
                }
            })
            .catch(() => { /* not logged in */ })
            .finally(() => setLoading(false));
    }, []);

    const loginWithGoogle = useCallback(() => {
        // Redirect to backend which will redirect to Google
        window.location.href = `${BACKEND_URL}/auth/google`;
    }, []);

    const loginWithGitHub = useCallback(() => {
        window.location.href = `${BACKEND_URL}/auth/github`;
    }, []);

    const loginAsGuest = useCallback(() => {
        localStorage.setItem(GUEST_KEY, 'true');
        setUser({ name: 'Guest', email: 'guest@local', role: 'guest', isGuest: true });
        setGuestSearchCount(0);
    }, []);

    const logout = useCallback(async () => {
        localStorage.removeItem(GUEST_KEY);
        setUser(null);
        setGuestSearchCount(0);
        // Tell backend to clear the httpOnly cookie
        try {
            await fetch(`${BACKEND_URL}/auth/logout`, { credentials: 'include' });
        } catch { /* ignore network errors on logout */ }
    }, []);

    const canAccess = useCallback((page: 'chat' | 'risk' | 'research' | 'eval') => {
        if (!user) return false;
        if (!user.isGuest) return true;
        return page === 'research' && guestSearchCount < MAX_GUEST_SEARCHES;
    }, [user, guestSearchCount]);

    const incrementGuestSearch = useCallback(() => {
        setGuestSearchCount(prev => prev + 1);
    }, []);

    return (
        <AuthContext.Provider value={{
            user, loading, loginWithGoogle, loginWithGitHub,
            loginAsGuest, logout, canAccess, guestSearchCount, incrementGuestSearch
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export { MAX_GUEST_SEARCHES };
