"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import styles from "./help.module.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LoadingScreen from "@/components/LoadingScreen";
import { Search, Info, Truck, Sparkles, Mail, ShieldCheck, ChevronRight } from "lucide-react";

const SECTIONS = [
    { id: "about", label: "About", icon: <Info size={18} /> },
    { id: "shipping", label: "Shipping", icon: <Truck size={18} /> },
    { id: "materials", label: "Materials & Care", icon: <Sparkles size={18} /> },
    { id: "contact", label: "Contact", icon: <Mail size={18} /> },
    { id: "privacy", label: "Privacy Policy", icon: <ShieldCheck size={18} /> },
];

export default function HelpPage() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <HelpContent />
        </Suspense>
    );
}

function HelpContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [activeSection, setActiveSection] = useState("about");
    const [cmsContent, setCmsContent] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchShopData = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: '{ homeContent { key value } }'
                    })
                });
                const data = await res.json();
                if (data.data) {
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
        const section = searchParams.get("section");
        if (section && SECTIONS.find(s => s.id === section)) {
            setActiveSection(section);
        }
    }, [searchParams]);

    const handleSectionChange = (id: string) => {
        setActiveSection(id);
        router.push(`/help?section=${id}`, { scroll: false });
    };

    if (loading) return <LoadingScreen />;

    const getContent = (keyTitle: string, defaultTitle: string, keyBody: string, defaultBody: React.ReactNode) => {
        const title = cmsContent[keyTitle] || defaultTitle;
        const body = cmsContent[keyBody];
        
        return (
            <div className={styles.contentBody}>
                <h2 className={styles.contentTitle}>{title}</h2>
                {body ? (
                    <div className={styles.contentText} dangerouslySetInnerHTML={{ __html: body.replace(/\n/g, '<br/>') }} />
                ) : (
                    defaultBody
                )}
            </div>
        );
    };

    const renderContent = () => {
        switch (activeSection) {
            case "about":
                return getContent(
                    "HELP_ABOUT_TITLE",
                    "About Seaura",
                    "HELP_ABOUT_BODY",
                    <>
                        <p className={styles.contentText}>Seaura is a boutique brand dedicated to high-quality, artisanal products. Each piece in our collection is carefully selected for its craftsmanship, sustainability, and timeless design.</p>
                        <p className={styles.contentText}>Born from a passion for textures and colors, we bridge the gap between traditional techniques and modern aesthetics.</p>
                        <div className={styles.brandManifesto}>
                            <h3>Our Values</h3>
                            <ul>
                                <li>Crafted with Heart</li>
                                <li>Sustainable Materials</li>
                                <li>Ethical Production</li>
                                <li>Timeless Elegance</li>
                            </ul>
                        </div>
                    </>
                );
            case "shipping":
                return getContent(
                    "HELP_SHIPPING_TITLE",
                    "Shipping & Delivery",
                    "HELP_SHIPPING_BODY",
                    <>
                        <p className={styles.contentText}>We offer worldwide shipping with reliable carriers. Your order is processed within 1-2 business days.</p>
                        <div className={styles.shippingGrid}>
                            <div className={styles.shippingCard}>
                                <h4>Tunisia</h4>
                                <p>Standard (2-4 days): 7 TND</p>
                                <p>Express (Next day): 12 TND</p>
                            </div>
                            <div className={styles.shippingCard}>
                                <h4>International</h4>
                                <p>Europe: 15-25 €</p>
                                <p>Worldwide: 30-45 €</p>
                            </div>
                        </div>
                    </>
                );
            case "materials":
                return getContent(
                    "HELP_MATERIALS_TITLE",
                    "Materials & Care",
                    "HELP_MATERIALS_BODY",
                    <>
                        <p className={styles.contentText}>Our products are made from natural, high-grade materials. Proper care will ensure your Seaura items last for years.</p>
                        <div className={styles.careInstruction}>
                            <h4>Knitwear & Crochet</h4>
                            <p>Hand wash in cold water with mild detergent. Lay flat to dry. Do not hang.</p>
                        </div>
                        <div className={styles.careInstruction}>
                            <h4>Jewelry</h4>
                            <p>Avoid contact with water, perfumes, and chemicals. Store in the provided pouch when not in use.</p>
                        </div>
                    </>
                );
            case "contact":
                return getContent(
                    "HELP_CONTACT_TITLE",
                    "Contact Us",
                    "HELP_CONTACT_BODY",
                    <>
                        <p className={styles.contentText}>Our customer service team is here to help you. Reach out through any of the following channels:</p>
                        <div className={styles.contactDetails}>
                            <p><strong>Email:</strong> hello@seaura.com</p>
                            <p><strong>Phone:</strong> +216 21 021 867</p>
                            <p><strong>Hours:</strong> Mon—Fri: 9:00 — 18:00</p>
                        </div>
                        <form className={styles.contactForm}>
                            <input type="text" placeholder="Name" className={styles.helpInput} />
                            <input type="email" placeholder="Email" className={styles.helpInput} />
                            <textarea placeholder="Your Message" className={styles.helpTextarea}></textarea>
                            <button type="submit" className={styles.helpSubmitBtn}>Send Message</button>
                        </form>
                    </>
                );
            case "privacy":
                return getContent(
                    "HELP_PRIVACY_TITLE",
                    "Privacy Policy",
                    "HELP_PRIVACY_BODY",
                    <>
                        <p className={styles.contentText}>Your privacy is important to us. We only collect the information necessary to process your orders and improve your shopping experience.</p>
                        <p className={styles.contentText}>We never share your data with third parties for marketing purposes. For more details on how we handle cookies and personal information, please read our full disclosure below.</p>
                    </>
                );
            default:
                return null;
        }
    };

    return (
        <div className={styles.helpPage}>
            <Header forceBlack={true} />
            
            <main className={styles.helpMain}>
                <div className={styles.helpContainer}>
                    <aside className={styles.helpSidebar}>
                        <h1 className={styles.sidebarTitle}>Customer Service</h1>
                        <nav className={styles.helpNav}>
                            {SECTIONS.map((section) => (
                                <button
                                    key={section.id}
                                    className={`${styles.navItem} ${activeSection === section.id ? styles.navItemActive : ""}`}
                                    onClick={() => handleSectionChange(section.id)}
                                >
                                    <span className={styles.navIcon}>{section.icon}</span>
                                    {section.label}
                                    <ChevronRight size={14} className={styles.navArrow} />
                                </button>
                            ))}
                        </nav>
                    </aside>

                    <section className={styles.helpContent}>
                        <div className={styles.contentWrapper}>
                            {renderContent()}
                        </div>
                    </section>
                </div>
            </main>

            <Footer />
        </div>
    );
}
