"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import styles from "./page.module.css";
import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useSession } from "next-auth/react";
import { ArrowUp, Instagram, MessageCircle, Send, X as CloseIcon, User as UserIcon } from "lucide-react";
import Swal from "sweetalert2";
import { useUser } from "@/components/Providers";

const LoadingScreen = dynamic(() => import('@/components/LoadingScreen'), { ssr: false });
const Header = dynamic(() => import('@/components/Header'), { ssr: false });
const Footer = dynamic(() => import('@/components/Footer'), { ssr: false });
const Search = dynamic(() => import('@/components/Search'), { ssr: false });

const Star = () => (
  <svg className={styles.starIcon} viewBox="0 0 24 24">
    <path d="M12 1.75l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.26L12 1.75z" />
  </svg>
);

const HeroSection = React.memo(({ cmsContent, heroImages, currentHeroIndex }: any) => (
  <section className={styles.hero}>
    <div className={styles.heroImageWrapper}>
      {heroImages.map((src: string, idx: number) => {
        const isVisible = idx === currentHeroIndex || idx === (currentHeroIndex + 1) % heroImages.length;
        if (!isVisible && idx !== 0) return null;
        return (
          <Image
            key={`${src}-${idx}`}
            src={src}
            alt={`Collection ${idx + 1}`}
            fill
            priority={idx === 0}
            quality={85}
            sizes="100vw"
            className={`${styles.heroImage} ${idx === currentHeroIndex ? styles.active : ""}`}
          />
        );
      })}
      <div className={styles.heroOverlay}>
      </div>
    </div>
  </section>
));

