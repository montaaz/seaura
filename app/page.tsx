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
        <h1 className={styles.heroTitle}>{cmsContent.hero_title || "NEW IN"}</h1>
        <a href="#" className={styles.heroLink}>{cmsContent.hero_link_text || "Plus d'informations"}</a>
      </div>
    </div>
  </section>
));

const FeaturedProductsSection = React.memo(({ products }: { products: any[] }) => {
  const reviews = [3, 5, 1, 4];
  return (
    <section className={styles.featuredProducts}>
      <h4 className={styles.featuredSubtitle}>FOR THE INDECISIVE SOUL</h4>
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
              </div>
              <h3 className={styles.productName}>{product.name}</h3>
              <div className={styles.productStars}>
                <div className={styles.starsOnly}>
                  <Star /><Star /><Star /><Star /><Star />
                </div>
                <span className={styles.productReviews}>({reviews[idx % 4] || 0})</span>
              </div>
              <p className={styles.productPrice}>from {parseFloat(product.price).toFixed(2)} €</p>
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
      <div className={styles.viewAllContainer}>
        <Link href="/shop" className={styles.viewAllLink}>
          SHOP ALL JEWELRY
        </Link>
      </div>
    </section>
  );
});
FeaturedProductsSection.displayName = 'FeaturedProductsSection';

const CategoriesSection = React.memo(({ cmsContent }: any) => (
  <section className={styles.categoryGrid}>
    <Link href="/shop?category=sacs" className={styles.categoryCard}>
      <Image src={cmsContent.cat1_image || "/images/bags.png"} alt="Sacs" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} loading="lazy" />
      <div className={styles.cardContent}>
        <h2 className={styles.hollowTitle}>{cmsContent.cat1_title || "Sacs"}</h2>
        <h3 className={styles.solidTitle}>{cmsContent.cat1_title?.toLowerCase() || "sacs"}</h3>
        <span className={styles.cardLink}>Plus d&apos;informations</span>
      </div>
    </Link>
    <Link href="/shop?category=vêtements" className={styles.categoryCard}>
      <Image src={cmsContent.cat2_image || "/images/clothing.png"} alt="Vêtements" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} loading="lazy" />
      <div className={styles.cardContent}>
        <h2 className={styles.hollowTitle}>{cmsContent.cat2_title || "Vêtements"}</h2>
        <h3 className={styles.solidTitle}>{cmsContent.cat2_title?.toLowerCase() || "vêtements"}</h3>
        <span className={styles.cardLink}>Plus d&apos;informations</span>
      </div>
    </Link>
    <Link href="/shop?category=bijoux" className={styles.categoryCard}>
      <Image src={cmsContent.cat3_image || "/images/jewelry.png"} alt="Bijoux" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} loading="lazy" />
      <div className={styles.cardContent}>
        <h2 className={styles.hollowTitle}>{cmsContent.cat3_title || "Bijoux"}</h2>
        <h3 className={styles.solidTitle}>{cmsContent.cat3_title?.toLowerCase() || "bijoux"}</h3>
        <span className={styles.cardLink}>Plus d&apos;informations</span>
      </div>
    </Link>
    <Link href="/shop?category=chaussures" className={styles.categoryCard}>
      <Image src={cmsContent.cat4_image || "/images/shoes.png"} alt="Chaussures" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} loading="lazy" />
      <div className={styles.cardContent}>
        <h2 className={styles.hollowTitle}>{cmsContent.cat4_title || "Chaussures"}</h2>
        <h3 className={styles.solidTitle}>{cmsContent.cat4_title?.toLowerCase() || "chaussures"}</h3>
        <span className={styles.cardLink}>Plus d&apos;informations</span>
      </div>
    </Link>
  </section>
));

