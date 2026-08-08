"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode, createContext, useContext, useState, useEffect } from "react";

interface UserContextType {
    userEmail: string | null;
    setUserEmail: (email: string | null) => void;
    isEmailModalOpen: boolean;
    setIsEmailModalOpen: (open: boolean) => void;
    hasSeenEmailModal: boolean;
    markEmailModalSeen: () => void;
}

export const EMAIL_MODAL_SEEN_KEY = 'seaura_email_modal_seen';

const UserContext = createContext<UserContextType | undefined>(undefined);

export function useUser() {
    const context = useContext(UserContext);
    if (!context) throw new Error("useUser must be used within a Providers");
    return context;
}

export function Providers({ children }: { children: ReactNode }) {
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    // Assume "seen" until localStorage says otherwise, so the modal never flashes
    // on the first render before the effect runs.
    const [hasSeenEmailModal, setHasSeenEmailModal] = useState(true);

    const markEmailModalSeen = () => {
        setHasSeenEmailModal(true);
        localStorage.setItem(EMAIL_MODAL_SEEN_KEY, '1');
    };

    useEffect(() => {
        const storedEmail = localStorage.getItem('seaura_user_email');
        if (storedEmail) {
            setUserEmail(storedEmail);
            setIsEmailModalOpen(false);
        }
        setHasSeenEmailModal(localStorage.getItem(EMAIL_MODAL_SEEN_KEY) === '1');
    }, []);

    return (
        <SessionProvider>
            <UserContext.Provider value={{ userEmail, setUserEmail, isEmailModalOpen, setIsEmailModalOpen, hasSeenEmailModal, markEmailModalSeen }}>
                {children}
            </UserContext.Provider>
        </SessionProvider>
    );
}

