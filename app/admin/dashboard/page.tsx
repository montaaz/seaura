"use client";

import { useSession, signOut } from "next-auth/react";
import { redirect } from "next/navigation";
import { useState, useEffect } from "react";
import Swal from "sweetalert2";
import Link from "next/link";
import {
    Layout,
    Package,
    LogOut,
    Save,
    Plus,
    Trash2,
    ChevronRight,
    Image as ImageIcon,
    RefreshCcw,
    X,
    Monitor,
    Mail,
    Menu,
    ChevronLeft,
    Tags,
    ShoppingBag,
    Settings,
    LayoutDashboard,
    MessageCircle,
    Send,
    User as UserIcon,
    Calculator,
    TrendingUp,
    TrendingDown,
    DollarSign,
    PieChart
} from "lucide-react";

function SettingsManager() {
    const [settings, setSettings] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    const fetchSettings = () => {
        setLoading(true);
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ settings { key value } }' })
        })
            .then(res => res.json())
            .then(data => {
                const sMap: Record<string, string> = {};
                (data.data?.settings || []).forEach((s: any) => {
                    sMap[s.key] = s.value;
                });
                setSettings(sMap);
                setLoading(false);
            });
    };

    useEffect(() => { fetchSettings(); }, []);

    const handleUpdate = async (key: string, value: string) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    const saveSettings = async () => {
        setIsSaving(true);
        try {
            let success = true;
            for (const key of Object.keys(settings)) {
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `mutation($key: String!, $value: String!) { updateSetting(key: $key, value: $value) { key } }`,
                        variables: { key, value: settings[key] }
                    })
                });
                const data = await res.json();
                if (!data.data?.updateSetting) success = false;
            }
            if (success) {
                Swal.fire({ icon: 'success', title: 'Succès', text: 'Paramètres enregistrés avec succès !', confirmButtonColor: '#000' });
            } else {
                Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur lors de l\'enregistrement.', confirmButtonColor: '#000' });
            }
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur lors de l\'enregistrement.', confirmButtonColor: '#000' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-20 text-center text-gray-400 font-light tracking-[0.2em] uppercase">Chargement des paramètres...</div>;

    const smtpFields = [
        { key: 'SMTP_FROM_NAME', label: 'Nom de l\'Expéditeur (Affichage)', placeholder: 'Boutique Seaura' },
        { key: 'SMTP_HOST', label: 'Serveur SMTP', placeholder: 'smtp.gmail.com' },
        { key: 'SMTP_PORT', label: 'Port SMTP', placeholder: '587' },
        { key: 'SMTP_SECURE', label: 'Sécurisé (true/false)', placeholder: 'false' },
        { key: 'SMTP_USER', label: 'Email Utilisateur', placeholder: 'votre-email@gmail.com' },
        { key: 'SMTP_PASS', label: 'Mot de passe / App Password', placeholder: 'votre-mot-de-passe', type: 'password' },
    ];

    return (
        <div className="max-w-4xl space-y-10">
            <div className="bg-white rounded-[3rem] p-12 border border-gray-100 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                    <Settings size={200} />
                </div>
                
                <div className="relative z-10">
                    <div className="mb-12">
                        <h3 className="text-2xl font-light tracking-tight">Configuration SMTP</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">Paramètres de messagerie système</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {smtpFields.map((field) => (
                            <div key={field.key} className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-widest text-black/40 ml-1">{field.label}</label>
                                <input
                                    type={field.type || 'text'}
                                    value={settings[field.key] || ''}
                                    onChange={(e) => handleUpdate(field.key, e.target.value)}
                                    placeholder={field.placeholder}
                                    className="w-full h-14 px-6 bg-gray-50 rounded-2xl border border-transparent focus:border-black focus:bg-white outline-none transition-all text-sm font-medium shadow-sm hover:shadow-md focus:shadow-xl"
                                />
                            </div>
                        ))}
                    </div>

                    <div className="mt-12 pt-10 border-t border-gray-50 flex justify-between items-center">
                        <div className="flex items-center gap-4 text-gray-400">
                            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-500">
                                <RefreshCcw size={16} />
                            </div>
                            <p className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Les changements s'appliquent<br />immédiatement après sauvegarde.</p>
                        </div>
                        <button
                            onClick={saveSettings}
                            disabled={isSaving}
                            className={`h-16 px-12 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-4 ${isSaving ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-black text-white hover:scale-105 active:scale-95 shadow-2xl shadow-black/20'}`}
                        >
                            {isSaving ? <RefreshCcw size={16} className="animate-spin" /> : <Save size={16} />}
                            {isSaving ? 'Enregistrement...' : 'Sauvegarder la Configuration'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-blue-600 rounded-[2.5rem] p-10 text-white shadow-xl shadow-blue-200">
                    <Monitor size={24} className="mb-6 opacity-60" />
                    <h4 className="text-lg font-bold tracking-tight mb-2">Sécurité SMTP</h4>
                    <p className="text-xs text-blue-100 leading-relaxed opacity-80">Seaura utilise une connexion sécurisée par défaut. Assurez-vous que le port correspond au type de sécurité (587 pour TLS, 465 pour SSL).</p>
                </div>
                <div className="bg-white rounded-[2.5rem] p-10 border border-gray-100 shadow-xl">
                    <Mail size={24} className="mb-6 text-black/20" />
                    <h4 className="text-lg font-bold tracking-tight mb-2">Mode Débogage</h4>
                    <p className="text-xs text-gray-400 leading-relaxed">En cas d'échec d'envoi, vérifiez vos identifiants. Si vous utilisez Gmail, l'usage d'un "Mot de Passe d'Application" est obligatoire.</p>
                </div>
            </div>
        </div>
    );
}

export default function AdminDashboard() {
    const { data: session, status } = useSession();
    const [activeTab, setActiveTab] = useState("products");
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    if (status === "loading") return <div className="h-screen flex items-center justify-center font-light tracking-widest">LOADING...</div>;

    if (!session || (session.user as any)?.role !== 'ADMIN') {
        redirect("/auth/signin");
    }

    return (
        <div className="flex h-screen bg-[#FDFDFD] overflow-hidden font-outfit relative">
            {/* Mobile Menu Button */}
            <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden fixed top-6 left-6 z-40 bg-white p-3 rounded-2xl shadow-xl border border-gray-100 flex items-center justify-center hover:scale-105 active:scale-95 transition-all"
            >
                <Menu size={20} className="text-black" />
            </button>

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="lg:hidden fixed inset-0 bg-black/40 backdrop-blur-sm z-50 transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-[280px] lg:w-80 h-full bg-white border-r border-gray-100 flex flex-col p-8 lg:p-10 shadow-2xl lg:shadow-sm
                transition-transform duration-500 ease-in-out
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
            `}>
                <button
                    onClick={() => setIsSidebarOpen(false)}
                    className="lg:hidden absolute top-10 -right-4 bg-white p-2 rounded-full shadow-lg border border-gray-100 z-[60]"
                >
                    <ChevronLeft size={16} />
                </button>

                <div className="mb-12">
                    <h1 className="text-2xl font-black tracking-[0.3em] text-black">SEAURA</h1>
                    <div className="h-[2px] w-full bg-black mt-2 mb-1" />
                    <p className="text-[9px] font-black uppercase tracking-[0.4em] text-black/30">Management Console</p>
                </div>

                <nav className="flex-1 space-y-3">
                    <button
                        onClick={() => { setActiveTab('products'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'products' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <Package size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Product Inventory</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('cms'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'cms' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <Layout size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Live Editor</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('newsletter'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'newsletter' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <Mail size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Newsletter</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('categories'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'categories' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <Tags size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Categories</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('orders'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'orders' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <ShoppingBag size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Commandes</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('chat'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'chat' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <MessageCircle size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Live Chat</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('settings'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'settings' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <Settings size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Paramètres</span>
                    </button>

                    <button
                        onClick={() => { setActiveTab('accounting'); setIsSidebarOpen(false); }}
                        className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 ${activeTab === 'accounting' ? 'bg-black text-white shadow-xl shadow-black/10' : 'hover:bg-gray-50 text-gray-400 font-medium'}`}
                    >
                        <Calculator size={20} />
                        <span className="text-xs uppercase font-bold tracking-[0.1em]">Comptabilité</span>
                    </button>

                    <div className="pt-8 opacity-50">
                        <p className="text-[9px] font-bold tracking-widest uppercase mb-4 px-5">System</p>
                        <Link
                            href="/"
                            target="_blank"
                            className="w-full flex items-center gap-4 px-5 py-3 hover:text-black transition text-gray-400"
                        >
                            <Monitor size={18} />
                            <span className="text-sm font-medium">View Storefront</span>
                        </Link>
                    </div>
                </nav>

                <button
                    onClick={() => signOut({ callbackUrl: "/auth/signin" })}
                    className="mt-auto flex items-center gap-4 text-red-500 px-6 py-4 hover:bg-red-50 rounded-2xl transition-all duration-300 group"
                >
                    <LogOut size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="text-sm font-medium">Log out</span>
                </button>
            </div>

            {/* Main Content */}
            <div className="flex-1 h-full overflow-y-auto bg-gray-50/50 p-6 lg:p-12 pt-24 lg:pt-12">
                <header className="flex justify-between items-end mb-12">
                    <div>
                        <h2 className="text-4xl font-light tracking-tight">
                            {activeTab === 'products' ? 'Collection' : activeTab === 'cms' ? 'Experience' : activeTab === 'newsletter' ? 'Audience' : activeTab === 'categories' ? 'Classification' : activeTab === 'chat' ? 'Dialogue' : activeTab === 'orders' ? 'Transactions' : activeTab === 'accounting' ? 'Bookkeeping' : 'Configuration'}
                        </h2>
                        <p className="text-gray-400 mt-2 text-sm">
                            {activeTab === 'settings' ? 'Gérer les configurations système' : activeTab === 'orders' ? 'Gestion des commandes clients' : activeTab === 'accounting' ? 'Analyse financière et gestion des bénéfices' : 'Managing the brand\'s digital presence'}
                        </p>
                    </div>
                    <div className="flex items-center gap-4 bg-white p-3 rounded-2xl border border-gray-100 shadow-sm">
                        <div className="w-8 h-8 rounded-full bg-black text-white flex items-center justify-center text-xs">
                            {(session.user?.email?.[0] || 'A').toUpperCase()}
                        </div>
                        <div className="text-xs uppercase tracking-tighter pr-4 font-bold">{(session.user as any)?.role}</div>
                    </div>
                </header>

                <section className="animate-in fade-in duration-500">
                    {activeTab === "products" && <ProductManager />}
                    {activeTab === "cms" && <CMSManager />}
                    {activeTab === "newsletter" && <NewsletterManager />}
                    {activeTab === "categories" && <CategoryManager />}
                    {activeTab === "chat" && <ChatManager />}
                    {activeTab === "orders" && <OrderManager />}
                    {activeTab === "settings" && <SettingsManager />}
                    {activeTab === "accounting" && <AccountingManager />}
                </section>
            </div>
        </div>
    );
}

