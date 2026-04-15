"use client";

import { useState, useEffect, Suspense, Fragment } from "react";
import styles from "./shop.module.css";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ShoppingBag, Search, User, ArrowUp, Trash2, Plus, Heart, Instagram, ChevronRight, ChevronLeft } from "lucide-react";
import Swal from "sweetalert2";
import { useUser } from "@/components/Providers";
import LoadingScreen from "@/components/LoadingScreen";

export default function ShopPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <Shop />
        </Suspense>
    );
}

function Shop() {
    const { data: session } = useSession();
    const { userEmail, setIsEmailModalOpen } = useUser();
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState("ALL");
    const [cart, setCart] = useState<any[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string>("");
    const [isCartLoaded, setIsCartLoaded] = useState(false);
    const [wishlist, setWishlist] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [cmsContent, setCmsContent] = useState<Record<string, string>>({});
    const searchParams = useSearchParams();
    const categoryQuery = searchParams.get('category');
    const termQuery = searchParams.get('q');


    const filteredProducts = products.filter(p => {
        // If searching, ignore category filter to show all matches across shop
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
                        query: '{ products(limit: 20) { id name price image_url images category_id colors { name hex } sizes } categories { id name } homeContent { key value } }'
                    })
                });
                const data = await res.json();
                if (data.data) {
                    setProducts(data.data.products || []);
                    setCategories([{ id: "ALL", name: "TOUT" }, ...data.data.categories || []]);
                    const cms: any = {};
                    (data.data.homeContent || []).forEach((item: any) => {
                        cms[item.key] = item.value;
                    });
                    setCmsContent(cms);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, []);

    useEffect(() => {
        const savedCart = localStorage.getItem('seaura_cart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                console.error("Cart load error:", e);
            }
        }
        
        let sid = localStorage.getItem('seaura_session_id');
        if (!sid) {
            sid = Math.random().toString(36).substring(2, 15);
            localStorage.setItem('seaura_session_id', sid);
        }
        setSessionId(sid);
        setIsCartLoaded(true);

        const savedWishlist = localStorage.getItem('seaura_wishlist');
        if (savedWishlist) {
            try {
                setWishlist(JSON.parse(savedWishlist));
            } catch (e) {
                console.error("Wishlist load error:", e);
            }
        }
    }, []);

    useEffect(() => {
        if (session?.user?.email) {
            const fetchDbWishlist = async () => {
                try {
                    const res = await fetch('/api/graphql', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            query: `query($email: String!) { wishlist(email: $email) }`,
                            variables: { email: session.user.email }
                        })
                    });
                    const data = await res.json();
                    if (data.data?.wishlist) {
                        const dbItems = JSON.parse(data.data.wishlist);
                        if (dbItems.length > 0) {
                            setWishlist(dbItems);
                            localStorage.setItem('seaura_wishlist', JSON.stringify(dbItems));
                        }
                    }
                } catch (e) { }
            };
            fetchDbWishlist();
        }
    }, [session]);

    useEffect(() => {
        if (!isCartLoaded || !sessionId) return;
        
        localStorage.setItem('seaura_cart', JSON.stringify(cart));
        
        const syncCart = async () => {
            try {
                await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `mutation($sessionId: String!, $items: String!) { updateCart(sessionId: $sessionId, items: $items) }`,
                        variables: { sessionId, items: JSON.stringify(cart) }
                    })
                });
            } catch (err) { }
        };

        syncCart();
    }, [cart, sessionId, isCartLoaded]);

    useEffect(() => {
        if (categoryQuery && categories.length > 0) {
            const found = categories.find(c =>
                c.id === categoryQuery ||
                c.name.toLowerCase() === categoryQuery.toLowerCase()
            );
            if (found) setActiveFilter(found.id);
        }
        if (termQuery) {
            setSearchQuery(termQuery);
        }
    }, [categoryQuery, termQuery, categories]);

    const toggleWishlist = (product: any) => {
        setWishlist(prev => {
            const isExist = prev.find(p => p.id === product.id);
            let updated;
            if (isExist) {
                updated = prev.filter(p => p.id !== product.id);
            } else {
                updated = [...prev, { id: product.id, name: product.name, price: product.price, image_url: product.image_url }];
            }
            localStorage.setItem('seaura_wishlist', JSON.stringify(updated));
            if (session?.user?.email) {
                fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `mutation($email: String!, $items: String!) { updateWishlist(email: $email, items: $items) }`,
                        variables: { email: session.user.email, items: JSON.stringify(updated) }
                    })
                }).catch(() => { });
            }
            return updated;
        });
    };

    const addToCart = (product: any) => {
        if (!userEmail) {
            setIsEmailModalOpen(true);
            return;
        }
        setCart(prev => [...prev, {
            ...product,
            selectedSize: selectedSize,
            selectedColor: selectedColorName
        }]);
        setIsCartOpen(true);
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        const { value: formValues } = await Swal.fire({
            title: 'Finalize Collection',
            html:
                '<div style="text-align: left; padding: 0 10px">' +
                '<label style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999">Email Address</label>' +
                '<input id="swal-email" class="swal2-input" placeholder="Email" style="width: 100%; border-radius: 15px; border: 1px solid #eee; height: 50px; font-size: 14px">' +
                '<label style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999; margin-top: 15px; display: block">Phone Number</label>' +
                '<input id="swal-phone" class="swal2-input" placeholder="Phone" style="width: 100%; border-radius: 15px; border: 1px solid #eee; height: 50px; font-size: 14px">' +
                '</div>',
            focusConfirm: false,
            confirmButtonText: 'ORDER NOW',
            confirmButtonColor: '#000',
            showCancelButton: true,
            cancelButtonText: 'CANCEL',
            preConfirm: () => {
                const email = (document.getElementById('swal-email') as HTMLInputElement).value;
                const phone = (document.getElementById('swal-phone') as HTMLInputElement).value;
                if (!email || !phone) {
                    Swal.showValidationMessage('Please enter both Email and Phone Number');
                }
                return { email, phone };
            }
        });

        if (!formValues) return;

        try {
            const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
            const items = cart.map(item => ({
                id: item.id,
                name: item.name,
                price: parseFloat(item.price),
                selectedSize: item.selectedSize,
                selectedColor: item.selectedColor,
                quantity: 1
            }));

            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($total: Float!, $items: [OrderItemInput!]!, $email: String, $phone: String) {
                        createOrder(total: $total, items: $items, email: $email, phone: $phone) { id }
                    }`,
                    variables: {
                        total,
                        items,
                        email: formValues.email,
                        phone: formValues.phone
                    }
                })
            });
            const data = await res.json();
            if (data.data?.createOrder) {
                Swal.fire({
                    icon: 'success',
                    title: 'Collection Finalisée !',
                    text: 'Votre commande est enregistrée avec succès.',
                    confirmButtonColor: '#000'
                });
                setCart([]);
                setIsCartOpen(false);
            }
        } catch (err) {
            console.error(err);
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Erreur lors de la commande.',
                confirmButtonColor: '#000'
            });
        }
    };

    const [count, setCount] = useState(1);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [activeProduct, setActiveProduct] = useState<any>(null);
    const [selectedSize, setSelectedSize] = useState("M");
    const [selectedColorName, setSelectedColorName] = useState("Noir");
    const [selectedImageIndex0, setSelectedImageIndex0] = useState(0);
    const [selectedImageIndex1, setSelectedImageIndex1] = useState(0);

    useEffect(() => {
        setSelectedImageIndex0(0);
        setSelectedImageIndex1(0);
    }, [activeFilter, searchQuery]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
            setShowScrollTop(window.scrollY > 500);
            if (window.scrollY > 400 && filteredProducts.length > 0) {
                setActiveProduct(filteredProducts[0]);
            } else {
                setActiveProduct(null);
            }
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [filteredProducts]);

    useEffect(() => {
        if (filteredProducts.length > 0 && filteredProducts[0].sizes?.length > 0) {
            setSelectedSize(filteredProducts[0].sizes[0]);
        }
    }, [filteredProducts]);

    useEffect(() => {
        if (filteredProducts.length > 0 && filteredProducts[0].colors?.length > 0) {
            setSelectedColorName(filteredProducts[0].colors[0].name);
        }
    }, [filteredProducts]);

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    if (loading) {
        return <LoadingScreen duration={3000} onComplete={() => setLoading(false)} />;
    }

    return (
        <div className={`${styles.shopContainer} ${isSearchOpen ? styles.noScroll : ""}`}>
            <header className={styles.stickyHeader}>
                <div className={styles.announcementBar}>
                    Complimentary Worldwide Shipping on all orders above 200€
                </div>

                <nav className={`${styles.nav} ${isScrolled || isSearchOpen ? styles.navScrolled : ""}`}>
                    <div className="flex-1">
                        <Link href="/" className={styles.navLogo}>SEAURA</Link>
                    </div>

                    <div className={`${styles.headerCenter} ${isSearchOpen ? styles.searchActive : ""}`}>
                        <div className={styles.searchWrapper}>
                            <div className={styles.searchPill} onClick={() => setIsSearchOpen(true)}>
                                <Search 
                                    size={18} 
                                    className="text-inherit"
                                />
                                <input
                                    type="text"
                                    placeholder="RECHERCHE"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyPress={(e) => { if (e.key === 'Enter') setIsSearchOpen(false); }}
                                    className={styles.searchInput}
                                    autoFocus={isSearchOpen}
                                />
                            </div>
                            {isSearchOpen && (
                                <button className={styles.cancelButton} onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}>
                                    Annuler
                                </button>
                            )}
                        </div>
                    </div>

                    <div className={`${styles.navIcons} flex-1 justify-end items-center`}>
                        <div className={`${styles.navIcon} ${styles.mobileSearch}`} onClick={() => setIsSearchOpen(true)}>
                            <Search size={24} />
                        </div>
                        <Link href="/auth/signin" className={styles.navIcon} aria-label="Account"><User size={24} /></Link>
                        <Link href={session ? "/dashboard?tab=wishlist" : "/dashboard"} className="relative cursor-pointer group hover:scale-110 transition-transform">
                            <Heart size={26} className={`${styles.navIcon} ${wishlist.length > 0 ? "text-pink-500 fill-pink-500" : ""}`} />
                            {wishlist.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-white text-black text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-black/10">
                                    {wishlist.length}
                                </span>
                            )}
                        </Link>
                        <div className="relative cursor-pointer group hover:scale-110 transition-transform" onClick={() => setIsCartOpen(true)}>
                            <ShoppingBag size={26} className={styles.navIcon} />
                            {cart.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-white text-black text-[9px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-black/10">
                                    {cart.length}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Search Modal Content */}
                    {isSearchOpen && (
                        <div className={styles.searchModalContent}>
                            <div className={styles.searchInner}>
                                {searchQuery && (
                                    <div className="mb-10 animate-in fade-in slide-in-from-top-4 duration-500">
                                        <h4 className={styles.trendingTitle}>RÉSULTATS DIRECTS ({filteredProducts.length})</h4>
                                        <div className="flex flex-col gap-4 max-h-[300px] overflow-y-auto pr-4 custom-scrollbar">
                                            {filteredProducts.slice(0, 5).map(p => (
                                                <div 
                                                    key={p.id} 
                                                    className="flex items-center gap-6 p-4 rounded-3xl bg-gray-50/50 hover:bg-gray-100 transition-all cursor-pointer group"
                                                    onClick={() => { setIsSearchOpen(false); scrollToTop(); }}
                                                >
                                                    <div className="w-16 h-16 bg-white rounded-2xl overflow-hidden relative shadow-sm transition-transform group-hover:scale-105">
                                                        <Image src={(p.images && p.images.length > 0) ? p.images[0] : (p.image_url || "/images/clothing.png")} alt={p.name} fill className="object-cover" />
                                                    </div>
                                                    <div className="flex-1">
                                                        <h5 className="text-sm font-bold tracking-tight">{p.name}</h5>
                                                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{p.price} €</p>
                                                    </div>
                                                    <ChevronRight size={18} className="text-gray-300 transition-transform group-hover:translate-x-1" />
                                                </div>
                                            ))}
                                            {filteredProducts.length === 0 && (
                                                <div className="py-12 text-center">
                                                    <p className="text-gray-300 font-light italic">Aucun produit ne correspond à votre recherche.</p>
                                                </div>
                                            )}
                                        </div>
                                        {filteredProducts.length > 0 && (
                                            <button 
                                                onClick={() => setIsSearchOpen(false)}
                                                className="mt-8 w-full py-4 bg-black text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:opacity-80 transition-opacity"
                                            >
                                                Voir tout le catalogue
                                            </button>
                                        )}
                                    </div>
                                )}

                                <h4 className={styles.trendingTitle}>RECHERCHES TENDANCES</h4>
                                <div className={styles.tagCloud}>
                                    {['sacs', 'chaussures', 'bijoux', 'vêtements', 'nouvelle collection', 'bijoux en acier', 'sacs à main'].map(tag => (
                                        <span 
                                            key={tag} 
                                            className={styles.searchTag}
                                            onClick={() => { setSearchQuery(tag); }}
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </nav>
            </header>

            <section className={styles.shopHero}>
                <Image
                    src="/images/hero.png"
                    alt="Boutique Hero"
                    fill
                    className={styles.heroImg}
                    sizes="100vw"
                    priority
                />
                <div className={styles.heroContent}>
                    <h1 className="animate-in fade-in slide-in-from-bottom-8 duration-1000">Exclusives</h1>
                    <div className={styles.breadcrumbs}>Boutique / Collection 2026</div>
                </div>
            </section>

            {filteredProducts.length > 0 && (
                <section className={styles.featuredProduct}>
                    <div className={styles.productDisplay}>
                        <div className={styles.mainImageWrapper}>
                            <Image
                                src={(filteredProducts[0].images && filteredProducts[0].images.length > 0) ? filteredProducts[0].images[selectedImageIndex0] : (filteredProducts[0].image_url || "/images/clothing.png")}
                                alt={filteredProducts[0].name}
                                fill
                                className={styles.featuredImg}
                                sizes="(max-width: 1200px) 100vw, 55vw"
                                priority
                                quality={85}
                            />
                        </div>
                        {filteredProducts[0].images && filteredProducts[0].images.length > 1 && (
                            <div className={styles.thumbnailGallery}>
                                {filteredProducts[0].images.map((img: string, idx: number) => (
                                    <div 
                                        key={idx} 
                                        className={`${styles.thumbnail} ${selectedImageIndex0 === idx ? styles.thumbnailActive : ""}`}
                                        onClick={() => setSelectedImageIndex0(idx)}
                                    >
                                        <Image src={img} alt={`Thumbnail ${idx}`} fill className="object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className={styles.productDetails}>
                        <span className={styles.detailCategory}>BOUTIQUE / ARTISAN MASTERPIECE</span>
                        <h2 className={styles.detailTitle}>{filteredProducts[0].name}</h2>
                        <div className={styles.detailPrice}>{filteredProducts[0].price} €</div>
                        <p className={styles.priceDescription}>
                            {filteredProducts[0].description || "An artisan masterpiece blending timeless elegance with exceptional Tunisian materials."}
                        </p>
                        <div className={styles.optionSection}>
                            <span className={styles.optionLabel}>Size Selection</span>
                            <div className={styles.optionGrid}>
                                {(filteredProducts[0].sizes?.length > 0 ? filteredProducts[0].sizes : ["S", "M", "L", "XL"]).map((size: string) => (
                                    <button
                                        key={size}
                                        className={`${styles.optionBtn} ${selectedSize === size ? styles.optionBtnActive : ""}`}
                                        onClick={() => setSelectedSize(size)}
                                    >
                                        {size}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className={styles.optionSection}>
                            <span className={styles.optionLabel}>Color Palette</span>
                            <div className={styles.colorGrid}>
                                {(filteredProducts[0].colors?.length > 0 ? filteredProducts[0].colors : [{ name: "Noir", hex: "#000000" }]).map((color: any) => (
                                    <button
                                        key={color.name}
                                        className={`${styles.colorBtn} ${selectedColorName === color.name ? styles.colorBtnActive : ""}`}
                                        style={{ backgroundColor: color.hex }}
                                        onClick={() => setSelectedColorName(color.name)}
                                        aria-label={color.name}
                                    />
                                ))}
                                <span className={styles.colorIndicator}>{selectedColorName} Edition</span>
                            </div>
                        </div>
                        <div className={styles.actionRow}>
                            <div className={styles.qtySelector}>
                                <button className={styles.qtyBtn} onClick={() => setCount(Math.max(1, count - 1))}>−</button>
                                <span className="font-bold text-lg">{count}</span>
                                <button className={styles.qtyBtn} onClick={() => setCount(count + 1)}>+</button>
                            </div>
                            <div className="flex gap-4 w-full">
                                <button className={styles.buyBtn} onClick={() => addToCart(filteredProducts[0])}>Add to Collection</button>
                                <button 
                                    onClick={() => toggleWishlist(filteredProducts[0])}
                                    className="w-14 h-14 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all active:scale-95"
                                >
                                    <Heart size={20} className={wishlist.find(p => p.id === filteredProducts[0].id) ? "fill-pink-500 text-pink-500" : "text-gray-300"} />
                                </button>
                            </div>
                        </div>
                        <ul className={styles.featureList}>
                            <li className={styles.featureItem}><Plus size={14} /> 100% Organic Mediterranean Cotton</li>
                            <li className={styles.featureItem}><Plus size={14} /> Hand-finished details by local artisans</li>
                        </ul>
                    </div>
                </section>
            )}

            <section className={styles.portraitSection}>
                <div className={styles.tickerWrapper}>
                    {[...Array(2)].map((_, loopIdx) => (
                        <Fragment key={loopIdx}>
                            {[
                                { src: "/images/hero.png", title: "Artisan Heritage" },
                                { src: "/images/bags.png", title: "Leather Essence" },
                                { src: "/images/clothing.png", title: "Modern Silhouette" },
                                { src: "/images/jewelry.png", title: "Ethereal Metal" },
                                { src: "/images/shoes.png", title: "Urban Step" },
                                { src: "/images/newsletter_bg.png", title: "Timeless Texture" }
                            ].map((img, idx) => (
                                <div key={`${loopIdx}-${idx}`} className={styles.tickerCard}>
                                    <Image
                                        src={img.src}
                                        alt={img.title}
                                        fill
                                        sizes="(max-width: 768px) 50vw, 33vw"
                                        className={styles.tickerImg}
                                    />
                                    <div className={styles.tickerOverlay}>
                                        <span className="text-[10px] tracking-[0.5em] uppercase font-black mb-2 block opacity-60">Seaura Studio</span>
                                        <h4 className="text-3xl font-light italic">{img.title}</h4>
                                    </div>
                                </div>
                            ))}
                        </Fragment>
                    ))}
                </div>
            </section>

            {filteredProducts.length > 1 && (
                <section className={styles.featuredProduct}>
                    <div className={styles.productDisplay}>
                        <div className={styles.mainImageWrapper}>
                            <Image
                                src={(filteredProducts[1].images && filteredProducts[1].images.length > 0) ? filteredProducts[1].images[selectedImageIndex1] : (filteredProducts[1].image_url || "/images/clothing.png")}
                                alt={filteredProducts[1].name}
                                fill
                                className={styles.featuredImg}
                                sizes="(max-width: 1200px) 100vw, 55vw"
                            />
                        </div>
                        {filteredProducts[1].images && filteredProducts[1].images.length > 1 && (
                            <div className={styles.thumbnailGallery}>
                                {filteredProducts[1].images.map((img: string, idx: number) => (
                                    <div 
                                        key={idx} 
                                        className={`${styles.thumbnail} ${selectedImageIndex1 === idx ? styles.thumbnailActive : ""}`}
                                        onClick={() => setSelectedImageIndex1(idx)}
                                    >
                                        <Image src={img} alt={`Thumbnail ${idx}`} fill className="object-cover" />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className={styles.productDetails}>
                        <span className={styles.detailCategory}>ÉDITION LIMITÉE / 2026</span>
                        <h2 className={styles.detailTitle}>{filteredProducts[1].name}</h2>
                        <div className={styles.detailPrice}>{filteredProducts[1].price} €</div>
                        <p className={styles.priceDescription}>{filteredProducts[1].description || "The balance between tradition and modern utility."}</p>
                        <div className={styles.actionRow}>
                            <button className={`${styles.buyBtn} ${styles.discoverBtn}`} onClick={() => addToCart(filteredProducts[1])}>Add Selection</button>
                        </div>
                    </div>
                </section>
            )}

            <div className={`${styles.stickyBarContainer} ${activeProduct ? styles.stickyBarVisible : ""}`}>
                <div className={styles.stickyInfo}>
                    <div className={styles.stickyThumb} style={{ position: 'relative' }}>
                        <Image src={(activeProduct?.images && activeProduct.images.length > 0) ? activeProduct.images[0] : (activeProduct?.image_url || "/images/clothing.png")} alt="Preview" fill sizes="60px" className="object-cover" />
                    </div>
                    <div className={styles.stickyText}>
                        <h4>{activeProduct?.name}</h4>
                        <p>{selectedColorName} • {selectedSize}</p>
                    </div>
                </div>
                <div className="flex items-center">
                    <span className={styles.stickyPrice}>{activeProduct?.price} €</span>
                    <button className={styles.stickyBtn} onClick={() => addToCart(activeProduct)}>Quick Add</button>
                </div>
            </div>

            <section className={styles.relatedSection}>
                <div className={styles.sectionTitleBlock}>
                    <span className={styles.sectionTag}>PIÈCES D'EXCEPTION</span>
                    <h2 className={styles.sectionTitle}>Curated Selection</h2>
                </div>
                <div className={styles.productGrid}>
                    {filteredProducts.slice(0).map((p: any) => (
                        <div key={p.id} className={styles.productCard}>
                            <div className={styles.gridImageWrapper}>
                                <div className={styles.onSale}>NEW</div>
                                <Image
                                    src={(p.images && p.images.length > 0) ? p.images[0] : (p.image_url || "/images/clothing.png")}
                                    alt={p.name}
                                    fill
                                    className={styles.gridImg}
                                    sizes="(max-width: 768px) 100vw, 25vw"
                                />
                                <div className={styles.cardQuickAdd}>
                                    <div className="flex gap-2 w-full p-4">
                                        <button onClick={() => addToCart(p)} className="flex-1 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-full hover:scale-105 active:scale-95 transition-all">Add +</button>
                                        <button 
                                            onClick={(e) => { e.preventDefault(); toggleWishlist(p); }} 
                                            className="w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all"
                                        >
                                            <Heart size={16} className={wishlist.find(w => w.id === p.id) ? "fill-pink-500 text-pink-500" : "text-black/20"} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                            <Link href={`/product/${p.id}`} className={styles.gridInfo}>
                                <span className={styles.gridCat}>{categories.find(c => c.id === p.category_id)?.name || "BOUTIQUE"}</span>
                                <h4 className={styles.gridName}>{p.name}</h4>
                                <div className={styles.gridPrice}>{p.price} €</div>
                            </Link>
                        </div>
                    ))}
                </div>
            </section>

            <section className={styles.infoSection}>
                <div className={styles.infoDescription}>At SEAURA, we believe in beauty without compromise. Rediscover the essentials through our artisanal creations.</div>
                <div className={styles.decorativeImageWrapper} style={{ position: 'relative' }}>
                    <Image src="/images/clothing.png" alt="Craftsmanship" fill sizes="(max-width: 1200px) 100vw, 50vw" className="object-cover" />
                </div>
            </section>

            <section className={styles.instagramFeed}>
                <h2 className={styles.instaHeading}>Follow us on Instagram</h2>
                <div className={styles.instaSliderContainer}>
                    <button
                        className={`${styles.instaArrow} ${styles.instaArrowLeft}`}
                        onClick={() => {
                            const el = document.getElementById('instaTrack');
                            if (el) el.scrollBy({ left: -370, behavior: 'smooth' });
                        }}
                        aria-label="Scroll left"
                    >
                        &#8592;
                    </button>
                    <div className={styles.instaFeedWrapper} id="instaTrack">
                        {Object.keys(cmsContent)
                            .filter(key => key.startsWith('instagram_post_'))
                            .sort((a, b) => parseInt(a.split('_')[2]) - parseInt(b.split('_')[2]))
                            .map(key => {
                                let postData = { image_url: "/images/hero.png", instagram_url: "https://instagram.com" };
                                try { postData = JSON.parse(cmsContent[key]); } catch (e) { }
                                return (
                                    <Link key={key} href={postData.instagram_url} target="_blank" className={styles.instaCard}>
                                        <Image src={postData.image_url} alt="Instagram Post" fill sizes="(max-width: 768px) 75vw, 320px" className={styles.instaImg} loading="lazy" />
                                        <div className={styles.instaOverlay}><Instagram className={styles.instaIcon} size={32} /></div>
                                    </Link>
                                );
                            })}
                    </div>
                    <button
                        className={`${styles.instaArrow} ${styles.instaArrowRight}`}
                        onClick={() => {
                            const el = document.getElementById('instaTrack');
                            if (el) el.scrollBy({ left: 370, behavior: 'smooth' });
                        }}
                        aria-label="Scroll right"
                    >
                        &#8594;
                    </button>
                </div>
            </section>

            <footer className={styles.footerMain}>
                <div className={styles.footerContent} style={{ position: 'relative', zIndex: 10 }}>
                    <div>
                        <h2 className={styles.newsletterTitle}>Newsletter.</h2>
                        <div className={styles.newsletterInputWrapper}>
                            <input type="email" placeholder="Your email address" className={styles.newsletterInput} />
                            <button className={styles.newsletterBtn} aria-label="Subscribe"><ChevronRight size={35} /></button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-[10px] tracking-[0.5em] uppercase opacity-30 mb-10 font-black">Company</h3>
                        <ul className={styles.footerLinks}>
                            <li><Link href="/">Home</Link></li>
                            <li><Link href="/shop">Collections</Link></li>
                            <li><Link href="/">Our Journal</Link></li>
                            <li><Link href="/">Contact</Link></li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-[10px] tracking-[0.5em] uppercase opacity-30 mb-10 font-black">Categories</h3>
                        <ul className={styles.footerLinks}>
                            {categories.filter(c => c.id !== 'ALL').slice(0, 4).map((cat: any) => (
                                <li key={cat.id}><Link href={`/shop?category=${cat.name.toLowerCase()}`}>{cat.name}</Link></li>
                            ))}
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-[10px] tracking-[0.5em] uppercase opacity-30 mb-10 font-black">Follow Us</h3>
                        <div className="flex flex-col gap-4">
                            <a href="#" className="text-[11px] tracking-widest hover:opacity-100 transition opacity-40 font-bold">INSTAGRAM</a>
                            <a href="#" className="text-[11px] tracking-widest hover:opacity-100 transition opacity-40 font-bold">FACEBOOK</a>
                            <a href="#" className="text-[11px] tracking-widest hover:opacity-100 transition opacity-40 font-bold">PINTEREST</a>
                        </div>
                    </div>
                </div>
                <div className={styles.footerBottom} style={{ position: 'relative', zIndex: 10 }}>
                    <p>© 2026 S E A U R A — Digital Boutique / Artisanal Heritage.</p>
                    <div className="flex gap-10 opacity-60">
                        <a href="#">Privacy Policy</a>
                        <a href="#">Terms of Service</a>
                    </div>
                </div>
            </footer>

            <div className={`${styles.cartOverlay} ${isCartOpen ? styles.cartOverlayVisible : ""}`} onClick={() => setIsCartOpen(false)} />
            <div className={`${styles.cartDrawer} ${isCartOpen ? styles.cartDrawerOpen : ""}`}>
                <div className={styles.cartHeader}>
                    <h3>Your Bag</h3>
                    <button className={styles.closeCart} onClick={() => setIsCartOpen(false)}>Close —</button>
                </div>
                <div className={styles.cartItems}>
                    {cart.length === 0 ? (
                        <div className={styles.emptyCart}>Your collection is empty.</div>
                    ) : (
                        cart.map((item, idx) => (
                            <div key={idx} className={styles.cartItem}>
                                <button onClick={() => removeFromCart(idx)} className="mr-6 p-2 text-red-500/40 hover:text-red-600 transition-all"><Trash2 size={18} /></button>
                                <div className={styles.cartItemThumb} style={{ position: 'relative' }}>
                                    <Image src={(item.images && item.images.length > 0) ? item.images[0] : (item.image_url || "/images/clothing.png")} alt={item.name} fill sizes="80px" className="object-cover" />
                                </div>
                                <div className={styles.cartItemInfo}>
                                    <h4>{item.name}</h4>
                                    <p>{item.selectedColor} — {item.selectedSize}</p>
                                    <div className={styles.cartItemPrice}>{item.price} €</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
                {cart.length > 0 && (
                    <div className={styles.cartFooter}>
                        <div className={styles.cartTotal}>
                            <span>Subtotal</span>
                            <span>{cart.reduce((sum, item) => sum + parseFloat(item.price), 0).toFixed(2)} €</span>
                        </div>
                        <button className={styles.checkoutBtn} onClick={handleCheckout}>Finalize Collection</button>
                    </div>
                )}
            </div>

            <button className={`${styles.scrollTop} ${showScrollTop ? styles.scrollTopVisible : ""}`} onClick={scrollToTop} aria-label="Scroll to top">
                <ArrowUp size={24} />
            </button>
        </div>
    );
}
