"use client";

import { useState, useEffect } from "react";
import styles from "./Header.module.css";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Heart, ShoppingBag, User as UserIcon, X as CloseIcon, ChevronRight, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";

const Search = dynamic(() => import('./Search'), { ssr: false });

interface HeaderProps {
    isScrolled?: boolean;
    cartCount?: number;
    wishlistCount?: number;
    onCartClick?: () => void;
    categories?: any[];
    forceBlack?: boolean;
}

export default function Header({
    isScrolled: propIsScrolled,
    cartCount = 0,
    wishlistCount = 0,
    onCartClick,
    categories = [],
    forceBlack = false
}: HeaderProps) {
    const { data: session } = useSession();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [forceOpenSearch, setForceOpenSearch] = useState(false);
    const [localIsScrolled, setLocalIsScrolled] = useState(false);
    const [expandedCategories, setExpandedCategories] = useState<string[]>([]);

    useEffect(() => {
        const handleScroll = () => {
            setLocalIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const isScrolled = propIsScrolled ?? localIsScrolled;
    const currentLogo = (isScrolled || isSearchOpen || forceBlack) ? "/logo1.png" : "/logowhite.png";

    const handleIsSearchOpen = (val: boolean) => {
        setIsSearchOpen(val);
        document.body.style.overflow = val ? 'hidden' : 'auto';
    };

    const toggleCategory = (catId: string) => {
        setExpandedCategories(prev =>
            prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
        );
    };

    return (
        <>
            <header className={`${styles.header} ${isScrolled || isSearchOpen ? styles.headerScrolled : ""} ${forceBlack ? styles.forceBlack : ""}`}>
                <div className={styles.headerLayout}>
                    <div className={styles.headerLeft}>
                        <button className={styles.menuButton} onClick={() => setIsMenuOpen(true)}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path d="M3 12h18M3 6h18M3 18h18" />
                            </svg>
                        </button>
                        <div className={`${styles.logo} ${styles.hideOnMobile}`}>
                            <Link href="/">
                                <Image
                                    src={currentLogo}
                                    alt="SEAURA Logo"
                                    width={80}
                                    height={40}
                                    className={styles.logoImg}
                                    priority
                                />
                            </Link>
                        </div>
                    </div>

                    <div className={`${styles.headerLogo} ${styles.showOnMobileOnly}`}>
                        <Link href="/">
                            <Image
                                src={currentLogo}
                                alt="SEAURA Logo"
                                width={80}
                                height={40}
                                className={styles.logoImg}
                                priority
                            />
                        </Link>
                    </div>

                    <div className={`${styles.headerCenter} ${isSearchOpen ? styles.searchActive : ""}`}>
                        <Search isScrolled={isScrolled || forceBlack} onOpenChange={handleIsSearchOpen} forceOpen={forceOpenSearch} />
                    </div>

                    <div className={styles.headerRight}>
                        <Link href="/dashboard?tab=wishlist" className={`${styles.iconButton} ${styles.hideOnMobile}`}>
                            <Heart size={22} className={wishlistCount > 0 ? "text-pink-500 fill-pink-500" : ""} />
                            {wishlistCount > 0 && <span className={styles.badge}>{wishlistCount}</span>}
                        </Link>

                        <button className={`${styles.iconButton} ${styles.hideOnMobile}`} onClick={onCartClick}>
                            <ShoppingBag size={22} />
                            {cartCount > 0 && <span className={styles.badge}>{cartCount}</span>}
                        </button>

                        <Link href={session ? ((session.user as any).role === 'ADMIN' ? "/admin/dashboard" : "/dashboard") : "/auth/signin"} className={styles.iconButton}>
                            <UserIcon size={22} />
                            <span className={styles.iconText}>{session ? "Mon Compte" : "Connexion"}</span>
                        </Link>
                    </div>
                </div>
            </header>

            {/* Hamburger Menu Overlay */}
            <div
                className={`${styles.menuOverlay} ${isMenuOpen ? styles.menuVisible : ""}`}
                onClick={() => setIsMenuOpen(false)}
            >
                <div className={styles.menuDrawer} onClick={(e) => e.stopPropagation()}>
                    <button className={styles.closeButton} onClick={() => setIsMenuOpen(false)}>
                        <CloseIcon size={20} />
                    </button>

                    <div
                        className={styles.menuSearch}
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setIsMenuOpen(false); setForceOpenSearch(true); setTimeout(() => setForceOpenSearch(false), 300); }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                        <span className={styles.menuSearchInput} style={{ color: '#999', userSelect: 'none' }}>RECHERCHE</span>
                    </div>

                    <nav className={styles.menuNav}>
                        <ul>
                            {categories.filter(c => c.id !== 'ALL').map((cat) => {
                                const hasSubs = cat.sub_categories && cat.sub_categories.length > 0;
                                const isExpanded = expandedCategories.includes(cat.id);

                                return (
                                    <li key={cat.id}>
                                        <div className={styles.navItemHeader}>
                                            <Link
                                                href={`/shop?category=${cat.id}`}
                                                onClick={() => setIsMenuOpen(false)}
                                                className={styles.catLink}
                                            >
                                                {cat.name.charAt(0).toUpperCase() + cat.name.slice(1).toLowerCase()}
                                            </Link>
                                            {hasSubs && (
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); toggleCategory(cat.id); }}
                                                    className={styles.expandBtn}
                                                >
                                                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                                </button>
                                            )}
                                        </div>

                                        {hasSubs && isExpanded && (
                                            <ul className={styles.subMenu}>
                                                {cat.sub_categories.map((sub: any) => (
                                                    <li key={sub.id}>
                                                        <Link
                                                            href={`/shop?category=${cat.id}&sub_category=${sub.id}`}
                                                            onClick={() => setIsMenuOpen(false)}
                                                        >
                                                            {sub.name.toUpperCase()}
                                                        </Link>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    </nav>


                </div>
                <div className={styles.menuBackdrop} onClick={() => setIsMenuOpen(false)}></div>
            </div>
        </>
    );
}