function ProductManager() {
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [newProduct, setNewProduct] = useState({ name: "", price: "", image_url: "", description: "", category_id: "", colors: [] as { name: string, hex: string }[], images: [] as string[], sizes: [] as string[] });
    const [customColor, setCustomColor] = useState({ name: "", hex: "#000000" });
    const [customSize, setCustomSize] = useState("");

    const fetchData = async () => {
        setLoading(true);
        const res = await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: '{ products { id name price image_url description category_id colors { name hex } images sizes } categories { id name } }'
            })
        });
        const data = await res.json();
        setProducts(data.data?.products || []);
        setCategories(data.data?.categories || []);
        setLoading(false);
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation($id: ID!) { deleteProduct(id: $id) }`,
                variables: { id }
            })
        });
        fetchData();
    };

    const handleProductImageUpload = (file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setNewProduct(prev => {
                const newImages = [...prev.images, base64String];
                return {
                    ...prev,
                    images: newImages,
                    image_url: prev.image_url || base64String
                };
            });
        };
        reader.readAsDataURL(file);
    };

    const [isSavingProduct, setIsSavingProduct] = useState(false);

    const handleAddProduct = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingProduct(true);
        try {
            const isEditing = !!editingId;
            
            // Auto-add current custom color if it has a name but wasn't clicked "Ajouter"
            let finalColors = [...newProduct.colors];
            if (customColor.name && !finalColors.some(c => c.name === customColor.name)) {
                finalColors.push({ ...customColor });
            }

            const mutation = isEditing 
                ? `mutation($id: ID!, $name: String!, $price: Float!, $image_url: String, $description: String, $category_id: ID, $colors: [ColorInput!], $images: [String!], $sizes: [String!]) {
                    updateProduct(id: $id, name: $name, price: $price, image_url: $image_url, description: $description, category_id: $category_id, colors: $colors, images: $images, sizes: $sizes) { id }
                }`
                : `mutation($name: String!, $price: Float!, $image_url: String, $description: String, $category_id: ID, $colors: [ColorInput!], $images: [String!], $sizes: [String!]) {
                    createProduct(name: $name, price: $price, image_url: $image_url, description: $description, category_id: $category_id, colors: $colors, images: $images, sizes: $sizes) { id }
                }`;

            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        id: editingId,
                        name: newProduct.name,
                        price: parseFloat(newProduct.price),
                        image_url: newProduct.image_url,
                        description: newProduct.description,
                        category_id: newProduct.category_id || null,
                        colors: finalColors,
                        images: newProduct.images,
                        sizes: newProduct.sizes
                    }
                })
            });
            const data = await res.json();
            if (data.errors) {
                Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur lors de la sauvegarde: ' + data.errors[0].message, confirmButtonColor: '#000' });
            } else {
                setIsAdding(false);
                setEditingId(null);
                setNewProduct({ name: "", price: "", image_url: "", description: "", category_id: "", colors: [], images: [], sizes: [] });
                fetchData();
            }
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur réseau lors de la sauvegarde.', confirmButtonColor: '#000' });
        } finally {
            setIsSavingProduct(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-10 border-b border-gray-100 flex justify-between items-center bg-white">
                    <div className="flex items-center gap-3">
                        <ShoppingBag className="text-gray-300" />
                        <h3 className="text-xl font-light">Inventory</h3>
                    </div>
                    <button
                        onClick={() => {
                            setEditingId(null);
                            setNewProduct({ name: "", price: "", image_url: "", description: "", category_id: "", colors: [], images: [], sizes: [] });
                            setIsAdding(true);
                        }}
                        className="bg-black text-white px-8 py-3 rounded-full text-sm font-medium hover:scale-105 active:scale-95 transition-all shadow-xl shadow-black/10 flex items-center gap-2"
                    >
                        <Plus size={16} /> New Item
                    </button>
                </div>

                <div className="p-2">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] border-b border-gray-50">
                                <th className="px-10 py-6">Reference</th>
                                <th className="px-6 py-6">Designation</th>
                                <th className="px-6 py-6">Category</th>
                                <th className="px-6 py-6">Price</th>
                                <th className="px-6 py-6">Colors</th>
                                <th className="px-10 py-6 text-right">Options</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr><td colSpan={5} className="p-20 text-center text-gray-300 animate-pulse">Syncing data...</td></tr>
                            ) : products.map((p: any) => (
                                <tr key={p.id} className="group hover:bg-gray-50/50 transition-colors">
                                    <td className="px-10 py-6">
                                        <div className="flex items-center gap-5">
                                            <div className="w-16 h-20 bg-gray-100 flex-shrink-0 relative overflow-hidden group-hover:shadow-md transition-shadow">
                                                {p.image_url ? <img src={p.image_url} className="object-cover w-full h-full" /> : <div className="w-full h-full flex items-center justify-center text-gray-300 text-[8px]">NO IMG</div>}
                                            </div>
                                            <span className="text-[10px] font-mono text-gray-400">#{p.id.slice(-6).toUpperCase()}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-6 font-medium text-sm tracking-tight">{p.name}</td>
                                    <td className="px-6 py-6 text-xs text-gray-400 uppercase tracking-widest font-bold">
                                        {categories.find(c => c.id === p.category_id)?.name || "—"}
                                    </td>
                                    <td className="px-6 py-6 text-sm text-gray-500">€{p.price}</td>
                                    <td className="px-6 py-6">
                                        <div className="flex gap-1">
                                            {p.colors?.map((c: any) => (
                                                <div
                                                    key={c.name}
                                                    className="w-3 h-3 rounded-full border border-gray-100"
                                                    style={{ backgroundColor: c.hex }}
                                                    title={c.name}
                                                />
                                            ))}
                                        </div>
                                    </td>
                                    <td className="px-10 py-6 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setEditingId(p.id);
                                                    setNewProduct({
                                                        name: p.name,
                                                        price: p.price.toString(),
                                                        image_url: p.image_url || "",
                                                        description: p.description || "",
                                                        category_id: p.category_id || "",
                                                        colors: p.colors || [],
                                                        images: (p.images && Array.isArray(p.images) && p.images.length > 0)
                                                            ? p.images
                                                            : (p.image_url ? [p.image_url] : []),
                                                        sizes: p.sizes || []
                                                    });
                                                    setIsAdding(true);
                                                }}
                                                className="p-3 hover:bg-white rounded-full transition-shadow border border-transparent hover:border-gray-200"
                                            >
                                                <Settings size={14} className="text-gray-400" />
                                            </button>
                                            <button onClick={() => handleDelete(p.id)} className="p-3 hover:bg-red-50 rounded-full transition-colors border border-transparent text-red-300 hover:text-red-500">
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <style jsx global>{`
                        @keyframes scroll-indicator {
                            0%, 100% { opacity: 0.2; transform: translateY(0); }
                            50% { opacity: 0.8; transform: translateY(5px); }
                        }
                        .custom-scrollbar::-webkit-scrollbar {
                            width: 6px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-track {
                            background: transparent;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb {
                            background: rgba(0,0,0,0.05);
                            border-radius: 10px;
                        }
                        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                            background: rgba(0,0,0,0.1);
                        }
                    `}</style>
                </div>
            </div>

            {/* Add Product Modal */}
            {isAdding && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-end sm:items-center justify-center p-0 sm:p-8 cursor-pointer"
                    onClick={() => {
                        setIsAdding(false);
                        setEditingId(null);
                        setNewProduct({ name: "", price: "", image_url: "", description: "", category_id: "", colors: [], images: [], sizes: [] });
                    }}
                >
                    <div
                        className="bg-white rounded-t-[2rem] sm:rounded-[3rem] w-full max-w-2xl h-[92vh] sm:h-auto sm:max-h-[90vh] overflow-y-auto shadow-2xl animate-in slide-in-from-bottom duration-500 sm:duration-300 sm:zoom-in-95 cursor-default custom-scrollbar relative"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Mobile Drag Handle */}
                        <div className="flex justify-center pt-3 pb-1 md:hidden">
                            <div className="w-12 h-1.5 bg-gray-100 rounded-full" />
                        </div>
                        <div className="p-6 md:p-12">
                            <h3 className="text-2xl md:text-3xl font-light mb-6 md:mb-8">{editingId ? "Modifier le Produit" : "Nouveau Produit"}</h3>
                            <form onSubmit={handleAddProduct} className="space-y-4 md:space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Désignation</label>
                                        <input
                                            required
                                            className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                            value={newProduct.name}
                                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Prix (€)</label>
                                        <input
                                            required type="number" step="0.01"
                                            className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                            value={newProduct.price}
                                            onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Catégorie</label>
                                    <select
                                        className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                        value={newProduct.category_id}
                                        onChange={e => setNewProduct({ ...newProduct, category_id: e.target.value })}
                                    >
                                        <option value="">Sélectionner une catégorie</option>
                                        {categories.map(cat => (
                                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Palette de Couleurs Personnalisée</label>

                                    <div className="flex flex-col md:flex-row gap-4 p-4 md:p-6 bg-gray-50 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-inner">
                                        <div className="flex-1 space-y-2">
                                            <input
                                                placeholder="Nom de la couleur"
                                                className="w-full h-12 bg-white border border-gray-100 rounded-xl px-4 text-xs font-medium outline-none focus:border-black transition-all"
                                                value={customColor.name}
                                                onChange={e => setCustomColor({ ...customColor, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="w-12 h-12 flex-shrink-0 relative overflow-hidden rounded-xl border border-gray-200">
                                            <input
                                                type="color"
                                                className="absolute inset-[-10px] w-[200%] h-[200%] cursor-pointer"
                                                value={customColor.hex}
                                                onChange={e => setCustomColor({ ...customColor, hex: e.target.value })}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (customColor.name) {
                                                    setNewProduct({ ...newProduct, colors: [...newProduct.colors, customColor] });
                                                    setCustomColor({ name: "", hex: "#000000" });
                                                }
                                            }}
                                            className="h-12 bg-black text-white px-6 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-lg"
                                        >
                                            Ajouter
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {newProduct.colors.map((color: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm animate-in fade-in zoom-in duration-300">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color.hex }} />
                                                <span className="text-[9px] font-bold uppercase tracking-tight text-black">{color.name}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => setNewProduct({ ...newProduct, colors: newProduct.colors.filter((_, i) => i !== idx) })}
                                                    className="w-4 h-4 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex items-center justify-center font-bold"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Tailles et Options Disponibles</label>

                                        <div className="flex flex-col gap-4 p-4 md:p-6 bg-gray-50 rounded-[1.5rem] md:rounded-[2rem] border border-gray-100 shadow-inner">
                                            <div className="flex flex-wrap gap-2">
                                                {/* Presets Clothing */}
                                                {["XS", "S", "M", "L", "XL", "XXL"].map(s => (
                                                    <button
                                                        key={s} type="button"
                                                        onClick={() => setNewProduct(prev => ({ ...prev, sizes: prev.sizes.includes(s) ? prev.sizes.filter(x => x !== s) : [...prev.sizes, s] }))}
                                                        className={`px-3 py-1 rounded-lg border text-[9px] font-bold transition-all ${newProduct.sizes.includes(s) ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                                <div className="w-[1px] h-4 bg-gray-200 self-center mx-1" />
                                                {/* Presets Screens */}
                                                {['16"', '24"', '32"', '43"', '55"'].map(s => (
                                                    <button
                                                        key={s} type="button"
                                                        onClick={() => setNewProduct(prev => ({ ...prev, sizes: prev.sizes.includes(s) ? prev.sizes.filter(x => x !== s) : [...prev.sizes, s] }))}
                                                        className={`px-3 py-1 rounded-lg border text-[9px] font-bold transition-all ${newProduct.sizes.includes(s) ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-100 hover:border-gray-300'}`}
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex gap-2">
                                                <input
                                                    placeholder="Ajouter une taille personnalisée..."
                                                    className="flex-1 h-10 bg-white border border-gray-100 rounded-xl px-4 text-xs font-medium outline-none focus:border-black transition-all"
                                                    value={customSize}
                                                    onChange={e => setCustomSize(e.target.value)}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (customSize) {
                                                            if (!newProduct.sizes.includes(customSize)) {
                                                                setNewProduct({ ...newProduct, sizes: [...newProduct.sizes, customSize] });
                                                            }
                                                            setCustomSize("");
                                                        }
                                                    }}
                                                    className="h-10 bg-black text-white px-5 rounded-xl text-[9px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-md"
                                                >
                                                    +
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {newProduct.sizes.map((size, idx) => (
                                                <div key={idx} className="flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-gray-100 shadow-sm animate-in fade-in zoom-in duration-300">
                                                    <span className="text-[9px] font-bold uppercase tracking-tight text-black">{size}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewProduct({ ...newProduct, sizes: newProduct.sizes.filter((_, i) => i !== idx) })}
                                                        className="w-4 h-4 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors flex items-center justify-center font-bold"
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Images du Produit</label>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                                        {newProduct.images.map((img, idx) => (
                                            <div key={idx} className={`relative aspect-square rounded-2xl overflow-hidden border-2 transition-all ${newProduct.image_url === img ? 'border-black' : 'border-transparent bg-gray-50'}`}>
                                                <img src={img} className="w-full h-full object-cover" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setNewProduct({ ...newProduct, image_url: img })}
                                                        className="bg-white text-black px-3 py-1.5 rounded-full text-[8px] font-black uppercase tracking-widest"
                                                    >
                                                        Principal
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const filtered = newProduct.images.filter((_, i) => i !== idx);
                                                            setNewProduct({
                                                                ...newProduct,
                                                                images: filtered,
                                                                image_url: newProduct.image_url === img ? (filtered[0] || "") : newProduct.image_url
                                                            });
                                                        }}
                                                        className="text-white hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                                {newProduct.image_url === img && (
                                                    <div className="absolute top-2 left-2 bg-black text-white px-2 py-1 rounded-md text-[7px] font-black uppercase tracking-widest">Principal</div>
                                                )}
                                            </div>
                                        ))}

                                        <div className="relative aspect-square rounded-2xl border-2 border-dashed border-gray-100 bg-gray-50 hover:bg-white hover:border-black/20 transition-all flex flex-col items-center justify-center gap-2">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                multiple
                                                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                                onChange={e => {
                                                    if (e.target.files) {
                                                        Array.from(e.target.files).forEach(file => handleProductImageUpload(file));
                                                    }
                                                }}
                                            />
                                            <Plus size={20} className="text-gray-300" />
                                            <span className="text-[8px] font-bold uppercase tracking-tighter text-gray-400">Ajouter</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Description</label>
                                    <textarea
                                        rows={3}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-6 py-4 outline-none focus:border-black transition-all"
                                        value={newProduct.description}
                                        onChange={e => setNewProduct({ ...newProduct, description: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-4 pt-8 md:pt-10 bg-white/95 backdrop-blur-sm sticky bottom-[-24px] border-t border-gray-100 mt-10 -mx-6 md:-mx-12 px-6 md:px-12 pb-8 z-50">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsAdding(false);
                                            setEditingId(null);
                                            setNewProduct({ name: "", price: "", image_url: "", description: "", category_id: "", colors: [], images: [], sizes: [] });
                                        }}
                                        className="flex-1 h-14 border border-gray-100 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:bg-gray-50 transition-all active:scale-95 text-gray-400"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isSavingProduct}
                                        className={`flex-1 h-14 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] transition-all shadow-xl ${isSavingProduct ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-black text-white hover:scale-[1.02] active:scale-95 shadow-black/20'}`}
                                    >
                                        {isSavingProduct ? <RefreshCcw size={16} className="animate-spin mx-auto" /> : 'Enregistrer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
}

