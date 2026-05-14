"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingCart, LogOut, Package, Heart, User, ChevronRight, Home } from "lucide-react";

export default function ClientDashboard() {
    const { data: session, status } = useSession();
    const [activeTab, setActiveTab] = useState("overview");
    const [wishlist, setWishlist] = useState<any[]>([]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const tab = params.get("tab");
        if (tab === "wishlist") setActiveTab("wishlist");

        const savedWishlist = localStorage.getItem('seaura_wishlist');
        if (savedWishlist) {
            try {
                setWishlist(JSON.parse(savedWishlist));
            } catch (e) {
                console.error("Wishlist load error:", e);
            }
        }

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

    const removeFromWishlist = (id: string) => {
        const updated = wishlist.filter(p => p.id !== id);
        setWishlist(updated);
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
    };

    if (status === "loading") return <div className="h-screen flex items-center justify-center font-light tracking-widest text-[#1a1a1a]">CHARGEMENT...</div>;

    if (!session) {
        redirect("/auth/signin");
    }

    return (
        <div className="min-h-screen bg-[#fafafa] text-[#1a1a1a] font-sans">
            {/* Top Navigation */}
            <nav className="bg-white border-b border-gray-100 px-8 py-5 flex justify-between items-center sticky top-0 z-50">
                <Link href="/" className="text-xl font-medium tracking-[0.3em] uppercase">SEAURA</Link>
                <div className="flex items-center gap-8">
                    <Link href="/" className="text-[10px] font-bold tracking-widest uppercase hover:opacity-50 transition flex items-center gap-2">
                        <Home size={14} /> Accueil
                    </Link>
                    <button
                        onClick={() => signOut({ callbackUrl: "/" })}
                        className="text-[10px] font-bold tracking-widest uppercase text-red-500 hover:opacity-50 transition flex items-center gap-2"
                    >
                        <LogOut size={14} /> Déconnexion
                    </button>
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold shadow-lg">
                        {(session.user?.email?.[0] || 'U').toUpperCase()}
                    </div>
                </div>
            </nav>

            <div className="max-w-7xl mx-auto px-8 py-12 flex gap-12">
                {/* Sidebar */}
                <aside className="w-64 flex flex-col gap-2">
                    <button
                        onClick={() => setActiveTab("overview")}
                        className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === "overview" ? "bg-black text-white shadow-xl" : "hover:bg-white text-gray-500"}`}
                    >
                        <User size={18} />
                        <span className="text-sm font-medium">Aperçu</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("orders")}
                        className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === "orders" ? "bg-black text-white shadow-xl" : "hover:bg-white text-gray-500"}`}
                    >
                        <Package size={18} />
                        <span className="text-sm font-medium">Mes Commandes</span>
                    </button>
                    <button
                        onClick={() => setActiveTab("wishlist")}
                        className={`flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === "wishlist" ? "bg-black text-white shadow-xl" : "hover:bg-white text-gray-500"}`}
                    >
                        <Heart size={18} />
                        <span className="text-sm font-medium">Favoris</span>
                    </button>
                    <div className="mt-8 pt-8 border-t border-gray-100">
                        <Link
                            href="/"
                            className="flex items-center gap-4 px-6 py-4 rounded-2xl text-black bg-white border border-black/5 hover:bg-black hover:text-white transition-all duration-500 shadow-sm"
                        >
                            <ShoppingCart size={18} />
                            <span className="text-sm font-medium">Boutique</span>
                        </Link>
                    </div>
                </aside>

                {/* Content Area */}
                <main className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    {activeTab === "overview" && (
                        <div className="space-y-8">
                            <header>
                                <h1 className="text-5xl font-light tracking-tight mb-2">Bonjour, {session.user?.email?.split('@')[0]}</h1>
                                <p className="text-gray-400 font-light italic">Bienvenue dans votre espace personnel SEAURA.</p>
                            </header>

                            <div className="grid grid-cols-3 gap-6">
                                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-4">Commandes</p>
                                    <p className="text-4xl font-light">0</p>
                                    <p className="text-xs text-blue-500 mt-4 flex items-center gap-1 cursor-pointer">Voir tout <ChevronRight size={12} /></p>
                                </div>
                                <div 
                                    className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50 cursor-pointer hover:border-pink-200 transition-colors"
                                    onClick={() => setActiveTab("wishlist")}
                                >
                                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-4">Favoris</p>
                                    <p className="text-4xl font-light">{wishlist.length}</p>
                                    <p className="text-xs text-pink-500 mt-4 flex items-center gap-1 cursor-pointer">Voir tout <ChevronRight size={12} /></p>
                                </div>
                                <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-gray-50">
                                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-gray-400 mb-4">Statut Client</p>
                                    <p className="text-xl font-medium tracking-tight">MEMBRE PLATINUM</p>
                                    <p className="text-[8px] font-black uppercase text-gray-300 mt-4 tracking-widest">Exclusivité Seaura</p>
                                </div>
                            </div>

                            <section className="bg-white rounded-[3rem] p-12 border border-gray-50 shadow-sm overflow-hidden relative">
                                <h3 className="text-2xl font-light mb-8">Dernières Activités</h3>
                                <div className="flex flex-col items-center justify-center py-12 text-gray-300 font-light italic text-sm">
                                    <Package size={48} className="mb-4 opacity-20" />
                                    Aucune activité récente pour le moment.
                                </div>
                                <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                                    <span className="text-[120px] font-black tracking-tighter">S E A U R A</span>
                                </div>
                            </section>
                        </div>
                    )}

                    {activeTab === "orders" && (
                        <div className="space-y-8">
                            <header>
                                <h1 className="text-5xl font-light tracking-tight mb-2">Mes Commandes</h1>
                                <p className="text-gray-400 font-light italic">Suivez vos achats et retours en temps réel.</p>
                            </header>
                            <div className="bg-white rounded-[3rem] p-20 text-center border border-gray-100">
                                <Package size={64} className="mx-auto mb-6 text-gray-100" />
                                <h2 className="text-xl font-medium mb-2">Vous n'avez pas encore de commande</h2>
                                <p className="text-gray-400 text-sm mb-8 font-light">Commencez votre expérience shopping dès maintenant.</p>
                                <Link href="/" className="px-10 py-4 bg-black text-white text-[10px] font-bold tracking-widest uppercase rounded-full hover:scale-105 transition-transform inline-block">Découvrir la Collection</Link>
                            </div>
                        </div>
                    )}

                    {activeTab === "wishlist" && (
                        <div className="space-y-8">
                            <header>
                                <h1 className="text-5xl font-light tracking-tight mb-2">Favoris</h1>
                                <p className="text-gray-400 font-light italic">Vos pièces préférées, réunies en un seul endroit.</p>
                            </header>
                            
                            {wishlist.length === 0 ? (
                                <div className="bg-white rounded-[3rem] p-20 text-center border border-gray-100">
                                    <Heart size={64} className="mx-auto mb-6 text-gray-100" />
                                    <h2 className="text-xl font-medium mb-2">Votre liste est vide</h2>
                                    <p className="text-gray-400 text-sm mb-8 font-light">Ajoutez des articles qui vous inspirent pour les retrouver plus tard.</p>
                                    <Link href="/" className="px-10 py-4 bg-black text-white text-[10px] font-bold tracking-widest uppercase rounded-full hover:scale-105 transition-transform inline-block">Explorer les Nouveautés</Link>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {wishlist.map((item) => (
                                        <div key={item.id} className="bg-white group rounded-[2.5rem] overflow-hidden border border-gray-50 hover:shadow-2xl transition-all duration-500 hover:-translate-y-2">
                                            <div className="relative aspect-[4/5] overflow-hidden">
                                                <img 
                                                    src={item.image_url || "/images/placeholder.png"} 
                                                    alt={item.name} 
                                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                />
                                                <button 
                                                    onClick={() => removeFromWishlist(item.id)}
                                                    className="absolute top-6 right-6 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center text-pink-500 shadow-lg hover:bg-pink-500 hover:text-white transition-all transform hover:rotate-90"
                                                >
                                                    <LogOut size={16} /> {/* Using LogOut icon as a 'remove' symbol or X if preferred, but user requested Heart logic. Let's use Trash2 for removal. */}
                                                </button>
                                            </div>
                                            <div className="p-8">
                                                <h3 className="text-lg font-light tracking-tight mb-1">{item.name}</h3>
                                                <p className="text-xl font-medium mb-6">{item.price} TND</p>
                                                <div className="flex gap-4">
                                                    <Link 
                                                        href={`/product/${item.id}`}
                                                        className="flex-1 px-6 py-4 bg-black text-white text-[9px] font-bold tracking-widest uppercase rounded-full text-center hover:opacity-80 transition-opacity"
                                                    >
                                                        Voir Produit
                                                    </Link>
                                                    <button 
                                                        onClick={() => removeFromWishlist(item.id)}
                                                        className="px-6 py-4 border border-gray-100 rounded-full text-[9px] font-bold tracking-widest uppercase hover:bg-gray-50 transition-colors"
                                                    >
                                                        Retirer
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
