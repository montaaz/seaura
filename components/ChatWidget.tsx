"use client";

import { MessageCircle } from "lucide-react";
import styles from "../app/page.module.css";
import { usePathname } from "next/navigation";

export default function ChatWidget() {
    const pathname = usePathname();
    
    // Hide chat widget on admin pages
    if (pathname?.startsWith('/admin')) return null;

    return (
        <a 
            href="https://wa.me/+21625489395" 
            target="_blank" 
            rel="noopener noreferrer"
            className={styles.chatBubble}
            style={{ textDecoration: 'none' }}
            title="Chat on WhatsApp"
        >
            <MessageCircle size={24} />
            <span className={styles.chatBadge}>1</span>
        </a>
    );
}