function CMSManager() {
    const [content, setContent] = useState<any[]>([]);
    const [stagedChanges, setStagedChanges] = useState<Record<string, any>>({});
    const [loading, setLoading] = useState(true);
    const [previewKey, setPreviewKey] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    const fetchCMS = () => {
        setLoading(true);
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ homeContent { key value type section } }' })
        })
            .then(res => res.json())
            .then(async data => {
                const results = data.data?.homeContent || [];

                const hasInsta = results.some((i: any) => i.section === 'instagram');
                if (!hasInsta) {
                    console.log("Initializing Instagram CMS slots...");
                    for (let i = 1; i <= 12; i++) {
                        await fetch('/api/graphql', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                query: `mutation($key: String!, $value: String!, $type: String!, $section: String) { 
                                    updateHomeContent(key: $key, value: $value, type: $type, section: $section) { key }
                                }`,
                                variables: {
                                    key: `instagram_post_${i}`,
                                    value: JSON.stringify({ image_url: "/images/hero.png", instagram_url: "https://instagram.com" }),
                                    type: 'JSON',
                                    section: 'instagram'
                                }
                            })
                        });
                    }
                    return fetchCMS();
                }

                setContent(results);
                const initial: any = {};
                results.forEach((item: any) => {
                    initial[item.key] = { value: item.value, type: item.type, section: item.section };
                });
                setStagedChanges(initial);
                setLoading(false);
            });
    };

    useEffect(() => { fetchCMS(); }, []);

    const handleInputChange = (key: string, value: string) => {
        setStagedChanges(prev => ({
            ...prev,
            [key]: { ...prev[key], value }
        }));
    };

    const handleImageUpload = (key: string, file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result as string;
            setStagedChanges(prev => ({
                ...prev,
                [key]: { ...prev[key], value: base64String }
            }));
        };
        reader.readAsDataURL(file);
    };

    const handlePublish = async () => {
        setIsSaving(true);
        try {
            let success = true;
            for (const key of Object.keys(stagedChanges)) {
                const item = stagedChanges[key];
                const res = await fetch('/api/graphql', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: `mutation($key: String!, $value: String!, $type: String!, $section: String) { 
              updateHomeContent(key: $key, value: $value, type: $type, section: $section) { key }
            }`,
                        variables: {
                            key,
                            value: item.value,
                            type: item.type,
                            section: item.section
                        }
                    })
                });
                const data = await res.json();
                if (!data.data?.updateHomeContent) success = false;
            }
            if (success) {
                Swal.fire({ icon: 'success', title: 'Succès', text: 'Contenu publié avec succès !', confirmButtonColor: '#000' });
            } else {
                Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur lors de la publication.', confirmButtonColor: '#000' });
            }
            setPreviewKey(prev => prev + 1);
        } catch (error) {
            console.error(error);
            Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur lors de la publication.', confirmButtonColor: '#000' });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) return <div className="p-20 text-center text-gray-300 font-light tracking-[0.3em] uppercase">Initialisation de l'éditeur...</div>;

    const sections = Array.from(new Set(content.map(i => i.section))).sort((a, b) => {
        const order = ['branding', 'hero', 'categories', 'newsletter', 'instagram'];
        const idxA = order.indexOf(a || '');
        const idxB = order.indexOf(b || '');
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return (a || '').localeCompare(b || '');
    });

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 h-[calc(100vh-240px)]">
            <div className="lg:col-span-6 flex flex-col bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-10">
                    <div>
                        <h3 className="text-xl font-light tracking-tight">Configuration Visuelle</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Live Content Management</p>
                    </div>
                    <button
                        onClick={handlePublish}
                        disabled={isSaving}
                        className={`flex items-center gap-2 px-8 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest transition-all ${isSaving ? 'bg-gray-100 text-gray-300 cursor-not-allowed' : 'bg-black text-white hover:scale-105 active:scale-95 shadow-xl shadow-black/10'}`}
                    >
                        {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Save size={14} />}
                        {isSaving ? 'En cours...' : 'Publier'}
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
                    {sections.map(section => (
                        <div key={section} className="space-y-6">
                            <h4 className="text-[10px] font-black tracking-[0.4em] text-black/20 uppercase pb-4 border-b border-gray-50">{section || 'Général'}</h4>
                            <div className="space-y-8">
                                {content.filter(i => i.section === section).map(item => (
                                    <div key={item.key} className="group flex flex-col gap-3">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-bold tracking-widest text-black/40 uppercase">{item.key.replace(/_/g, ' ')}</label>
                                            <div className="flex gap-2">
                                                {section === 'instagram' && (
                                                    <button 
                                                        onClick={async () => {
                                                            if (confirm("Supprimer cet emplacement Instagram ?")) {
                                                                await fetch('/api/graphql', {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({
                                                                        query: `mutation($key: String!) { deleteHomeContent(key: $key) }`,
                                                                        variables: { key: item.key }
                                                                    })
                                                                });
                                                                fetchCMS();
                                                            }
                                                        }}
                                                        className="text-[8px] px-2 py-0.5 rounded-full bg-red-50 text-red-400 border border-red-100 uppercase tracking-tighter hover:bg-red-500 hover:text-white transition-all"
                                                    >
                                                        Supprimer
                                                    </button>
                                                )}
                                                <span className="text-[8px] px-2 py-0.5 rounded-full bg-gray-50 text-gray-400 border border-gray-100 uppercase tracking-tighter">{item.type}</span>
                                            </div>
                                        </div>

                                        {item.type === 'IMAGE' ? (
                                            <div className="space-y-4">
                                                <div className="relative aspect-video rounded-3xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-100 group-hover:border-black/10 transition-colors flex items-center justify-center">
                                                    <img
                                                        src={stagedChanges[item.key]?.value}
                                                        className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                                    />
                                                    <div className="relative z-10 p-4 bg-white/80 backdrop-blur-md rounded-2xl shadow-xl flex items-center gap-3">
                                                        <ImageIcon size={14} className="text-gray-400" />
                                                        <input
                                                            type="file"
                                                            accept="image/*"
                                                            onChange={(e) => e.target.files?.[0] && handleImageUpload(item.key, e.target.files[0])}
                                                            className="text-[10px] text-gray-500 font-medium w-full file:hidden cursor-pointer"
                                                        />
                                                    </div>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={stagedChanges[item.key]?.value}
                                                    onChange={(e) => handleInputChange(item.key, e.target.value)}
                                                    className="w-full text-[9px] font-mono text-gray-300 bg-transparent border-none outline-none truncate"
                                                    placeholder="Lien ou Base64"
                                                />
                                            </div>
                                        ) : item.type === 'JSON' && item.section === 'instagram' ? (
                                            <div className="space-y-4">
                                                {(() => {
                                                    const jsonVal = JSON.parse(stagedChanges[item.key]?.value || '{}');
                                                    return (
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div className="space-y-3">
                                                                <div className="relative aspect-square rounded-2xl overflow-hidden bg-gray-50 border-2 border-dashed border-gray-100 flex items-center justify-center group/img">
                                                                    <img src={jsonVal.image_url} className="absolute inset-0 w-full h-full object-cover" />
                                                                    <div className="relative z-10 opacity-0 group-hover/img:opacity-100 transition-opacity">
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            onChange={(e) => {
                                                                                const file = e.target.files?.[0];
                                                                                if (file) {
                                                                                    const reader = new FileReader();
                                                                                    reader.onloadend = () => {
                                                                                        handleInputChange(item.key, JSON.stringify({ ...jsonVal, image_url: reader.result }));
                                                                                    };
                                                                                    reader.readAsDataURL(file);
                                                                                }
                                                                            }}
                                                                            className="absolute inset-0 opacity-0 cursor-pointer"
                                                                        />
                                                                        <div className="p-3 bg-white rounded-xl shadow-lg">
                                                                            <Plus size={16} />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <p className="text-[8px] text-center font-bold text-gray-300 uppercase tracking-widest">Image Post</p>
                                                            </div>
                                                            <div className="flex flex-col justify-center gap-3">
                                                                <label className="text-[9px] font-black uppercase tracking-widest text-black/20">Instagram Link</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full bg-gray-50 border-none rounded-xl p-3 text-[11px] font-medium focus:ring-1 focus:ring-black outline-none"
                                                                    placeholder="https://instagram.com/p/..."
                                                                    value={jsonVal.instagram_url}
                                                                    onChange={(e) => handleInputChange(item.key, JSON.stringify({ ...jsonVal, instagram_url: e.target.value }))}
                                                                />
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ) : (
                                            <textarea
                                                rows={2}
                                                className="w-full bg-gray-50/50 rounded-2xl p-5 text-sm font-medium border border-transparent focus:border-black focus:bg-white transition-all outline-none resize-none"
                                                value={stagedChanges[item.key]?.value}
                                                onChange={(e) => handleInputChange(item.key, e.target.value)}
                                            />
                                        )}
                                    </div>
                                ))}

                                {section === 'instagram' && (
                                    <button 
                                        onClick={async () => {
                                            const nextIdx = content.filter(i => i.section === 'instagram').length + 1;
                                            await fetch('/api/graphql', {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({
                                                    query: `mutation($key: String!, $value: String!, $type: String!, $section: String) { 
                                                        updateHomeContent(key: $key, value: $value, type: $type, section: $section) { key }
                                                    }`,
                                                    variables: {
                                                        key: `instagram_post_${nextIdx}`,
                                                        value: JSON.stringify({ image_url: "/images/hero.png", instagram_url: "https://instagram.com" }),
                                                        type: 'JSON',
                                                        section: 'instagram'
                                                    }
                                                })
                                            });
                                            fetchCMS();
                                        }}
                                        className="w-full h-12 dashed-border border-2 border-dashed border-gray-100 rounded-2xl text-[9px] font-black uppercase tracking-widest text-gray-300 hover:border-black/10 hover:text-black transition-all flex items-center justify-center gap-2"
                                    >
                                        <Plus size={14} /> Ajouter un Emplacement
                                    </button>
                                )}

                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="lg:col-span-6 flex flex-col gap-6">
                <div className="flex-1 bg-[#121212] rounded-[3.5rem] p-6 relative shadow-2xl overflow-hidden group">
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-2xl px-8 py-3 rounded-full border border-white/10 shadow-3xl z-20 flex items-center gap-6">
                        <Monitor size={16} className="text-white/40" />
                        <span className="text-[11px] font-black tracking-[0.4em] text-white/60 uppercase">Visionneuse Interactive</span>
                        <div className="h-4 w-[1px] bg-white/10" />
                        <div className="flex gap-2">
                            <div className="h-2 w-2 rounded-full bg-red-500/50" />
                            <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
                            <div className="h-2 w-2 rounded-full bg-green-500/50" />
                        </div>
                    </div>

                    <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden shadow-inner relative mt-6">
                        <iframe
                            key={previewKey}
                            src="/"
                            className="w-full h-full border-none transform transition-transform duration-1000"
                            style={{ height: 'calc(100% + 1px)' }}
                        />
                        <div className="absolute inset-0 z-10 bg-transparent pointer-events-none" />
                    </div>

                    <div className="absolute bottom-12 right-12 z-20 animate-pulse">
                        <div className="bg-green-500/20 text-green-400 text-[9px] font-black tracking-[0.2em] px-4 py-2 rounded-full border border-green-500/30 uppercase">
                            En Direct
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-8 border border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-4 bg-blue-50 rounded-2xl">
                            <RefreshCcw size={20} className="text-blue-500" />
                        </div>
                        <div>
                            <h5 className="text-sm font-bold tracking-tight">Mise à jour en temps réel</h5>
                            <p className="text-xs text-gray-400 mt-1">Les changements publiés sont visibles instantanément sur le site.</p>
                        </div>
                    </div>
                    <Link href="/" target="_blank" className="px-6 py-3 border border-gray-100 rounded-full text-[10px] font-bold tracking-widest uppercase hover:bg-black hover:text-white transition-all group items-center flex gap-2">
                        Ouvrir le Site <Plus size={12} className="group-hover:rotate-45 transition-transform" />
                    </Link>
                </div>
            </div>
        </div>
    );
}

function NewsletterManager() {
    const [emails, setEmails] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [campaignFrom, setCampaignFrom] = useState("");
    const [campaignSubject, setCampaignSubject] = useState("");
    const [campaignContent, setCampaignContent] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
    const [campaignStatus, setCampaignStatus] = useState("idle");
    const [uploadedImages, setUploadedImages] = useState<string[]>([]);

    const fetchEmails = () => {
        setLoading(true);
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ newsletter { id email created_at } }' })
        })
            .then(res => res.json())
            .then(data => {
                setEmails(data.data?.newsletter || []);
                setLoading(false);
            });
    };

    useEffect(() => { fetchEmails(); }, []);

    const handleSendMails = async () => {
        if (!campaignFrom) {
            Swal.fire({ icon: 'warning', title: 'Attention', text: 'Veuillez spécifier l\'e-mail de l\'expéditeur.', confirmButtonColor: '#000' });
            return;
        }
        if (selectedUsers.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Attention', text: 'Veuillez sélectionner au moins un destinataire.', confirmButtonColor: '#000' });
            return;
        }

        setCampaignStatus("sending");
        try {
            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($from: String!, $recipients: [String!]!, $content: String!, $images: [String!]) {
                        sendEmailCampaign(from: $from, recipients: $recipients, content: $content, images: $images)
                    }`,
                    variables: {
                        from: campaignFrom,
                        recipients: selectedUsers,
                        content: campaignContent,
                        images: uploadedImages
                    }
                })
            });
            const data = await res.json();
            if (data.data?.sendEmailCampaign) {
                Swal.fire({ icon: 'success', title: 'Succès', text: `E-mails envoyés avec succès à ${selectedUsers.length} utilisateurs !`, confirmButtonColor: '#000' });
                setCampaignStatus("idle");
                setIsModalOpen(false);
            } else {
                Swal.fire({ icon: 'error', title: 'Erreur', text: `Erreur: ${data.errors?.[0]?.message || 'Erreur lors de l\'envoi'}`, confirmButtonColor: '#000' });
                setCampaignStatus("idle");
            }
        } catch (err) {
            console.error(err);
            Swal.fire({ icon: 'error', title: 'Erreur', text: 'Erreur lors de l\'envoi de la campagne.', confirmButtonColor: '#000' });
            setCampaignStatus("idle");
        }
    };

    const toggleUser = (email: string) => {
        setSelectedUsers(prev =>
            prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
        );
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setUploadedImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const removeImage = (index: number) => {
        setUploadedImages(prev => prev.filter((_, i) => i !== index));
    };

    if (loading) return <div className="p-20 text-center text-gray-400 font-light tracking-[0.2em] uppercase">Chargement de la liste...</div>;

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-[2rem] p-6 border border-gray-100 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="flex-1 w-full max-w-xl relative group">
                    <Mail size={16} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-black transition-colors" />
                    <input
                        type="email"
                        placeholder="E-mail de l'expéditeur"
                        value={campaignFrom}
                        onChange={(e) => setCampaignFrom(e.target.value)}
                        className="w-full h-14 pl-14 pr-6 bg-gray-50 rounded-2xl border border-transparent focus:border-black focus:bg-white outline-none transition-all text-sm font-medium"
                    />
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="h-14 px-10 bg-green-500 text-white rounded-2xl text-[11px] font-bold uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-green-200 flex items-center gap-3 w-full md:w-auto justify-center"
                >
                    <Send size={16} />
                    Sending Mails
                </button>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-md">
                    <div>
                        <h3 className="text-xl font-light tracking-tight">Liste des Abonnés</h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{emails.length} contacts capturés</p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50/50">
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-black/20">Email</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-black/20">Date Inscription</th>
                                <th className="px-8 py-5 text-[10px] font-black uppercase tracking-[0.3em] text-black/20 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {emails.map((entry) => (
                                <tr key={entry.id} className="hover:bg-gray-50/30 transition-colors group">
                                    <td className="px-8 py-6">
                                        <span className="text-sm font-medium text-gray-600">{entry.email}</span>
                                    </td>
                                    <td className="px-8 py-6">
                                        <span className="text-[11px] font-medium text-gray-400 uppercase tracking-tight">
                                            {new Date(parseInt(entry.created_at || Date.now().toString())).toLocaleDateString('fr-FR', {
                                                day: '2-digit',
                                                month: 'long',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-8 py-6 text-right">
                                        <button className="text-gray-300 hover:text-red-500 transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {emails.length === 0 && (
                        <div className="p-20 text-center text-gray-300 font-light italic">
                            Aucun e-mail capturé pour le moment.
                        </div>
                    )}
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-md">
                            <div>
                                <h3 className="text-2xl font-light tracking-tight">Campaign Composer</h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">Expéditeur: {campaignFrom || '(Non spécifié)'}</p>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="w-12 h-12 rounded-full hover:bg-gray-100 text-gray-400 transition-colors flex items-center justify-center"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-black/20">Recipients ({selectedUsers.length})</h4>
                                        <button 
                                            onClick={() => setSelectedUsers(selectedUsers.length === emails.length ? [] : emails.map(e => e.email))}
                                            className="text-[9px] font-bold uppercase tracking-widest text-black/40 hover:text-black"
                                        >
                                            {selectedUsers.length === emails.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                        {emails.map((entry) => (
                                            <div 
                                                key={entry.id} 
                                                onClick={() => toggleUser(entry.email)}
                                                className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border ${selectedUsers.includes(entry.email) ? 'bg-black text-white border-black shadow-lg shadow-black/10' : 'bg-gray-50 text-gray-500 border-transparent hover:border-gray-200'}`}
                                            >
                                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition-all ${selectedUsers.includes(entry.email) ? 'bg-white border-white text-black' : 'bg-white border-gray-200 text-transparent'}`}>
                                                    <Plus size={12} className={selectedUsers.includes(entry.email) ? '' : 'hidden'} />
                                                </div>
                                                <span className="text-xs font-medium truncate">{entry.email}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Message Content</label>
                                        <textarea
                                            rows={6}
                                            value={campaignContent}
                                            onChange={(e) => setCampaignContent(e.target.value)}
                                            placeholder="Write your email content here..."
                                            className="w-full bg-gray-50 border border-transparent rounded-[2rem] p-6 outline-none focus:border-black focus:bg-white transition-all text-sm font-medium resize-none"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Attachments</label>
                                            <label className="cursor-pointer text-blue-500 hover:text-blue-600 transition-colors flex items-center gap-2">
                                                <Plus size={14} />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">Add Images</span>
                                                <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                                            </label>
                                        </div>
                                        
                                        <div className="grid grid-cols-4 gap-2">
                                            {uploadedImages.map((img, idx) => (
                                                <div key={idx} className="relative aspect-square rounded-xl overflow-hidden group border border-gray-100">
                                                    <img src={img} className="w-full h-full object-cover" />
                                                    <button 
                                                        onClick={() => removeImage(idx)}
                                                        className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X size={12} />
                                                    </button>
                                                </div>
                                            ))}
                                            {uploadedImages.length === 0 && (
                                                <div className="col-span-4 border-2 border-dashed border-gray-100 rounded-2xl h-24 flex items-center justify-center">
                                                    <ImageIcon size={20} className="text-gray-100" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="p-8 border-t border-gray-50 bg-gray-50/50 flex justify-end">
                            <button
                                onClick={handleSendMails}
                                disabled={campaignStatus === "sending" || selectedUsers.length === 0}
                                className={`h-16 px-12 rounded-full text-[11px] font-bold uppercase tracking-[0.2em] transition-all flex items-center gap-4 ${campaignStatus === "sending" || selectedUsers.length === 0 ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:scale-105 active:scale-95 shadow-xl shadow-blue-200'}`}
                            >
                                {campaignStatus === "sending" ? <RefreshCcw size={16} className="animate-spin" /> : <Send size={16} />}
                                {campaignStatus === "sending" ? 'Sending...' : `Send (${selectedUsers.length} mails)`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function CategoryManager() {
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCatName, setNewCatName] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    const fetchCategories = () => {
        setLoading(true);
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ categories { id name } }' })
        })
            .then(res => res.json())
            .then(data => {
                setCategories(data.data?.categories || []);
                setLoading(false);
            });
    };

    useEffect(() => { fetchCategories(); }, []);

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCatName.trim()) return;
        setIsSaving(true);
        try {
            await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($name: String!) { createCategory(name: $name) { id name } }`,
                    variables: { name: newCatName }
                })
            });
            setNewCatName("");
            fetchCategories();
        } catch (error) {
            console.error(error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("Voulez-vous vraiment supprimer cette catégorie ? Cela peut affecter les produits associés.")) return;
        try {
            await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($id: ID!) { deleteCategory(id: $id) }`,
                    variables: { id }
                })
            });
            fetchCategories();
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) return <div className="p-20 text-center text-gray-300 font-light tracking-[0.3em] uppercase">Chargement des catégories...</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
                <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl">
                    <h3 className="text-xl font-light mb-6">Nouvelle Catégorie</h3>
                    <form onSubmit={handleAdd} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-bold tracking-widest text-black/40 uppercase px-2">Nom de la catégorie</label>
                            <input
                                type="text"
                                value={newCatName}
                                onChange={(e) => setNewCatName(e.target.value)}
                                className="w-full bg-gray-50 rounded-2xl p-5 text-sm font-medium border border-transparent focus:border-black focus:bg-white transition-all outline-none"
                                placeholder="ex: Accessoires Edition"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="w-full h-14 bg-black text-white rounded-full text-[10px] font-bold uppercase tracking-[0.2em] hover:scale-[1.02] active:scale-95 transition-all shadow-xl shadow-black/10 flex items-center justify-center gap-2"
                        >
                            {isSaving ? <RefreshCcw size={14} className="animate-spin" /> : <Plus size={14} />}
                            Ajouter
                        </button>
                    </form>
                </div>
            </div>

            <div className="lg:col-span-8">
                <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-xl overflow-hidden">
                    <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white/50 backdrop-blur-md">
                        <div>
                            <h3 className="text-xl font-light tracking-tight">Liste des Catégories</h3>
                            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">{categories.length} segments actifs</p>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-50">
                        {categories.map((cat) => (
                            <div key={cat.id} className="flex justify-between items-center p-8 hover:bg-gray-50/50 transition-colors group">
                                <div className="flex items-center gap-6">
                                    <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center text-black/20 group-hover:text-black transition-colors">
                                        <Tags size={20} />
                                    </div>
                                    <span className="text-lg font-medium text-gray-700">{cat.name}</span>
                                </div>
                                <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="p-3 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
function ChatManager() {
    const [sessions, setSessions] = useState<any[]>([]);
    const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(true);

    const fetchSessions = () => {
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ chatSessions { id user_email created_at } }' })
        })
            .then(res => res.json())
            .then(data => {
                setSessions(data.data?.chatSessions || []);
                setLoading(false);
            });
    };

    const fetchMessages = () => {
        if (!selectedEmail) return;
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `query($email: String!) { chatHistory(email: $email) { id content sender_role created_at } }`,
                variables: { email: selectedEmail }
            })
        })
            .then(res => res.json())
            .then(data => {
                setMessages(data.data?.chatHistory || []);
            });
    };

    useEffect(() => { fetchSessions(); }, []);
    useEffect(() => {
        if (selectedEmail) {
            fetchMessages();
            const interval = setInterval(fetchMessages, 3000);
            return () => clearInterval(interval);
        }
    }, [selectedEmail]);

    const handleSend = async () => {
        if (!input.trim() || !selectedEmail) return;
        try {
            await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($email: String!, $content: String!, $role: String!) { 
            sendChatMessage(email: $email, content: $content, role: $role) { id }
          }`,
                    variables: { email: selectedEmail, content: input, role: 'ADMIN' }
                })
            });
            setInput("");
            fetchMessages();
        } catch (error) { console.error(error); }
    };

    const handleDeleteSession = async (email: string) => {
        if (!window.confirm(`Supprimer définitivement la conversation avec ${email} ?`)) return;
        try {
            await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($email: String!) { deleteChatSession(email: $email) }`,
                    variables: { email }
                })
            });
            if (selectedEmail === email) setSelectedEmail(null);
            fetchSessions();
        } catch (error) { console.error(error); }
    };

    if (loading) return <div className="p-20 text-center text-gray-300 font-light tracking-[0.3em] uppercase">Initialisation du Centre de Dialogue...</div>;

    return (
        <div className="flex h-[calc(100vh-250px)] bg-white rounded-[3rem] border border-gray-100 shadow-2xl overflow-hidden">
            {/* Session Sidebar */}
            <div className="w-80 border-r border-gray-50 flex flex-col bg-gray-50/30">
                <div className="p-8 border-b border-gray-50 bg-white/50 backdrop-blur-md">
                    <h3 className="text-lg font-light tracking-tight">Conversations</h3>
                </div>
                <div className="flex-1 overflow-y-auto">
                    {sessions.map(s => (
                        <div
                            key={s.id}
                            className={`group w-full p-4 hover:bg-white transition-all flex items-center gap-4 border-b border-gray-50/50 cursor-pointer ${selectedEmail === s.user_email ? 'bg-white shadow-sm border-l-4 border-l-black' : ''}`}
                            onClick={() => setSelectedEmail(s.user_email)}
                        >
                            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                                <UserIcon size={18} />
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-[11px] font-bold text-gray-800 truncate">{s.user_email}</p>
                                <p className="text-[9px] text-gray-400 mt-1 uppercase tracking-tighter">
                                    Initié le {s.created_at ? new Date(s.created_at).toLocaleDateString() : 'N/A'}
                                </p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); handleDeleteSession(s.user_email); }}
                                className="opacity-0 group-hover:opacity-100 p-2 text-gray-300 hover:text-red-500 transition-all"
                            >
                                <Trash2 size={14} />
                            </button>
                        </div>
                    ))}
                    {sessions.length === 0 && (
                        <div className="p-10 text-center text-gray-300 italic text-sm">Aucune session active</div>
                    )}
                </div>
            </div>

            {/* Chat Area */}
            <div className="flex-1 flex flex-col bg-white">
                {selectedEmail ? (
                    <>
                        <div className="p-8 border-b border-gray-50 flex justify-between items-center bg-white/80 backdrop-blur-md sticky top-0 z-10">
                            <div>
                                <h4 className="text-sm font-bold tracking-tight">{selectedEmail}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                    <span className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">Client en ligne</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 p-10 overflow-y-auto flex flex-col gap-6 custom-scrollbar bg-gray-50/20">
                            {messages.map(m => (
                                <div key={m.id} className={`flex flex-col ${m.sender_role === 'ADMIN' ? 'items-end' : 'items-start'}`}>
                                    <div className={`max-w-[70%] p-5 rounded-3xl text-sm font-medium ${m.sender_role === 'ADMIN' ? 'bg-black text-white rounded-tr-none shadow-xl shadow-black/10' : 'bg-white text-black border border-gray-100 rounded-tl-none shadow-sm'}`}>
                                        {m.content}
                                    </div>
                                    <span className="text-[9px] font-black text-gray-300 mt-3 uppercase tracking-widest">
                                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <div className="p-8 border-t border-gray-50 bg-white">
                            <div className="flex gap-4 items-center bg-gray-50 p-2 rounded-[2rem] border border-gray-100">
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent border-none outline-none px-6 text-sm font-medium"
                                    placeholder="Répondre au client..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                />
                                <button
                                    onClick={handleSend}
                                    className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-lg"
                                >
                                    <Send size={18} />
                                </button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-20">
                        <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-8">
                            <MessageCircle size={32} className="text-gray-200" />
                        </div>
                        <h4 className="text-2xl font-light text-gray-400">Canal de Dialogue SEAURA</h4>
                        <p className="text-gray-300 mt-4 max-w-sm text-sm">Sélectionnez une conversation pour initier une consultation artisanale en direct.</p>
                    </div>
                )}
            </div>
        </div>
    );
}


function OrderManager() {
    const [orders, setOrders] = useState<any[]>([]);
    const [activeCarts, setActiveCarts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                    query: `{ 
                        orders { id customer_email customer_phone total status payment_status created_at items { product_name quantity price size color } }
                        activeCarts { id session_id items updated_at }
                    }`
                })
            });
            const data = await res.json();
            if (data.errors) {
                console.error("GraphQL errors:", data.errors);
            }
            if (data.data?.orders) setOrders(data.data.orders);
            if (data.data?.activeCarts) setActiveCarts(data.data.activeCarts);
        } catch (err: any) { 
            console.error("Fetch error:", err);
        }
        finally { setLoading(false); }
    };

    useEffect(() => { 
        fetchData();
        const interval = setInterval(fetchData, 10000); // Rafraîchir toutes les 10 secondes
        return () => clearInterval(interval);
    }, []);

    const updateStatus = async (id: string, status: string) => {
        try {
            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: 'mutation($id: ID!, $status: String!) { updateOrderStatus(id: $id, status: $status) { id status } }',
                    variables: { id, status }
                })
            });
            const data = await res.json();
            if (data.data?.updateOrderStatus) {
                Swal.fire({ icon: 'success', title: 'Mis à jour !', text: 'Le statut de la commande a été mis à jour.', confirmButtonColor: '#000' });
                fetchData();
            }
        } catch (err) { console.error(err); }
    };

    const updatePaymentStatus = async (id: string, payment_status: string) => {
        try {
            await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: 'mutation($id: ID!, $payment_status: String!) { updateOrderPaymentStatus(id: $id, payment_status: $payment_status) { id payment_status } }',
                    variables: { id, payment_status }
                })
            });
            fetchData();
        } catch (err) { console.error(err); }
    };

    if (loading) return <div className="flex h-full items-center justify-center font-black tracking-[0.5em] text-black/5 animate-pulse uppercase">Chargement en temps réel...</div>;

    return (
        <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            {/* Live Section */}
            <div>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-200 animate-pulse">
                        <Monitor size={16} />
                    </div>
                    <div>
                        <h3 className="text-xl font-light tracking-tight">Paniers Actifs (Live — {activeCarts.length} sessions)</h3>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Visiteurs en train de choisir</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {(activeCarts || []).length === 0 ? (
                        <div className="lg:col-span-3 bg-white/50 border border-dashed border-gray-200 rounded-[2rem] p-12 text-center">
                            <p className="text-gray-400 text-sm font-light italic">Aucune activité détectée pour le moment.</p>
                        </div>
                    ) : (
                        (activeCarts || []).map((cart: any) => {
                            if (!cart) return null;
                            let items = [];
                            try { 
                                items = typeof cart.items === 'string' ? JSON.parse(cart.items) : (cart.items || []);
                                if (!Array.isArray(items)) items = [];
                            } catch (e) { items = []; }
                            
                            const total = items.reduce((sum: number, it: any) => {
                                const p = parseFloat(it.price || 0);
                                return sum + (isNaN(p) ? 0 : p);
                            }, 0);
                            
                            return (
                                <div key={cart.id} className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-xl group hover:-translate-y-2 transition-all duration-500">
                                    <div className="flex justify-between items-start mb-6">
                                        <div className="text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-4 py-1.5 rounded-full">Session: {String(cart.session_id || '').substring(0, 8) || 'Anon'}</div>
                                        <div className="text-[9px] text-gray-400 font-bold uppercase tracking-tighter">
                                            {cart.updated_at ? new Date(cart.updated_at).toLocaleTimeString() : 'Recent'}
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        {items.length === 0 ? (
                                             <p className="text-[10px] italic text-gray-300">Exploration en cours (Sac vide)</p>
                                        ) : items.map((item: any, i: number) => (
                                            <div key={i} className="flex gap-4 items-center border-b border-gray-50 pb-4 last:border-none last:pb-0">
                                                <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center text-[10px] font-bold">{i+1}</div>
                                                <div>
                                                    <p className="text-sm font-bold tracking-tight">{item.name || 'Produit'}</p>
                                                    <p className="text-[9px] uppercase font-black tracking-widest text-gray-400">{item.selectedSize || 'Unique'} — {item.selectedColor || 'Par défaut'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="mt-8 pt-6 border-t border-gray-50 flex justify-between items-end">
                                        <p className="text-[9px] font-black uppercase tracking-widest text-black/20">Estimation</p>
                                        <p className="text-2xl font-light tracking-tighter">{total.toFixed(2)} €</p>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Confirmed Orders Section */}
            <div>
                <div className="flex items-center gap-4 mb-8">
                    <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center shadow-lg">
                        <ShoppingBag size={16} />
                    </div>
                    <div>
                        <h3 className="text-xl font-light tracking-tight">Commandes Finalisées</h3>
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">Historique des ventes confirmées</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-8">
                    {orders.length === 0 ? (
                        <div className="bg-white rounded-[3rem] p-20 text-center border border-gray-100 italic text-gray-300 font-light">
                            Aucune commande confirmée à ce jour.
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div key={order.id} className="bg-white rounded-[3rem] p-12 border border-blue-50/50 shadow-2xl shadow-blue-50/20 overflow-hidden group hover:shadow-black/5 transition-all duration-700 relative">
                                <div className="flex flex-col lg:flex-row justify-between items-start gap-12">
                                    <div className="flex-1 space-y-6">
                                        <div className="flex items-center flex-wrap gap-4">
                                            <span className="bg-gray-100 text-gray-500 px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] group-hover:bg-black group-hover:text-white transition-colors duration-500">REF: SEA-{order.id}</span>
                                            <span className="text-gray-300 text-[10px] font-bold uppercase tracking-widest">{order.created_at ? new Date(order.created_at).toLocaleString('fr-FR') : 'N/A'}</span>
                                            <div className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-500 ${order.status === 'COMPLETED' ? 'bg-green-50 border-green-100 text-green-600 shadow-sm shadow-green-100' : 'bg-orange-50 border-orange-100 text-orange-600 animate-pulse'}`}>
                                                {order.status === 'COMPLETED' ? 'LIVRÉE' : 'EN PRÉPARATION'}
                                            </div>
                                            <button 
                                                onClick={() => updatePaymentStatus(order.id, order.payment_status === 'PAID' ? 'UNPAID' : 'PAID')}
                                                className={`px-6 py-2 rounded-full text-[9px] font-black uppercase tracking-widest border transition-all duration-500 flex items-center gap-2 ${order.payment_status === 'PAID' ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-100 hover:border-black hover:text-black'}`}
                                            >
                                                <DollarSign size={10} />
                                                {order.payment_status === 'PAID' ? 'PAYÉE' : 'MARQUER COMME PAYÉE'}
                                            </button>
                                        </div>
                                        
                                        <div>
                                            <h3 className="text-4xl font-light tracking-tight group-hover:translate-x-4 transition-transform duration-700">{order.customer_email}</h3>
                                            <div className="text-gray-400 font-bold uppercase tracking-[0.2em] text-[11px] mt-3 flex items-center gap-3">
                                                <div className="w-2 h-2 bg-black rounded-full" /> {order.customer_phone}
                                            </div>
                                        </div>
                                        
                                        <div className="mt-12 pt-12 border-t border-gray-50 space-y-4">
                                            <h4 className="text-[10px] font-black uppercase tracking-[0.5em] text-black/10 mb-6 italic">Articles commandés</h4>
                                            {order.items?.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between items-center py-6 border-b border-gray-50 last:border-none group/item hover:bg-gray-50/50 px-4 rounded-2xl transition-all">
                                                    <div className="flex items-center gap-6">
                                                      <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 font-bold text-lg">
                                                        {idx + 1}
                                                      </div>
                                                      <div>
                                                          <p className="font-bold text-lg tracking-tight group-hover/item:text-blue-600 transition-colors uppercase">{item.product_name}</p>
                                                          <div className="flex gap-4 mt-1.5 translate-y-2 opacity-0 group-hover/item:translate-y-0 group-hover/item:opacity-100 transition-all duration-500">
                                                            <span className="text-[10px] uppercase font-black tracking-widest bg-gray-100 px-3 py-1 rounded-full text-gray-500">Taille: {item.size}</span>
                                                            <span className="text-[10px] uppercase font-black tracking-widest bg-gray-100 px-3 py-1 rounded-full text-gray-500">Couleur: {item.color}</span>
                                                          </div>
                                                      </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-black text-xl tracking-tighter">{item.price} €</p>
                                                        <p className="text-[9px] uppercase font-black tracking-widest text-black/20 mt-1">Quantité: {item.quantity}</p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    
                                    <div className="w-full lg:w-80 bg-gray-50/50 rounded-[2.5rem] p-10 flex flex-col justify-between gap-12 border border-gray-100 backdrop-blur-sm group-hover:bg-white transition-colors duration-700 shadow-inner">
                                        <div className="space-y-2">
                                            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-black/20 italic">Montant Total</p>
                                            <p className="text-6xl font-light tracking-tighter group-hover:scale-110 transition-transform duration-700 origin-left">{order.total}<span className="text-2xl ml-2 tracking-normal uppercase">€</span></p>
                                        </div>
                                        <div className="space-y-4">
                                            {order.status === 'PENDING' ? (
                                                <button 
                                                    onClick={() => updateStatus(order.id, 'COMPLETED')}
                                                    className="w-full h-16 bg-black text-white rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-2xl shadow-black/20 flex items-center justify-center gap-4 group/btn"
                                                >
                                                    <Save size={18} className="group-hover/btn:rotate-12 transition-transform" /> Confirmer Livraison
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => updateStatus(order.id, 'PENDING')}
                                                    className="w-full h-16 bg-gray-100 text-gray-400 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.3em] hover:bg-black hover:text-white transition-all duration-500 flex items-center justify-center gap-4"
                                                >
                                                    <RefreshCcw size={18} /> Remettre en attente
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function AccountingManager() {
    const [orders, setOrders] = useState<any[]>([]);
    const [charges, setCharges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [isAddingCharge, setIsAddingCharge] = useState(false);
    const [showSalesModal, setShowSalesModal] = useState(false);
    const [newCharge, setNewCharge] = useState({ description: "", amount: "", category: "Stock", date: new Date().toISOString().split('T')[0] });

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: '{ orders { total payment_status customer_email created_at items { product_name quantity price size color } } charges { id description amount category date } }'
                })
            });
            const data = await res.json();
            setOrders(data.data?.orders || []);
            setCharges(data.data?.charges || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const totalRevenue = orders
        .filter(o => o.payment_status === 'PAID')
        .reduce((sum, o) => sum + parseFloat(o.total), 0);

    const totalExpenses = charges.reduce((sum, c) => sum + parseFloat(c.amount), 0);
    const totalProfit = totalRevenue - totalExpenses;

    const handleAddCharge = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await fetch('/api/graphql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: `mutation($description: String!, $amount: Float!, $category: String, $date: String) {
                        createCharge(description: $description, amount: $amount, category: $category, date: $date) { id }
                    }`,
                    variables: {
                        ...newCharge,
                        amount: parseFloat(newCharge.amount)
                    }
                })
            });
            setIsAddingCharge(false);
            setNewCharge({ description: "", amount: "", category: "Stock", date: new Date().toISOString().split('T')[0] });
            fetchData();
        } catch (e) { }
    };

    const handleDeleteCharge = async (id: string) => {
        if (!confirm("Supprimer cette charge ?")) return;
        await fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query: `mutation($id: ID!) { deleteCharge(id: $id) }`,
                variables: { id }
            })
        });
        fetchData();
    };

    return (
        <div className="space-y-12 pb-20">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div 
                    onClick={() => setShowSalesModal(true)}
                    className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all cursor-pointer"
                >
                    <div className="absolute top-[-20px] right-[-20px] bg-green-50 w-32 h-32 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <TrendingUp size={40} className="text-green-500 opacity-20" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">Chiffre d'Affaires (Payé)</p>
                    <h3 className="text-4xl font-light">{totalRevenue.toLocaleString()} €</h3>
                    <div className="mt-6 flex items-center gap-2 text-green-500 font-bold text-[10px]">
                        <Plus size={12} /> VOIR DÉTAIL DES VENTES
                    </div>
                </div>

                <div className="bg-white rounded-[3rem] p-10 border border-gray-100 shadow-xl relative overflow-hidden group hover:shadow-2xl transition-all">
                    <div className="absolute top-[-20px] right-[-20px] bg-red-50 w-32 h-32 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <TrendingDown size={40} className="text-red-500 opacity-20" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-2">Total des Charges</p>
                    <h3 className="text-4xl font-light">{totalExpenses.toLocaleString()} €</h3>
                    <div className="mt-6 flex items-center gap-2 text-red-500 font-bold text-[10px]">
                        <Minus size={12} /> DÉPENSÉ
                    </div>
                </div>

                <div className="bg-black rounded-[3rem] p-10 shadow-2xl relative overflow-hidden group hover:scale-105 transition-all text-white">
                    <div className="absolute top-[-20px] right-[-20px] bg-white/10 w-32 h-32 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                        <DollarSign size={40} className="text-white opacity-20" />
                    </div>
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/40 mb-2">Bénéfice Net</p>
                    <h3 className="text-4xl font-light">{totalProfit.toLocaleString()} €</h3>
                    <div className="mt-6 flex items-center gap-2 text-white/60 font-bold text-[10px]">
                        <PieChart size={12} /> PERFORMANCE
                    </div>
                </div>
            </div>

            {/* Charges Management */}
            <div className="bg-white rounded-[3rem] shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-10 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Calculator className="text-gray-300" />
                        <h3 className="text-xl font-light">Gestion des Charges & Achats</h3>
                    </div>
                    <button
                        onClick={() => setIsAddingCharge(true)}
                        className="bg-black text-white px-8 py-3 rounded-full text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all flex items-center gap-2"
                    >
                        <Plus size={16} /> Ajouter une Charge
                    </button>
                </div>

                <div className="p-2 overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.2em] border-b border-gray-50">
                                <th className="px-10 py-6">Date</th>
                                <th className="px-6 py-6">Description</th>
                                <th className="px-6 py-6">Catégorie</th>
                                <th className="px-6 py-6">Montant</th>
                                <th className="px-10 py-6 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {charges.map((c: any) => (
                                <tr key={c.id} className="hover:bg-gray-50/50 transition-colors">
                                    <td className="px-10 py-6 text-xs text-gray-400 font-medium">
                                        {new Date(c.date).toLocaleDateString('fr-FR')}
                                    </td>
                                    <td className="px-6 py-6 font-medium text-sm">{c.description}</td>
                                    <td className="px-6 py-6">
                                        <span className="text-[9px] font-black uppercase tracking-widest bg-gray-100 px-3 py-1.5 rounded-full text-gray-500">
                                            {c.category || "Autre"}
                                        </span>
                                    </td>
                                    <td className="px-6 py-6 text-sm font-bold text-red-500">-{c.amount} €</td>
                                    <td className="px-10 py-6 text-right">
                                        <button onClick={() => handleDeleteCharge(c.id)} className="p-3 hover:bg-red-50 text-red-300 hover:text-red-500 transition-all rounded-full">
                                            <Trash2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {charges.length === 0 && (
                                <tr><td colSpan={5} className="p-20 text-center text-gray-300 italic font-light">Aucune charge enregistrée.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Add Charge */}
            {isAddingCharge && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center p-8" onClick={() => setIsAddingCharge(false)}>
                    <div className="bg-white rounded-[3rem] p-12 max-w-xl w-full shadow-2xl animate-in zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                        <h3 className="text-2xl font-light mb-10">Nouvelle Dépense</h3>
                        <form onSubmit={handleAddCharge} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Date d'achat</label>
                                <input
                                    type="date" required
                                    className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                    value={newCharge.date}
                                    onChange={e => setNewCharge({ ...newCharge, date: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Description / Article</label>
                                <input
                                    required
                                    className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                    value={newCharge.description}
                                    onChange={e => setNewCharge({ ...newCharge, description: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Montant (€)</label>
                                    <input
                                        required type="number" step="0.01"
                                        className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                        value={newCharge.amount}
                                        onChange={e => setNewCharge({ ...newCharge, amount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Catégorie</label>
                                    <select
                                        className="w-full h-14 bg-gray-50 border border-gray-100 rounded-2xl px-6 outline-none focus:border-black transition-all"
                                        value={newCharge.category}
                                        onChange={e => setNewCharge({ ...newCharge, category: e.target.value })}
                                    >
                                        <option value="Stock">Stock / Matériel</option>
                                        <option value="Marketing">Marketing / Pub</option>
                                        <option value="Services">Services / Logiciels</option>
                                        <option value="Autre">Autre</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-10">
                                <button type="button" onClick={() => setIsAddingCharge(false)} className="flex-1 h-16 rounded-full border border-gray-100 text-[11px] font-bold uppercase tracking-widest text-gray-400">Annuler</button>
                                <button type="submit" className="flex-1 h-16 rounded-full bg-black text-white text-[11px] font-bold uppercase tracking-widest hover:scale-105 transition-all">Enregistrer</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Sales Details Modal */}
            {showSalesModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[300] flex items-center justify-center p-8" onClick={() => setShowSalesModal(false)}>
                    <div className="bg-white rounded-[1.5rem] md:rounded-[3rem] w-full max-w-5xl h-[90vh] md:h-[80vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-300 overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-8 md:p-12 border-b border-gray-50 flex justify-between items-center">
                            <div>
                                <h3 className="text-2xl md:text-3xl font-light tracking-tight">Journal des Ventes</h3>
                                <p className="text-[9px] md:text-xs text-gray-400 font-bold uppercase tracking-[0.2em] mt-2">Détail des produits vendus (Commandes Payées uniquement)</p>
                            </div>
                            <button onClick={() => setShowSalesModal(false)} className="w-10 h-10 md:w-12 md:h-12 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-all">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
                            <div className="min-w-[800px]">
                                <table className="w-full text-left border-separate border-spacing-y-4">
                                    <thead>
                                        <tr className="text-[10px] text-gray-400 font-black uppercase tracking-[0.3em]">
                                            <th className="px-6 py-4">Date</th>
                                            <th className="px-6 py-4">Client</th>
                                            <th className="px-6 py-4">Produit</th>
                                            <th className="px-6 py-4">Options</th>
                                            <th className="px-6 py-4">Quantité</th>
                                            <th className="px-6 py-4 text-right">Prix HT</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {orders
                                            .filter(o => o.payment_status === 'PAID')
                                            .map(order => (
                                                order.items?.map((item: any, idx: number) => (
                                                    <tr key={`${order.id}-${idx}`} className="group hover:bg-gray-50 transition-all rounded-2xl overflow-hidden shadow-sm shadow-black/5 bg-white border border-gray-50">
                                                        <td className="px-6 py-6 rounded-l-2xl text-[10px] font-bold text-gray-400">
                                                            {new Date(order.created_at).toLocaleDateString('fr-FR')}
                                                        </td>
                                                        <td className="px-6 py-6 text-xs font-medium italic text-gray-500">
                                                            {order.customer_email}
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <p className="text-sm font-bold uppercase tracking-tight text-black">{item.product_name}</p>
                                                        </td>
                                                        <td className="px-6 py-6">
                                                            <div className="flex gap-2">
                                                                <span className="text-[8px] font-black tracking-widest bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-md uppercase text-gray-400">{item.size}</span>
                                                                <span className="text-[8px] font-black tracking-widest bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-md uppercase text-gray-400">{item.color}</span>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-6 text-sm font-medium">
                                                            x{item.quantity}
                                                        </td>
                                                        <td className="px-6 py-6 rounded-r-2xl text-right font-black text-sm tracking-tighter text-black">
                                                            {item.price} €
                                                        </td>
                                                    </tr>
                                                ))
                                            ))
                                        }
                                    </tbody>
                                </table>
                            </div>
                            {orders.filter(o => o.payment_status === 'PAID').length === 0 && (
                                <div className="py-20 text-center">
                                    <p className="text-gray-300 italic font-light">Aucune vente enregistrée pour le moment.</p>
                                </div>
                            )}
                        </div>
                        
                        <div className="p-8 md:p-10 bg-gray-50/50 border-t border-gray-50 flex justify-between items-center px-8 md:px-12">
                            <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest text-black/20">Synthèse Global</p>
                            <div className="flex gap-8 md:gap-12">
                                <div className="text-right">
                                    <p className="text-[7px] md:text-[8px] font-bold uppercase text-gray-400 mb-1">Total Items</p>
                                    <p className="text-lg md:text-xl font-light">
                                        {orders
                                            .filter(o => o.payment_status === 'PAID')
                                            .reduce((sum, o) => sum + (o.items?.reduce((iSum: number, i: any) => iSum + i.quantity, 0) || 0), 0)
                                        } Produits
                                    </p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[7px] md:text-[8px] font-bold uppercase text-gray-400 mb-1">Chiffre d'Affaires</p>
                                    <p className="text-lg md:text-xl font-bold tracking-tighter text-green-600">{totalRevenue.toLocaleString()} €</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function Minus({ size, className }: { size: number, className?: string }) {
    return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><line x1="5" y1="12" x2="19" y2="12" /></svg>;
}