const WelcomeSection = React.memo(() => (
  <section className={styles.welcomeSection}>
    <div className={styles.welcomeContainer}>
      <h2 className={styles.welcomeHeading}>WELCOME TO S E A U R A</h2>
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
    const minTimer = new Promise<void>(resolve => setTimeout(resolve, 1000));

    const dataFetch = fetch('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query { 
          homeContent { key value type } 
          categories { id name } 
          products { id name price image_url images }
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
      {/* Header */}
      <header className={`${styles.header} ${isScrolled || isSearchOpen ? styles.headerScrolled : ""}`}>
        <div className={styles.headerLayout}>
          <div className={styles.headerLeft}>
            <button className={styles.menuButton} onClick={() => setIsMenuOpen(true)}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <div className={styles.logo}>
              <Image 
                src="/logo1.png" 
                alt="SEAURA Logo" 
                width={150} 
                height={40} 
                className={styles.logoImg}
                priority
              />
            </div>
          </div>

          <div className={`${styles.headerCenter} ${isSearchOpen ? styles.searchActive : ""}`}>
            <Search isScrolled={isScrolled} onOpenChange={handleIsSearchOpen} />
          </div>

          <div className={styles.headerRight}>
            <Link href={session ? ((session.user as any).role === 'ADMIN' ? "/admin/dashboard" : "/dashboard") : "/auth/signin"} className={styles.iconButton}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="8" r="5" />
                <path d="M20 21a8 8 0 00-16 0" />
              </svg>
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          <div className={styles.menuBrand}>
            <Image 
              src="/logo1.png" 
              alt="SEAURA Logo" 
              width={120} 
              height={30} 
              className={styles.menuBrandImg}
            />
          </div>

          <nav className={styles.menuNav}>
            <ul>
              <li><Link href="/shop" onClick={() => setIsMenuOpen(false)}>NEW IN</Link></li>
              {categories.map((cat) => (
                <li key={cat.id}>
                  <Link
                    href={`/shop?category=${cat.name.toLowerCase()}`}
                    onClick={() => setIsMenuOpen(false)}
                  >
                    {cat.name.toUpperCase()}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className={styles.menuBackdrop} onClick={() => setIsMenuOpen(false)}></div>
      </div>

      {/* Hero Section */}
      <HeroSection cmsContent={cmsContent} heroImages={heroImages} currentHeroIndex={currentHeroIndex} />

      {/* Category Grid */}
      <CategoriesSection cmsContent={cmsContent} />

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
                value={inlineEmail}
                onChange={(e) => setInlineEmail(e.target.value)}
              />
              <button 
                className={styles.footerSubmitExact}
                onClick={() => handleSubscribe(inlineEmail, false)}
                disabled={isSubmitting}
              >
                {isSubmitting ? "..." : "SUBSCRIBE"}
              </button>
            </div>
          </div>

          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>SHOP WITH LYBERTY</h3>
            <ul className={styles.footerLinks}>
              <li><Link href="/shop">Shop All</Link></li>
              <li><Link href="/shop">New Arrivals</Link></li>
              <li><Link href="/shop">Design Your Own Jewellery</Link></li>
              <li><Link href="/shop">Charm Builder</Link></li>
              <li><Link href="/shop">Charms</Link></li>
              <li><Link href="/shop">Necklaces</Link></li>
              <li><Link href="/shop">Bracelets</Link></li>
              <li><Link href="/shop">Earrings</Link></li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>CUSTOMER SERVICE</h3>
            <ul className={styles.footerLinks}>
              <li><a href="#">Search</a></li>
              <li><a href="#">About</a></li>
              <li><a href="#">Shipping</a></li>
              <li><a href="#">Materials & Care</a></li>
              <li><a href="#">Charm Style Guide</a></li>
              <li><a href="#">Bracelet Size Guide</a></li>
              <li><a href="#">Returns</a></li>
              <li><a href="#">Contact</a></li>
              <li><a href="#">Terms & Conditions</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>

          <div className={styles.footerCol}>
            <h3 className={styles.footerHeading}>FOLLOW US</h3>
            <div className={styles.footerSocialIcons}>
              <a href="https://facebook.com" target="_blank" className={styles.socialIconLink}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg></a>
              <a href="https://instagram.com" target="_blank" className={styles.socialIconLink}><Instagram size={14} /></a>
              <a href="https://tiktok.com" target="_blank" className={styles.socialIconLink}><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.17-2.89-.6-4.11-1.47-.17-.12-.34-.24-.5-.38-.01 2.06.01 4.13-.01 6.19-.01 2.21-.55 4.47-1.92 6.13-1.43 1.75-3.69 2.78-5.96 2.82-2.45.03-5.02-.91-6.57-2.91-1.57-1.97-1.91-4.71-1.07-7.05.74-2.13 2.53-3.87 4.67-4.63.15-.05.3-.11.45-.15.01-.01.01-.02.02-.02V8.9c-.3.08-.59.18-.88.3-2.07.82-3.7 2.72-4.14 4.93-.41 1.95.03 4.1.99 5.81.99 1.79 2.91 3.1 4.96 3.32 1.45.17 2.97-.12 4.16-.99 1.4-1.01 2.23-2.65 2.22-4.4V3.01l.01-.01c-.13-.9-.37-1.81-.79-2.63-.12-.24-.25-.49-.39-.72l.01-.01z" /></svg></a>
            </div>
          </div>
        </div>
      </footer>


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
