"use client";

import React, { useState, useEffect, useRef, Fragment } from "react";
import styles from "./page.module.css";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { ArrowUp, Instagram, MessageCircle, Send, X as CloseIcon, User as UserIcon } from "lucide-react";
import Swal from "sweetalert2";
import { useUser } from "@/components/Providers";
import LoadingScreen from "@/components/LoadingScreen";

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
  const [initialLoading, setInitialLoading] = useState(true);

  const [modalEmail, setModalEmail] = useState("");
  const [inlineEmail, setInlineEmail] = useState("");
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [isSubmittingChat, setIsSubmittingChat] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [chatInterval, setChatInterval] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const defaultImages = [
    "/images/hero.png",
    "/images/clothing.png",
    "/images/bags.png",
    "/images/shoes.png"
  ];

  const [heroImages, setHeroImages] = useState(defaultImages);

  const handleSubscribe = async (email: string, isModal: boolean) => {
    if (!email || !email.includes('@')) {
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Veuillez entrer une adresse e-mail valide.',
        confirmButtonColor: '#000'
      });
      return;
    }

    setIsSubmitting(true);
    try {
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
          icon: 'success',
          title: 'Succès',
          text: 'Merci pour votre inscription !',
          confirmButtonColor: '#000'
        });
        setUserEmail(email);
        localStorage.setItem('seaura_user_email', email);
        if (isModal) setIsEmailModalOpen(false);
        setModalEmail("");
        setInlineEmail("");
      }
    } catch (error) {
      console.error(error);
      Swal.fire({
        icon: 'error',
        title: 'Erreur',
        text: 'Une erreur est survenue. Veuillez réessayer.',
        confirmButtonColor: '#000'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            query: '{ homeContent { key value type } categories { id name } }' 
          })
        });

        const data = await res.json();

        if (data.data?.homeContent) {
          const contentMap = data.data.homeContent.reduce((acc: any, item: any) => {
            acc[item.key] = item.value;
            return acc;
          }, {});
          setCmsContent(contentMap);
          const cmsImages = [];
          if (contentMap.hero_image_1) cmsImages.push(contentMap.hero_image_1);
          if (contentMap.hero_image_2) cmsImages.push(contentMap.hero_image_2);
          if (cmsImages.length > 0) setHeroImages(cmsImages);
        }

        if (data.data?.categories) {
          setCategories(data.data.categories);
        }
      } catch (e) {
        console.error("Home data fetch error:", e);
      } finally {
        // Minimum delay for branding visibility
        setTimeout(() => {
          setInitialLoading(false);
          // Only show modal after loading is done and if user is not subscribed
          const storedEmail = localStorage.getItem('seaura_user_email');
          if (storedEmail) {
            setUserEmail(storedEmail);
          } else {
            setIsEmailModalOpen(true);
          }
        }, 500); // Faster reveal once data is ready
      }
    };

    fetchData();

    const handleScroll = () => {
      const scrolled = window.scrollY > 50;
      const showTop = window.scrollY > 400;
      
      setIsScrolled(prev => prev !== scrolled ? scrolled : prev);
      setShowScrollTop(prev => prev !== showTop ? showTop : prev);
    };

    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsEmailModalOpen(false);
    };

    window.addEventListener("scroll", handleScroll);
    window.addEventListener("keydown", handleKeydown);

    const timer = setInterval(() => {
      setCurrentHeroIndex((prev) => (prev + 1) % heroImages.length);
    }, 4000);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("keydown", handleKeydown);
      clearInterval(timer);
    };
  }, [heroImages.length, setUserEmail, setIsEmailModalOpen]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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
    if (userEmail && isChatOpen) {
      fetchChatHistory();
      const interval = setInterval(fetchChatHistory, 3000);
      setChatInterval(interval);
      return () => clearInterval(interval);
    }
  }, [userEmail, isChatOpen]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  const handleSendChat = async () => {
    if (!chatInput.trim() || !userEmail || isSubmittingChat) return;
    setIsSubmittingChat(true);
    try {
      await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation($email: String!, $content: String!, $role: String!) { 
            sendChatMessage(email: $email, content: $content, role: $role) { id }
          }`,
          variables: { email: userEmail, content: chatInput, role: 'CLIENT' }
        })
      });
      setChatInput("");
      fetchChatHistory();
    } catch (error) { console.error(error); }
    finally { setIsSubmittingChat(false); }
  };

  if (initialLoading) return <LoadingScreen />;

  return (
    <main className={`${styles.main} ${isSearchOpen ? styles.noScroll : ""}`}>
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
              {cmsContent.brand_logo || "S E A U R A"}
            </div>
            {/* <Link href="/shop" className="hidden lg:block ml-10 text-[10px] font-bold tracking-[0.3em] uppercase opacity-40 hover:opacity-100 transition-all">BOUTIQUE</Link> */}
          </div>

          <div className={`${styles.headerCenter} ${isSearchOpen ? styles.searchActive : ""}`}>
            <div className={styles.searchWrapper}>
              <div className={styles.searchPill} onClick={() => setIsSearchOpen(true)}>
                <svg className={styles.searchIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="RECHERCHE"
                  className={styles.searchInput}
                  autoFocus={isSearchOpen}
                />
              </div>
              {isSearchOpen && (
                <button className={styles.cancelButton} onClick={() => setIsSearchOpen(false)}>
                  Annuler
                </button>
              )}
            </div>
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

        {/* Search Modal Content */}
        {isSearchOpen && (
          <div className={styles.searchModalContent}>
            <div className={styles.searchInner}>
              <h4 className={styles.trendingTitle}>RECHERCHES TENDANCES</h4>
              <div className={styles.tagCloud}>
                {['sacs', 'chaussures', 'bijoux', 'vêtements', 'nouvelle collection', 'bijoux en acier', 'sacs à main'].map(tag => (
                  <span key={tag} className={styles.searchTag}>{tag}</span>
                ))}
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hamburger Menu Overlay */}
      <div className={`${styles.menuOverlay} ${isMenuOpen ? styles.menuVisible : ""}`}>
        <div className={styles.menuDrawer}>
          <button className={styles.closeButton} onClick={() => setIsMenuOpen(false)}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
          <nav className={styles.menuNav}>
            <ul>
              <li><Link href="/shop" onClick={() => setIsMenuOpen(false)}>BOUTIQUE</Link></li>
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
      <section className={styles.hero}>
        <div className={styles.heroImageWrapper}>
          {heroImages.map((src, idx) => {
            // Only render current and next image for performance
            const isVisible = idx === currentHeroIndex || idx === (currentHeroIndex + 1) % heroImages.length;
            if (!isVisible && idx !== 0) return null; // Always keep the first prioritized image if needed, or better, only render when visible
            
            return (
              <Image
                key={src}
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

      {/* Category Grid */}
      <section className={styles.categoryGrid}>
        <Link href="/shop?category=sacs" className={styles.categoryCard}>
          <Image src={cmsContent.cat1_image || "/images/bags.png"} alt="Sacs" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} />
          <div className={styles.cardContent}>
            <h2 className={styles.hollowTitle}>{cmsContent.cat1_title || "Sacs"}</h2>
            <h3 className={styles.solidTitle}>{cmsContent.cat1_title?.toLowerCase() || "sacs"}</h3>
            <span className={styles.cardLink}>Plus d&apos;informations</span>
          </div>
        </Link>
        <Link href="/shop?category=vêtements" className={styles.categoryCard}>
          <Image src={cmsContent.cat2_image || "/images/clothing.png"} alt="Vêtements" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} />
          <div className={styles.cardContent}>
            <h2 className={styles.hollowTitle}>{cmsContent.cat2_title || "Vêtements"}</h2>
            <h3 className={styles.solidTitle}>{cmsContent.cat2_title?.toLowerCase() || "vêtements"}</h3>
            <span className={styles.cardLink}>Plus d&apos;informations</span>
          </div>
        </Link>
        <Link href="/shop?category=bijoux" className={styles.categoryCard}>
          <Image src={cmsContent.cat3_image || "/images/jewelry.png"} alt="Bijoux" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} />
          <div className={styles.cardContent}>
            <h2 className={styles.hollowTitle}>{cmsContent.cat3_title || "Bijoux"}</h2>
            <h3 className={styles.solidTitle}>{cmsContent.cat3_title?.toLowerCase() || "bijoux"}</h3>
            <span className={styles.cardLink}>Plus d&apos;informations</span>
          </div>
        </Link>
        <Link href="/shop?category=chaussures" className={styles.categoryCard}>
          <Image src={cmsContent.cat4_image || "/images/shoes.png"} alt="Chaussures" fill sizes="(max-width: 768px) 100vw, 50vw" className={styles.catImg} />
          <div className={styles.cardContent}>
            <h2 className={styles.hollowTitle}>{cmsContent.cat4_title || "Chaussures"}</h2>
            <h3 className={styles.solidTitle}>{cmsContent.cat4_title?.toLowerCase() || "chaussures"}</h3>
            <span className={styles.cardLink}>Plus d&apos;informations</span>
          </div>
        </Link>
      </section>

      {/* Newsletter Section */}
      <section className={styles.newsletter}>
        <div className={styles.newsletterContent}>
          <h2 className={styles.newsletterTitle}>{cmsContent.newsletter_title || "Abonnez-vous à notre newsletter"}</h2>
          <form className={styles.newsletterForm} onSubmit={(e) => { e.preventDefault(); handleSubscribe(inlineEmail, false); }}>
            <input
              type="email"
              placeholder="E-mail"
              className={styles.newsletterInput}
              value={inlineEmail}
              onChange={(e) => setInlineEmail(e.target.value)}
            />
            <div className={styles.checkboxWrapper}>
              <input type="checkbox" id="terms" required />
              <label htmlFor="terms">Je déclare avoir lu et compris la <a>Politique de confidentialité</a>.</label>
            </div>
            <button className={styles.newsletterSubmit} disabled={isSubmitting}>
              {isSubmitting ? "ENVOI..." : "INSCRIVEZ-VOUS"}
            </button>
          </form>
        </div>
      </section>

      {/* Instagram Feed Section */}
      <section className={styles.instagramFeed}>
        <h2 className={styles.instaHeading}>Follow us on Instagram</h2>
        
        <div className={styles.instaFeedWrapper}>
          <div className={styles.instaTicker}>
            {[...Array(2)].map((_, loopIdx) => (
              <Fragment key={loopIdx}>
                {Object.keys(cmsContent)
                  .filter(key => key.startsWith('instagram_post_'))
                  .sort((a, b) => {
                    const numA = parseInt(a.split('_')[2]);
                    const numB = parseInt(b.split('_')[2]);
                    return numA - numB;
                  })
                  .map(key => {
                    let postData = { image_url: "/images/hero.png", instagram_url: "https://instagram.com" };
                    try {
                      postData = JSON.parse(cmsContent[key]);
                    } catch (e) { }

                    return (
                      <Link
                        key={`${loopIdx}-${key}`}
                        href={postData.instagram_url}
                        target="_blank"
                        className={styles.instaCard}
                      >
                        <Image
                          src={postData.image_url}
                          alt={`Instagram Post`}
                          fill
                          sizes="320px"
                          className={styles.instaImg}
                        />
                        <div className={styles.instaOverlay}>
                          <Instagram className={styles.instaIcon} size={32} />
                        </div>
                      </Link>
                    );
                  })}
              </Fragment>
            ))}
          </div>
        </div>

        <a href="https://instagram.com" target="_blank" className={styles.joinUsBtn}>
          <Instagram size={20} /> JOIN US
        </a>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerGrid}>
          <div className={styles.footerCol}>
            <h3>Obtenir de l&apos;aide</h3>
            <ul>
              <li><a href="#">Commandes</a></li>
              <li><a href="#">Livraisons</a></li>
              <li><a href="#">Retours</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h3>Entreprise</h3>
            <ul>
              <li><a href="#">À propos</a></li>
              <li><a href="#">Carrières</a></li>
              <li><a href="#">Boutiques</a></li>
            </ul>
          </div>
          <div className={styles.footerCol}>
            <h3>Politiques</h3>
            <ul>
              <li><a href="#">Confidentialité</a></li>
              <li><a href="#">Cookies</a></li>
              <li><a href="#">Mentions légales</a></li>
            </ul>
          </div>
        </div>

        <div className={styles.socialRow}>
          <div className={styles.socialIcons}>
            <div className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" /></svg>
            </div>
            <div className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1112.63 8 4 4 0 0116 11.37z" /><line x1="17.5" y1="6.5" x2="17.51" y2="6.5" /></svg>
            </div>
            <div className={styles.socialIcon}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </div>
            <div className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 00-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 00-1.94 2A29 29 0 001 11.75a29 29 0 00.46 5.33A2.78 2.78 0 003.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 001.94-2 29 29 0 00.46-5.33 29 29 0 00-.46-5.33zM9.75 15.02V8.48L15.45 11.75l-5.7 3.27z" /></svg>
            </div>
            <div className={styles.socialIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 00-7.1 17.1c.1-.1.3-.1.4-.2l1.2-4.5c.1-.2.1-.5.1-.7v-.1a2.8 2.8 0 014.2-2.5 2.8 2.8 0 011.6 3v.1l-1.3 5.4c0 .3.2.5.5.5a10 10 0 0010-10c0-5.5-4.5-10-10-10z" /></svg>
            </div>
          </div>
        </div>

        <div className={styles.footerBottom}>
          <p>© 2026 SEAURA</p>
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
    </main>
  );
}
