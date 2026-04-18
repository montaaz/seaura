"use client";

import { useState, useEffect, Suspense, Fragment } from "react";
import styles from "./shop.module.css";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, Send, X as CloseIcon, User as UserIcon, ArrowUp, Instagram, ShoppingBag, Heart, Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { useUser } from "@/components/Providers";
import LoadingScreen from "@/components/LoadingScreen";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

const Search = dynamic(() => import('@/components/Search'), { ssr: false });

export default function ShopListingPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <ShopListing />
        </Suspense>
    );
}

function ShopListing() {
    const { data: session } = useSession();
    const { userEmail, setUserEmail, setIsEmailModalOpen } = useUser();
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [cart, setCart] = useState<any[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string>("");
    const [isCartLoaded, setIsCartLoaded] = useState(false);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [cmsContent, setCmsContent] = useState<Record<string, string>>({});
    const searchParams = useSearchParams();
    const categoryQuery = searchParams.get('category');
    const termQuery = searchParams.get('q');

    const filteredProducts = products.filter(p => {
        const matchesCategory = searchQuery ? true : (activeFilter === "ALL" || String(p.category_id) === String(activeFilter));
        const matchesSearch = !searchQuery ||
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.description?.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    useEffect(() => {
        const fetchShopData = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: '{ products(limit: 100) { id name price image_url images category_id colors { name hex } sizes description } categories { id name image_url sub_categories { id name } } homeContent { key value } }'
                    })
                });
                const data = await res.json();
                if (data.data) {
                    setProducts(data.data.products || []);
                    setCategories([{ id: "ALL", name: "TOUT" }, ...data.data.categories || []]);
                    const cms: any = {};
                    (data.data.homeContent || []).forEach((item: any) => { cms[item.key] = item.value; });
                    setCmsContent(cms);
                }
            } catch (err) { }
            finally { setLoading(false); }
        };
        fetchShopData();
    }, []);

    useEffect(() => {
        const savedCart = localStorage.getItem('seaura_cart');
        if (savedCart) { try { setCart(JSON.parse(savedCart)); } catch (e) { } }
        let sid = localStorage.getItem('seaura_session_id');
        if (!sid) {
            sid = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('seaura_session_id', sid);
        }
        setSessionId(sid);
        setIsCartLoaded(true);
        const savedWishlist = localStorage.getItem('seaura_wishlist');
        if (savedWishlist) { try { setWishlist(JSON.parse(savedWishlist)); } catch (e) { } }
    }, []);

    useEffect(() => {
        if (!isCartLoaded || !sessionId) return;
        localStorage.setItem('seaura_cart', JSON.stringify(cart));
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation($sessionId: String!, $items: String!) { updateCart(sessionId: $sessionId, items: $items) }`,
                variables: { sessionId, items: JSON.stringify(cart) }
            })
        }).catch(() => { });
    }, [cart, sessionId, isCartLoaded]);

    useEffect(() => {
        if (categoryQuery && categories.length > 0) {
            const found = categories.find(c => c.id === categoryQuery || c.name.toLowerCase() === categoryQuery.toLowerCase());
            if (found) setActiveFilter(found.id);
        }
        if (termQuery) setSearchQuery(termQuery);
    }, [categoryQuery, termQuery, categories]);

    const addToCart = (product: any) => {
        if (!userEmail) { setIsEmailModalOpen(true); return; }
        setCart(prev => [...prev, { ...product, selectedSize: product.sizes?.[0] || "M", selectedColor: product.colors?.[0]?.name || "Noir" }]);
        setIsCartOpen(true);
    };

    const toggleWishlist = (product: any) => {
        setWishlist(prev => {
            const isExist = prev.find(p => p.id === product.id);
            const updated = isExist ? prev.filter(p => p.id !== product.id) : [...prev, { id: product.id, name: product.name, price: product.price, image_url: product.image_url }];
            localStorage.setItem('seaura_wishlist', JSON.stringify(updated));
            return updated;
        });
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const [isScrolled, setIsScrolled] = useState(false);
    useEffect(() => {
        const handleScroll = () => setIsScrolled(window.scrollY > 50);
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleIsSearchOpen = (val: boolean) => {
        setIsSearchOpen(val);
        document.body.style.overflow = val ? 'hidden' : 'auto';
    };

    if (loading) return <LoadingScreen duration={2000} onComplete={() => setLoading(false)} />;

    return (
        <div className={`${styles.shopContainer} ${isSearchOpen ? styles.noScroll : ""}`}>
            <Header 
                categories={categories}
                cartCount={cart.length}
                wishlistCount={wishlist.length}
                onCartClick={() => setIsCartOpen(true)}
            />

            <section className={styles.relatedSection} style={{ marginTop: '140px' }}>
                <div className={styles.sectionTitleBlock}>
                    <span className={styles.sectionTag}>PIÈCES D'EXCEPTION</span>
                    <h2 className={styles.sectionTitle}>
                        {activeFilter === 'ALL' ? 'Tout le Catalogue' : categories.find(c => c.id === activeFilter)?.name}
                    </h2>
                </div>
                <div className={styles.productGrid}>
                    {filteredProducts.map((p: any) => (
                        <div key={p.id} className={styles.productCard}>
                            <div className={styles.gridImageWrapper}>
                                <Link href={`/shop/${p.id}`} className="relative block w-full h-full">
                                    <Image 
                                        src={(p.images && p.images.length > 0) ? p.images[0] : (p.image_url || "/images/clothing.png")} 
                                        alt={p.name} 
                                        fill 
                                        className={styles.gridImg} 
                                        sizes="(max-width: 768px) 50vw, 25vw" 
                                    />
                                </Link>
                                {p.stock === 0 && <span className={styles.soldOutBadge}>SOLD OUT</span>}
                            </div>
                            <Link href={`/shop/${p.id}`} className={styles.gridInfo}>
                                <h4 className={styles.gridName}>{p.name}</h4>
                                <div className={styles.gridPrice}>£{p.price}</div>
                            </Link>
                        </div>
                    ))}
                    {filteredProducts.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-400 italic">Aucun produit trouvé dans cette catégorie.</div>
                    )}
                </div>
            </section>

            <Footer />

            <div className={`${styles.cartOverlay} ${isCartOpen ? styles.cartOverlayVisible : ""}`} onClick={() => setIsCartOpen(false)} />
            <div className={`${styles.cartDrawer} ${isCartOpen ? styles.cartDrawerOpen : ""}`}>
                <div className={styles.cartHeader}><h3>Your Bag</h3><button onClick={() => setIsCartOpen(false)}>Close —</button></div>
                <div className={styles.cartItems}>
                    {cart.map((item, idx) => (
                        <div key={idx} className={styles.cartItem}>
                            <button onClick={() => removeFromCart(idx)} className="mr-6 p-2 text-red-500/40 hover:text-red-600 transition-all"><Trash2 size={18} /></button>
                            <div className={styles.cartItemThumb} style={{ position: 'relative' }}>
                                <Image src={(item.images && item.images.length > 0) ? item.images[0] : (item.image_url || "/images/clothing.png")} alt={item.name} fill sizes="80px" className="object-cover" />
                            </div>
                            <div className={styles.cartItemInfo}><h4>{item.name}</h4><p>{item.selectedColor} — {item.selectedSize}</p><div className={styles.cartItemPrice}>{item.price} €</div></div>
                        </div>
                    ))}
                </div>
                {cart.length > 0 && <div className={styles.cartFooter}><button className={styles.checkoutBtn}>Finalize Collection</button></div>}
            </div>
        </div>
    );
}