const FeaturedProductsSection = React.memo(({ products }: { products: any[] }) => {
  const reviews = [3, 5, 1, 4];
  return (
    <section className={styles.featuredProducts}>
      <h2 className={styles.featuredTitle}>DESIGN YOUR OWN</h2>
      <div className={styles.sliderWrapper}>
        <div className={styles.productsGrid} id="featuredGrid">
          {products.slice(0, 8).map((product, idx) => (
            <Link key={product.id} href={`/shop?q=${encodeURIComponent(product.name)}`} className={styles.productCard}>
              <div className={styles.imageContainer}>
                <Image
                  src={(product.images && product.images.length > 0) ? product.images[0] : (product.image_url || "/images/hero.png")}
                  alt={product.name}
                  fill
                  className={styles.primaryImage}
                  sizes="(max-width: 768px) 100vw, 25vw"
                  priority={idx === 0}
                />
                {product.images && product.images.length > 1 && (
                  <Image
                    src={product.images[1]}
                    alt={product.name}
                    fill
                    className={styles.secondaryImage}
                    sizes="(max-width: 768px) 100vw, 25vw"
                  />
                )}
                {product.stock === 0 && <span className={styles.soldOutBadge}>SOLD OUT</span>}
              </div>
              <h3 className={styles.productName}>{product.name}</h3>

              <p className={styles.productPrice}>{parseFloat(product.price).toFixed(0)}</p>
            </Link>
          ))}
        </div>
        <button
          className={`${styles.sliderArrow} ${styles.arrowLeft}`}
          onClick={() => {
            const el = document.getElementById('featuredGrid');
            if (el) el.scrollBy({ left: -300, behavior: 'smooth' });
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          className={`${styles.sliderArrow} ${styles.arrowRight}`}
          onClick={() => {
            const el = document.getElementById('featuredGrid');
            if (el) el.scrollBy({ left: 300, behavior: 'smooth' });
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

    </section>
  );
});
FeaturedProductsSection.displayName = 'FeaturedProductsSection';

const CategoriesSection = React.memo(({ categories }: { categories: any[] }) => (
  <section className={styles.categoryGrid}>
    {categories.filter(c => c.id !== "ALL").slice(0, 4).map((cat: any) => (
      <Link key={cat.id} href={`/shop?category=${cat.id}`} className={styles.categoryCard}>
        <Image
          src={cat.image_url || "/images/bags.png"}
          alt={cat.name}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className={styles.catImg}
          loading="lazy"
        />
        <div className={styles.cardContent}>
          <h3 className={styles.solidTitle}>{cat.name}</h3>
        </div>
      </Link>
    ))}
  </section>
));

const WelcomeSection = React.memo(() => (
  <section className={styles.welcomeSection}>
    <div className={styles.welcomeContainer}>
      <h2 className={styles.welcomeHeading}>WELCOME TO SEAURA</h2>
      <p className={styles.welcomeText}>
        Introducing our latest limited edition edit. Handcrafted in our studio and designed to make you feel confident, effortlessly refined and <em>entirely yourself.</em>
      </p>
    </div>
  </section>
));
WelcomeSection.displayName = 'WelcomeSection';

const InstagramSection = React.memo(({ cmsContent }: any) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollLeft = useRef(0);
  const [isHovered, setIsHovered] = useState(false);
  const scrollDirection = useRef(-1); // -1 for RTL, 1 for LTR
  const velocity = useRef(-0.8); // Current movement velocity
  const requestRef = useRef<number | null>(null);

  const posts = useMemo(() => {
    const keys = Object.keys(cmsContent)
      .filter(key => key.startsWith('instagram_post_'))
      .sort((a, b) => parseInt(a.split('_')[2]) - parseInt(b.split('_')[2]));

    // Triple the posts to ensure smooth looping even on large screens and during fast drags
    return [...keys, ...keys, ...keys].map((key, index) => {
      let postData = { image_url: "/images/hero.png", instagram_url: "https://instagram.com" };
      try { postData = JSON.parse(cmsContent[key]); } catch (e) { }
      return { key: `${key}-${index}`, ...postData };
    });
  }, [cmsContent]);

  const animate = useCallback(() => {
    if (!trackRef.current) return;

    if (!isDragging.current) {
      const track = trackRef.current;
      const totalWidth = track.scrollWidth;
      if (totalWidth <= 0) {
        requestRef.current = requestAnimationFrame(animate);
        return;
      }

      scrollLeft.current += velocity.current;
      const viewWidth = totalWidth / 3; // Because we tripled the items

      if (scrollLeft.current <= -viewWidth) {
        scrollLeft.current += viewWidth;
      } else if (scrollLeft.current >= 0) {
        scrollLeft.current -= viewWidth;
      }

      track.style.transform = `translateX(${scrollLeft.current}px)`;
    }

    requestRef.current = requestAnimationFrame(animate);
  }, []);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [animate]);

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDragging.current = true;
    const pageX = 'touches' in e ? e.touches[0].pageX : e.pageX;
    startX.current = pageX - scrollLeft.current;
    if (trackRef.current) {
      trackRef.current.style.transition = 'none';
      trackRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging.current || !trackRef.current) return;

    const pageX = 'touches' in e ? e.touches[0].pageX : (e as React.MouseEvent).pageX;
    const x = pageX - startX.current;

    // Update velocity based on drag direction for a natural feel when released
    const delta = x - scrollLeft.current;
    if (Math.abs(delta) > 0.1) {
      velocity.current = delta * 0.2 + (velocity.current * 0.8);
      velocity.current = Math.max(Math.min(velocity.current, 10), -10);

      // Update base direction based on drag direction
      if (Math.abs(velocity.current) > 0.5) {
        scrollDirection.current = velocity.current > 0 ? 1 : -1;
      }
    }

    scrollLeft.current = x;

    const track = trackRef.current;
    const viewWidth = track.scrollWidth / 3;

    if (scrollLeft.current <= -viewWidth) {
      scrollLeft.current += viewWidth;
      startX.current += viewWidth;
    } else if (scrollLeft.current >= 0) {
      scrollLeft.current -= viewWidth;
      startX.current -= viewWidth;
    }

    track.style.transform = `translateX(${scrollLeft.current}px)`;
  };

  const handleMouseUp = () => {
    isDragging.current = false;
    if (trackRef.current) {
      trackRef.current.style.cursor = 'grab';
    }
    // Gradually return to normal velocity if it's too fast, or maintain direction
    // If user dragged left to right, velocity will be positive.
    // If user dragged right to left, velocity will be negative.
    // We let it glide based on user input for a bit, then maybe slow back to normal
  };

  // Slowly return to base speed after drag
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDragging.current) {
        // Return to 0.8 (or -0.8) based on last swipe direction
        const targetSpeed = isHovered ? 0 : scrollDirection.current * 0.8;
        velocity.current += (targetSpeed - velocity.current) * 0.05;
      }
    }, 100);
    return () => clearInterval(interval);
  }, [isHovered]);

  return (
    <section
      className={styles.instagramFeed}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        handleMouseUp();
      }}
    >
      <div className={styles.instaTextContainer}>
        <h2 className={styles.instaHeading}>JOIN OUR JOURNEY</h2>
        <p className={styles.instaSubtext}>Keep up to date with everything With Lyberty - from our journey to the way each collection comes to life</p>
      </div>

      <div
        className={styles.instaTicker}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchMove={handleMouseMove}
        onTouchEnd={handleMouseUp}
      >
        <div
          className={styles.instaTickerTrack}
          ref={trackRef}
          style={{ cursor: 'grab', userSelect: 'none' }}
        >
          {posts.map((post) => (
            <Link
              key={post.key}
              href={post.instagram_url}
              target="_blank"
              className={styles.instaTickerItem}
              onClick={(e) => {
                // Prevent navigation if user was dragging
                if (Math.abs(velocity.current) > 2) e.preventDefault();
              }}
              draggable={false}
            >
              <Image
                src={post.image_url}
                alt="Instagram Post"
                fill
                sizes="(max-width: 768px) 300px, 400px"
                className={styles.instaImg}
                loading="lazy"
                draggable={false}
              />
              <div className={styles.instaOverlay}>
                <Instagram className={styles.instaIcon} size={24} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
});
InstagramSection.displayName = 'InstagramSection';

export default function Home() {
  const { data: session } = useSession();
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { userEmail, setUserEmail, setIsEmailModalOpen } = useUser();
  const [currentHeroIndex, setCurrentHeroIndex] = useState(0);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [cmsContent, setCmsContent] = useState<any>({});
  const [categories, setCategories] = useState<any[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [modalEmail, setModalEmail] = useState("");
  const [inlineEmail, setInlineEmail] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmittingChat, setIsSubmittingChat] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const heroImagesRef = useRef<string[]>([
    "/images/hero.png",
    "/images/clothing.png",
    "/images/bags.png",
    "/images/shoes.png"
  ]);
  const [heroImages, setHeroImages] = useState(heroImagesRef.current);

  const handleSubscribe = async (email: string, isModal: boolean) => {
    if (!email || !email.includes('@')) {
      Swal.fire({ icon: 'error', title: 'Erreur', text: 'Veuillez entrer une adresse e-mail valide.', confirmButtonColor: '#000' });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: `mutation($email: String!) { subscribeNewsletter(email: $email) }`, variables: { email } })
      });
      const data = await res.json();
      if (data.data?.subscribeNewsletter) {
        Swal.fire({ icon: 'success', title: 'Succès', text: 'Merci pour votre inscription !', confirmButtonColor: '#000' });
        setUserEmail(email);
        localStorage.setItem('seaura_user_email', email);
        if (isModal) setIsEmailModalOpen(false);
        setModalEmail("");
        setInlineEmail("");
      }
    } catch (error) {
      console.error(error);
      Swal.fire({ icon: 'error', title: 'Erreur', text: 'Une erreur est survenue. Veuillez réessayer.', confirmButtonColor: '#000' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fetch data — show loading screen for min 3s branding, but fetch in parallel
  useEffect(() => {
    const minTimer = new Promise<void>(resolve => setTimeout(resolve, 3000));

    const dataFetch = fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { 
          homeContent { key value } 
          categories { id name image_url sub_categories { id name } } 
          products(limit: 8) { id name price image_url images stock }
        }`
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.data?.homeContent) {
          const contentMap = data.data.homeContent.reduce((acc: any, item: any) => {
            acc[item.key] = item.value;
            return acc;
          }, {});
          setCmsContent(contentMap);
          const cmsImages: string[] = [];
          if (contentMap.hero_image_1) cmsImages.push(contentMap.hero_image_1);
          if (contentMap.hero_image_2) cmsImages.push(contentMap.hero_image_2);
          if (cmsImages.length > 0) {
            heroImagesRef.current = cmsImages;
            setHeroImages(cmsImages);
          }
        }
        if (data.data?.categories) setCategories(data.data.categories);
        if (data.data?.products) setFeaturedProducts(data.data.products);
      })
      .catch(console.error);

    Promise.all([minTimer, dataFetch]).then(() => setIsLoading(false));

    const storedEmail = localStorage.getItem('seaura_user_email');
    if (storedEmail) {
      setUserEmail(storedEmail);
    } else {
      setIsEmailModalOpen(true);
    }

    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
      setShowScrollTop(window.scrollY > 400);
    };
    const handleKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") setIsEmailModalOpen(false); };

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);

  // Hero slideshow — stable interval, reads length from ref
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentHeroIndex(prev => (prev + 1) % heroImagesRef.current.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);


  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const fetchChatHistory = async () => {
    if (!userEmail) return;
    try {
      const res = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `query($email: String!) { chatHistory(email: $email) { id content sender_role created_at } }`,
          variables: { email: userEmail }
        })
      });
      const data = await res.json();
      setChatMessages(data.data?.chatHistory || []);
    } catch (error) { console.error(error); }
  };

  useEffect(() => {
    if (!userEmail || !isChatOpen) return;
    fetchChatHistory();
    const interval = setInterval(fetchChatHistory, 5000);
    return () => clearInterval(interval);
  }, [userEmail, isChatOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !userEmail || isSubmittingChat) return;
    setIsSubmittingChat(true);
    try {
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($email: String!, $content: String!, $role: String!) { sendChatMessage(email: $email, content: $content, role: $role) { id } }`,
          variables: { email: userEmail, content: chatInput, role: 'CLIENT' }
        })
      });
      setChatInput("");
      fetchChatHistory();
    } catch (error) { console.error(error); }
    finally { setIsSubmittingChat(false); }
  };

  if (isLoading) {
    return <LoadingScreen duration={3000} onComplete={() => { }} />;
  }

  const handleIsSearchOpen = (val: boolean) => {
    setIsSearchOpen(val);
    if (val) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
  };

  return (
    <main className={styles.main}>
      {/* Shared Header Component */}
      <Header
        categories={categories}
        onCartClick={() => setIsChatOpen(true)} // Note: on home page, maybe they want cart or chat? Home page didn't have a cart drawer yet.
      />

      {/* Hero Section */}
      <HeroSection cmsContent={cmsContent} heroImages={heroImages} currentHeroIndex={currentHeroIndex} />

      {/* Category Grid */}
      <CategoriesSection categories={categories} />

      {/* Welcome Section */}
      <WelcomeSection />

      {/* Video Section */}
      <section className={styles.newsletter}>
        <video
          className={styles.newsletterVideo}
          src="https://withlyberty.com/cdn/shop/videos/c/vp/db413def4bfa4d05bbd6d17c0c1ade19/db413def4bfa4d05bbd6d17c0c1ade19.HD-1080p-7.2Mbps-73320821.mp4?v=0"
          autoPlay
          muted
          loop
          playsInline
        />
      </section>

      {/* Featured Products Section (Now under Video) */}
      <FeaturedProductsSection products={featuredProducts} />

      {/* Instagram Feed Section */}
      <InstagramSection cmsContent={cmsContent} />

      {/* Footer */}
      <Footer onSubscribe={async (email) => { await handleSubscribe(email, false); }} />


      {/* Chat Bubble & Window */}
      <button
        className={`${styles.chatBubble} ${isChatOpen ? styles.chatBubbleOpen : ""}`}
        onClick={() => {
          if (!userEmail) {
            setIsEmailModalOpen(true);
          } else {
            setIsChatOpen(!isChatOpen);
          }
        }}
      >
        {isChatOpen ? <CloseIcon size={24} /> : <MessageCircle size={24} />}
        {!isChatOpen && <span className={styles.chatBadge}>{userEmail ? "1" : "!"}</span>}
      </button>

      {isChatOpen && userEmail && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center text-white overflow-hidden border border-white/20 relative">
                <Image src="/images/hero.png" alt="Staff" fill sizes="40px" className="object-cover opacity-80" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-widest text-black/90">SEAURA Concierge</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Artisan Online</p>
                </div>
              </div>
            </div>
            <button onClick={() => setIsChatOpen(false)} className="text-black/30 hover:text-black">
              <CloseIcon size={18} />
            </button>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            <div className={styles.chatBody}>
              <div className="mb-6 opacity-30 text-center">
                <p className="text-[8px] font-black uppercase tracking-[0.2em]">Dialogue avec {userEmail}</p>
              </div>
              {chatMessages.map((msg: any) => (
                <div key={msg.id} className={`${styles.messageWrapper} ${msg.sender_role === 'ADMIN' ? styles.msgAdmin : styles.msgClient}`}>
                  <div className={styles.messageBubble}>
                    {msg.content}
                  </div>
                  <span className={styles.messageTime}>
                    {msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                  </span>
                </div>
              ))}
              {chatMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center p-10">
                  <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                    <MessageCircle size={20} className="text-gray-300" />
                  </div>
                  <p className="text-[10px] items-center font-bold text-gray-400 uppercase tracking-widest leading-relaxed">Comment pouvons-nous vous assister aujourd'hui ?</p>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            <div className={styles.chatFooter}>
              <input
                type="text"
                placeholder="Écrivez un message..."
                className={styles.chatInput}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
              />
              <button
                onClick={handleSendChat}
                disabled={isSubmittingChat}
                className={styles.sendBtn}
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Scroll to Top Button */}
      <button
        className={`${styles.scrollTop} ${showScrollTop ? styles.scrollTopVisible : ""}`}
        onClick={scrollToTop}
        aria-label="Scroll to top"
      >
        <ArrowUp size={24} />
      </button>
      {/* Discount Badge */}
      <div
        className={styles.discountBadge}
        onClick={() => setIsEmailModalOpen(true)}
      >
        10% OFF!
      </div>
    </main>
  );
}
