"use client";

import { useState, useEffect, Suspense, Fragment } from "react";
import styles from "../shop.module.css";
import Image from "next/image";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { MessageCircle, Send, X as CloseIcon, User as UserIcon, ArrowUp, Instagram, ShoppingBag, Heart, Plus, Trash2, ChevronRight, ChevronLeft } from "lucide-react";
import dynamic from "next/dynamic";
import Swal from "sweetalert2";
import { useUser } from "@/components/Providers";
import LoadingScreen from "@/components/LoadingScreen";
import Header from "@/components/Header";

const Search = dynamic(() => import('@/components/Search'), { ssr: false });

export default function ShopProductPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <ShopDetail />
        </Suspense>
    );
}

function ShopDetail() {
    const { id: productId } = useParams();
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

    // The product for THIS page
    const [product, setProduct] = useState<any>(null);

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
                    const fetchedProducts = data.data.products || [];
                    setProducts(fetchedProducts);
                    const found = fetchedProducts.find((p: any) => p.id === productId);
                    if (found) setProduct(found);

                    setCategories([{ id: "ALL", name: "TOUT" }, ...data.data.categories || []]);
                    const cms: any = {};
                    (data.data.homeContent || []).forEach((item: any) => { cms[item.key] = item.value; });
                    setCmsContent(cms);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchShopData();
    }, [productId]);

    useEffect(() => {
        const savedCart = localStorage.getItem('seaura_cart');
        if (savedCart) {
            try { setCart(JSON.parse(savedCart)); } catch (e) { }
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
            try { setWishlist(JSON.parse(savedWishlist)); } catch (e) { }
        }
    }, []);

    useEffect(() => {
        if (product && product.id) {
            const pid = String(product.id);
            const saved = localStorage.getItem('seaura_viewed');
            let viewed = saved ? JSON.parse(saved) : [];
            // Remove if already exists and move to front
            viewed = viewed.filter((id: any) => String(id) !== pid);
            viewed.unshift(pid);
            localStorage.setItem('seaura_viewed', JSON.stringify(viewed.slice(0, 10)));
        }
    }, [product]);

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
            const found = categories.find(c => c.id === categoryQuery || c.name.toLowerCase() === categoryQuery.toLowerCase());
            if (found) setActiveFilter(found.id);
        }
        if (termQuery) setSearchQuery(termQuery);
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
            return updated;
        });
    };

    const addToCart = (product: any) => {
        if (!userEmail) { setIsEmailModalOpen(true); return; }
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
            html: `
                <div style="text-align: left; padding: 0 10px">
                    <label style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999">Email Address</label>
                    <input id="swal-email" class="swal2-input" placeholder="Email" style="width: 100%; border-radius: 15px; border: 1px solid #eee; height: 50px; font-size: 14px">
                    <label style="font-size: 10px; font-weight: bold; text-transform: uppercase; color: #999; margin-top: 15px; display: block">Phone Number</label>
                    <input id="swal-phone" class="swal2-input" placeholder="Phone" style="width: 100%; border-radius: 15px; border: 1px solid #eee; height: 50px; font-size: 14px">
                </div>
            `,
            focusConfirm: false,
            confirmButtonText: 'ORDER NOW',
            confirmButtonColor: '#000',
            showCancelButton: true,
            cancelButtonText: 'CANCEL',
            preConfirm: () => {
                const email = (document.getElementById('swal-email') as HTMLInputElement).value;
                const phone = (document.getElementById('swal-phone') as HTMLInputElement).value;
                if (!email || !phone) { Swal.showValidationMessage('Please enter both Email and Phone Number'); }
                return { email, phone };
            }
        });
        if (!formValues) return;
        try {
            const total = cart.reduce((sum, item) => sum + parseFloat(item.price), 0);
            const items = cart.map(item => ({ id: item.id, name: item.name, price: parseFloat(item.price), selectedSize: item.selectedSize, selectedColor: item.selectedColor, quantity: 1 }));
            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($total: Float!, $items: [OrderItemInput!]!, $email: String, $phone: String) {
                        createOrder(total: $total, items: $items, email: $email, phone: $phone) { id }
                    }`,
                    variables: { total, items, email: formValues.email, phone: formValues.phone }
                })
            });
            const data = await res.json();
            if (data.data?.createOrder) {
                Swal.fire({ icon: 'success', title: 'Collection Finalisée !', text: 'Votre commande est enregistrée avec succès.', confirmButtonColor: '#000' });
                setCart([]);
                setIsCartOpen(false);
            }
        } catch (err) { }
    };

    const [count, setCount] = useState(1);
    const [isScrolled, setIsScrolled] = useState(false);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [activeProduct, setActiveProduct] = useState<any>(null);
    const [selectedSize, setSelectedSize] = useState("M");
    const [selectedColorName, setSelectedColorName] = useState("Noir");
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [historyItems, setHistoryItems] = useState<any[]>([]);

    useEffect(() => {
        if (products.length > 0) {
            const saved = localStorage.getItem('seaura_viewed');
            if (!saved) return;
            const ids = JSON.parse(saved || '[]');
            const viewed = ids
                .map((id: any) => products.find((p: any) => String(p.id) === String(id)))
                .filter(Boolean)
                .slice(0, 3);
            setHistoryItems(viewed);
        }
    }, [products, productId]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
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
        if (product) {
            if (product.sizes?.length > 0) setSelectedSize(product.sizes[0]);
            if (product.colors?.length > 0) setSelectedColorName(product.colors[0].name);
        }
    }, [product]);

    const scrollToTop = () => { window.scrollTo({ top: 0, behavior: "smooth" }); };
    const handleIsSearchOpen = (val: boolean) => {
        setIsSearchOpen(val);
        document.body.style.overflow = val ? 'hidden' : 'auto';
    };

    if (loading) return <LoadingScreen duration={3000} onComplete={() => setLoading(false)} />;
    if (!product) return <div className={styles.emptyCart}>Produit Non Trouvé</div>;

    return (
        <div className={`${styles.shopContainer} ${isSearchOpen ? styles.noScroll : ""}`}>
            <Header
                categories={categories}
                cartCount={cart.length}
                wishlistCount={wishlist.length}
                onCartClick={() => setIsCartOpen(true)}
            />

            {/* PRODUCT DETAIL SECTION */}
            <section className={styles.featuredProduct} style={{ marginTop: '120px' }}>
                <div className={styles.productDisplay}>
                    <div className={styles.mainImageWrapper}>
                        <Image src={(product.images && product.images.length > 0) ? product.images[selectedImageIndex] : (product.image_url || "/images/clothing.png")} alt={product.name} width={1200} height={1500} className={styles.featuredImg} priority quality={85} />
                    </div>
                    {product.images && product.images.length > 1 && (
                        <div className={styles.thumbnailGallery}>
                            {product.images.map((img: string, idx: number) => (
                                <div key={idx} className={`${styles.thumbnail} ${selectedImageIndex === idx ? styles.thumbnailActive : ""}`} onClick={() => setSelectedImageIndex(idx)}>
                                    <Image src={img} alt={`Thumbnail ${idx}`} fill className="object-cover" />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div className={styles.productDetails}>
                    <span className={styles.detailCategory}>BOUTIQUE / ARTISAN MASTERPIECE</span>
                    <h2 className={styles.detailTitle}>{product.name}</h2>
                    <div className={styles.detailPrice}>{product.price} €</div>
                    <p className={styles.priceDescription}>{product.description || "An artisan masterpiece blending timeless elegance with exceptional Tunisian materials."}</p>
                    <div className={styles.optionSection}>
                        <span className={styles.optionLabel}>Size Selection</span>
                        <div className={styles.optionGrid}>
                            {(product.sizes?.length > 0 ? product.sizes : ["S", "M", "L", "XL"]).map((size: string) => (
                                <button key={size} className={`${styles.optionBtn} ${selectedSize === size ? styles.optionBtnActive : ""}`} onClick={() => setSelectedSize(size)}>{size}</button>
                            ))}
                        </div>
                    </div>
                    <div className={styles.optionSection}>
                        <span className={styles.optionLabel}>Color Palette</span>
                        <div className={styles.colorGrid}>
                            {(product.colors?.length > 0 ? product.colors : [{ name: "Noir", hex: "#000000" }]).map((color: any) => (
                                <button key={color.name} className={`${styles.colorBtn} ${selectedColorName === color.name ? styles.colorBtnActive : ""}`} style={{ backgroundColor: color.hex }} onClick={() => setSelectedColorName(color.name)} aria-label={color.name} />
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
                            <button className={styles.buyBtn} onClick={() => addToCart(product)}>Add to Card</button>
                            <button onClick={() => toggleWishlist(product)} className="w-14 h-14 rounded-full border border-gray-100 flex items-center justify-center hover:bg-gray-50 transition-all active:scale-95">
                                <Heart size={20} className={wishlist.find(p => p.id === product.id) ? "fill-pink-500 text-pink-500" : "text-gray-300"} />
                            </button>
                        </div>
                    </div>
                    <ul className={styles.featureList}>
                        <li className={styles.featureItem}><Plus size={14} /> 100% Organic Mediterranean Cotton</li>
                        <li className={styles.featureItem}><Plus size={14} /> Hand-finished details by local artisans</li>
                    </ul>
                </div>
            </section>

            {/* TICKER SECTION - CATEGORY NAVIGATION */}
            <section className={styles.portraitSection}>
                <div className={styles.tickerWrapper}>
                    {[...Array(2)].map((_, loopIdx) => (
                        <Fragment key={loopIdx}>
                            {categories.filter(c => c.id !== "ALL").map((cat, idx) => (
                                <Link href={`/shop?category=${cat.id}`} key={`${loopIdx}-${idx}`} className={styles.tickerCard}>
                                    <Image 
                                        src={cat.image_url || "/images/hero.png"} 
                                        alt={cat.name} 
                                        fill 
                                        sizes="450px"
                                        className={styles.tickerImg} 
                                        unoptimized={cat.image_url?.startsWith('data:')}
                                        priority={idx < 4}
                                    />
                                    <div className={styles.tickerOverlay}>
                                        <span className="text-[10px] tracking-[0.5em] uppercase font-black mb-2 block opacity-60 text-white">Explorez la Collection</span>
                                        <h4 className="text-3xl font-light italic text-white">{cat.name}</h4>
                                    </div>
                                </Link>
                            ))}
                        </Fragment>
                    ))}
                </div>
            </section>

            {/* RELATED SECTION */}
            {historyItems.length > 0 && (
                <section className={styles.relatedSection}>
                    <div className={styles.sectionTitleBlock}>
                        <span className={styles.sectionTag}>PIÈCES D'EXCEPTION</span>
                        <h2 className={styles.sectionTitle}>Continue Exploring</h2>
                    </div>
                    <div className={`${styles.productGrid} ${styles.threeColGrid}`}>
                        {historyItems.map((p: any) => (
                            <div key={p.id} className={styles.productCard}>
                                <div className={styles.gridImageWrapper}>
                                    <Image src={(p.images && p.images.length > 0) ? p.images[0] : (p.image_url || "/images/clothing.png")} alt={p.name} fill className={styles.gridImg} sizes="(max-width: 768px) 100vw, 25vw" />
                                    <div className={styles.cardQuickAdd}>
                                        <div className="flex gap-2 w-full p-4">
                                            <button onClick={() => addToCart(p)} className="flex-1 bg-black text-white text-[10px] font-black uppercase tracking-widest py-3 rounded-full hover:scale-105 active:scale-95 transition-all">Add +</button>
                                            <button onClick={(e) => { e.preventDefault(); toggleWishlist(p); }} className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center shadow-lg hover:scale-110 active:scale-90 transition-all">
                                                <Heart size={16} className={wishlist.find((w: any) => w.id === p.id) ? "fill-pink-500 text-pink-500" : "text-black/20"} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                <Link href={`/shop/${p.id}`} className={styles.gridInfo}>
                                    <span className={styles.gridCat}>{categories.find(c => c.id === p.category_id)?.name || "BOUTIQUE"}</span>
                                    <h4 className={styles.gridName}>{p.name}</h4>
                                    <div className={styles.gridPrice}>{p.price} €</div>
                                </Link>
                            </div>
                        ))}
                    </div>
                </section>
            )}





            {/* FOOTER */}
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
                </div>
                <div className={styles.footerBottom} style={{ position: 'relative', zIndex: 10 }}>
                    <p>© 2026 S E A U R A — Digital Boutique / Artisanal Heritage.</p>
                </div>
            </footer>

            {/* STICKY BAR */}
            <div className={`${styles.stickyBarContainer} ${activeProduct ? styles.stickyBarVisible : ""}`}>
                <div className={styles.stickyInfo}>
                    <div className={styles.stickyThumb} style={{ position: 'relative' }}>
                        <Image src={(activeProduct?.images && activeProduct.images.length > 0) ? activeProduct.images[0] : (activeProduct?.image_url || "/images/clothing.png")} alt="Preview" fill sizes="60px" className="object-cover" />
                    </div>
                    <div className={styles.stickyText}><h4>{activeProduct?.name}</h4><p>{selectedColorName} • {selectedSize}</p></div>
                </div>
                <div className="flex items-center">
                    <span className={styles.stickyPrice}>{activeProduct?.price} €</span>
                    <button className={styles.stickyBtn} onClick={() => addToCart(activeProduct)}>Quick Add</button>
                </div>
            </div>

            {/* CART DRAWER */}
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
                {cart.length > 0 && (
                    <div className={styles.cartFooter}>
                        <div className={styles.cartTotal}><span>Subtotal</span><span>{cart.reduce((sum, item) => sum + parseFloat(item.price), 0).toFixed(2)} €</span></div>
                        <button className={styles.checkoutBtn} onClick={handleCheckout}>Finalize Collection</button>
                    </div>
                )}
            </div>

            <button className={`${styles.scrollTop} ${showScrollTop ? styles.scrollTopVisible : ""}`} onClick={scrollToTop}><ArrowUp size={24} /></button>
        </div>
    );
}
