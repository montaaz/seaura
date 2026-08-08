"use client";

import { useState, useEffect, Suspense, Fragment } from "react";
import styles from "./shop.module.css";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, Send, X as CloseIcon, User as UserIcon, ArrowUp, Instagram, ShoppingBag, Heart, Plus, Trash2, ChevronRight, ChevronLeft, ChevronDown, Bookmark } from "lucide-react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { useUser } from "@/components/Providers";
import LoadingScreen from "@/components/LoadingScreen";
import { productMatchesColor } from "@/lib/colorMatch";
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
    const router = useRouter();
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
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [selectedColor, setSelectedColor] = useState<string | null>(null);

    const colors = [
        { name: "Marron", hex: "#7B5542" }, { name: "Noir", hex: "#000000" },
        { name: "Camel", hex: "#B68B5C" }, { name: "Ecru", hex: "#F5F5DC" },
        { name: "Vert", hex: "#32CD32" }, { name: "Bordeaux", hex: "#800020" },
        { name: "Beige", hex: "#F5F5DC" }, { name: "Naturel", hex: "#D2B48C" },
        { name: "Bleu", hex: "#1E90FF" }, { name: "Gris", hex: "#808080" },
        { name: "Jaune", hex: "#FFFF00" }, { name: "Multicolore", hex: "linear-gradient(45deg, red, blue, green, yellow)" },
        { name: "Orange", hex: "#FFA500" }, { name: "Doré", hex: "#FFD700" },
        { name: "Rouge", hex: "#FF0000" }, { name: "Rose", hex: "#FFC0CB" },
        { name: "Argent", hex: "#C0C0C0" }, { name: "Blanc", hex: "#FFFFFF" },
        { name: "Violet", hex: "#8A2BE2" }
    ];

    const selectedSwatch = selectedColor
        ? colors.find(c => c.name === selectedColor) ?? null
        : null;

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
        // Product color names are free-text from the admin, so match on canonical
        // name + hex proximity rather than exact string equality.
        const matchesColor = productMatchesColor(p.colors, selectedSwatch);

        return matchesCategory && matchesSearch && matchesColor;
    });

    useEffect(() => {
        const fetchShopData = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: '{ products(limit: 100) { id name price image_url images category_id colors { name hex } sizes description stock } categories { id name image_url sub_categories { id name } } homeContent { key value } }'
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
        if (!userEmail) setIsEmailModalOpen(true);
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

    const handleCheckout = () => {
        if (cart.length === 0) return;
        router.push('/checkout');
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

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (!(event.target as Element).closest(`.${styles.filterGroup}`)) {
                setActiveDropdown(null);
            }
        };
        if (activeDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [activeDropdown]);

    if (loading) return <LoadingScreen duration={2000} onComplete={() => setLoading(false)} />;

    return (
        <div className={`${styles.shopContainer} ${isSearchOpen ? styles.noScroll : ""}`}>
            <Header
                categories={categories}
                cartCount={cart.length}
                wishlistCount={wishlist.length}
                onCartClick={() => setIsCartOpen(true)}
                forceBlack={true}
            />

            <div className={styles.shopTopControls} style={{ marginTop: '40px' }}>
                <h2 className={styles.sectionTitle}>
                    {activeFilter === 'ALL' ? 'Tout Voir' : categories.find(c => c.id === activeFilter)?.name}
                </h2>

                <div className={styles.categoryNav}>
                    {categories.map((cat: any) => (
                        <span
                            key={cat.id}
                            className={`${styles.catNavItem} ${activeFilter === cat.id ? styles.catNavItemActive : ""}`}
                            onClick={() => setActiveFilter(cat.id)}
                        >
                            {cat.id === "ALL" ? "Tout Voir" : cat.name}
                        </span>
                    ))}
                </div>

                <div className={styles.filterBar}>
                    <div className={styles.filterGroup}>
                        <button
                            className={`${styles.filterBtn} ${activeDropdown === 'color' ? styles.filterBtnActive : ""} ${selectedSwatch ? styles.filterBtnSelected : ""}`}
                            onClick={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
                        >
                            {selectedSwatch ? (
                                <>
                                    <span
                                        className={styles.filterBtnSwatch}
                                        style={{
                                            background: selectedSwatch.hex,
                                            border: selectedSwatch.name === 'Blanc' ? '1px solid #ddd' : 'none',
                                        }}
                                    />
                                    {selectedSwatch.name}
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        aria-label="Effacer le filtre couleur"
                                        className={styles.filterBtnClear}
                                        onClick={(e) => { e.stopPropagation(); setSelectedColor(null); }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setSelectedColor(null);
                                            }
                                        }}
                                    >
                                        <CloseIcon size={12} />
                                    </span>
                                </>
                            ) : (
                                <>
                                    Couleur <ChevronDown size={14} className={activeDropdown === 'color' ? styles.rotateIcon : ""} />
                                </>
                            )}
                        </button>
                        {activeDropdown === 'color' && (
                            <div className={styles.dropdownContent}>
                                <div className={styles.colorFilterGrid}>
                                    {colors.map((color) => (
                                        <div
                                            key={color.name}
                                            className={`${styles.colorOption} ${selectedColor === color.name ? styles.colorOptionSelected : ""}`}
                                            onClick={() => setSelectedColor(selectedColor === color.name ? null : color.name)}
                                        >
                                            <div className={styles.colorSquare} style={{ background: color.hex, border: color.name === 'Blanc' ? '1px solid #ddd' : 'none' }} />
                                            <span className={styles.colorName}>{color.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.dropdownFooter}>
                                    <button className={styles.clearBtn} onClick={() => setSelectedColor(null)}>Effacer</button>
                                    <button className={styles.applyBtn} onClick={() => setActiveDropdown(null)}>Voir {filteredProducts.length} produits</button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
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
                        <div className={styles.gridInfo}>
                            <div className={styles.gridMainRow}>
                                <Link href={`/shop/${p.id}`} className={styles.gridName}>
                                    {p.name}
                                </Link>
                                <button
                                    onClick={() => toggleWishlist(p)}
                                    className={styles.wishlistBtn}
                                >
                                    <Heart
                                        size={14}
                                        className={wishlist.find((w: any) => w.id === p.id) ? styles.heartActive : ""}
                                    />
                                </button>
                            </div>
                            <div className={styles.gridPrice}>
                                {parseFloat(p.price).toFixed(2)} <span className={styles.currency}>dt</span>
                            </div>
                            {p.colors && p.colors.length > 0 && (
                                <div className={styles.gridColors}>
                                    {p.colors.slice(0, 3).map((c: any, idx: number) => (
                                        <div
                                            key={idx}
                                            className={styles.gridColorSwatch}
                                            style={{ backgroundColor: c.hex }}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {filteredProducts.length === 0 && (
                    <div className="col-span-full py-20 text-center text-gray-400 italic">Aucun produit trouvé dans cette catégorie.</div>
                )}
            </div>

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
                            <div className={styles.cartItemInfo}><h4>{item.name}</h4><p>{item.selectedColor} — {item.selectedSize}</p><div className={styles.cartItemPrice}>{item.price} TND</div></div>
                        </div>
                    ))}
                </div>
                {cart.length > 0 && (
                    <div className={styles.cartFooter}>
                        <div className={styles.cartTotal}>
                            <span>Subtotal</span>
                            <span>{cart.reduce((sum, item) => sum + (parseFloat(item.price) * (item.quantity || 1)), 0).toFixed(2)} TND</span>
                        </div>
                        <button className={styles.checkoutBtn} onClick={handleCheckout}>Finalize Collection</button>
                    </div>
                )}
            </div>
        </div>
    );
}
