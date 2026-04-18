import Link from 'next/link';
import { Instagram } from 'lucide-react';
import styles from './Footer.module.css';
import { useState } from 'react';
import Swal from 'sweetalert2';

interface FooterProps {
    onSubscribe?: (email: string) => Promise<void>;
}

export default function Footer({ onSubscribe }: FooterProps) {
    const [email, setEmail] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const handleSubscribe = async () => {
        if (!email) return;
        setSubmitting(true);
        try {
            if (onSubscribe) {
                await onSubscribe(email);
            } else {
                // Default subscription logic if no prop provided
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `mutation($email: String!) { subscribeNewsletter(email: $email) }`,
                        variables: { email }
                    })
                });
                const data = await res.json();
                if (data.data?.subscribeNewsletter) {
                    Swal.fire({
                        title: 'Success!',
                        text: 'You have been subscribed to our newsletter.',
                        icon: 'success',
                        confirmButtonColor: '#000'
                    });
                    setEmail('');
                }
            }
        } catch (err) {
            Swal.fire({
                title: 'Error',
                text: 'Something went wrong. Please try again.',
                icon: 'error',
                confirmButtonColor: '#000'
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <footer className={styles.footer}>
            <div className={styles.footerGrid}>
                <div className={styles.footerCol}>
                    <h3 className={styles.footerHeading}>JOIN THE CLUB</h3>
                    <p className={styles.footerText}>Sign up for 10% off your first order and monthly subscriber-only discounts</p>
                    <div className={styles.footerSubscribeGroup}>
                        <input
                            type="email"
                            placeholder="Enter your email address"
                            className={styles.footerInputExact}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                        <button
                            className={styles.footerSubmitExact}
                            onClick={handleSubscribe}
                            disabled={submitting}
                        >
                            {submitting ? "..." : "SUBSCRIBE"}
                        </button>
                    </div>
                </div>

                <div className={styles.footerCol}>
                    <h3 className={styles.footerHeading}>SHOP WITH SEAURA</h3>
                    <ul className={styles.footerLinks}>
                        <li><Link href="/shop">Shop All</Link></li>
                        <li><Link href="/shop">New Arrivals</Link></li>
                        <li><Link href="/shop">Artisanal Products</Link></li>
                        <li><Link href="/shop?category=sacs">Sacs</Link></li>
                        <li><Link href="/shop?category=bijoux">Bijoux</Link></li>
                        <li><Link href="/shop?category=vêtements">Vêtements</Link></li>
                    </ul>
                </div>

                <div className={styles.footerCol}>
                    <h3 className={styles.footerHeading}>CUSTOMER SERVICE</h3>
                    <ul className={styles.footerLinks}>
                        <li><a href="#">Search</a></li>
                        <li><a href="#">About</a></li>
                        <li><a href="#">Shipping</a></li>
                        <li><a href="#">Materials & Care</a></li>
                        <li><a href="#">Returns</a></li>
                        <li><a href="#">Contact</a></li>
                        <li><a href="#">Privacy Policy</a></li>
                    </ul>
                </div>

                <div className={styles.footerCol}>
                    <h3 className={styles.footerHeading}>FOLLOW US</h3>
                    <div className={styles.footerSocialIcons}>
                        <a href="#" className={styles.socialIconLink}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg></a>
                        <a href="#" className={styles.socialIconLink}><Instagram size={14} /></a>
                        <a href="#" className={styles.socialIconLink}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.11-1.47-.17-.12-.34-.24-.5-.38-.01 2.06.01 4.13-.01 6.19-.01 2.21-.55 4.47-1.92 6.13-1.43 1.75-3.69 2.78-5.96 2.82-2.45.03-5.02-.91-6.57-2.91-1.57-1.97-1.91-4.71-1.07-7.05.74-2.13 2.53-3.87 4.67-4.63.15-.05.3-.11.45-.15.01-.01.01-.02.02-.02V8.9c-.3.08-.59.18-.88.3-2.07.82-3.7 2.72-4.14 4.93-.41 1.95.03 4.1.99 5.81.99 1.79 2.91 3.1 4.96 3.32 1.45.17 2.97-.12 4.16-.99 1.4-1.01 2.23-2.65 2.22-4.4V3.01l.01-.01c-.13-.9-.37-1.81-.79-2.63-.12-.24-.25-.49-.39-.72l.01-.01z" /></svg></a>
                    </div>
                </div>
            </div>
            <div className={styles.footerBottom}>
                <p>© 2026 S E A U R A — Digital Boutique / Artisanal Heritage.</p>
            </div>
        </footer>
    );
}
