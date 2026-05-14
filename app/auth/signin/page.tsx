"use client";

import { signIn } from "next-auth/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Swal from 'sweetalert2';
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";

export default function SignIn() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const router = useRouter();

    const [signinImage, setSigninImage] = useState("/images/clothing.png");

    useEffect(() => {
        fetch('/api/graphql', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ homeContent { key value } }' })
        })
        .then(res => res.json())
        .then(data => {
            const img = data.data?.homeContent?.find((item: any) => item.key === 'auth_signin_image');
            if (img?.value) setSigninImage(img.value);
        })
        .catch(err => console.error("CMS Fetch Error:", err));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const res = await signIn("credentials", {
            email,
            password,
            redirect: false,
        });

        if (res?.ok) {
            // Fetch session to determine role
            const sessionRes = await fetch("/api/auth/session");
            const session = await sessionRes.json();

            if (session?.user?.role === "ADMIN") {
                router.push("/admin/dashboard");
            } else {
                router.push("/dashboard");
            }
        } else {
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: 'Email ou mot de passe incorrect.',
                confirmButtonColor: '#000'
            });
        }
    };

    return (
        <div className="flex flex-col md:flex-row h-screen w-full bg-white overflow-hidden font-sans">

            {/* Left: The Immersive Vision (Full Height) */}
            <div className="hidden lg:block lg:w-[55%] relative overflow-hidden group">
                <img
                    src={signinImage}
                    alt="SEAURA Vision"
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-[20s] ease-out group-hover:scale-105"
                />

                {/* Subtle Luxury Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                <div className="absolute bottom-16 left-16 z-10 text-white animate-in slide-in-from-bottom-5 duration-1000">
                    <p className="text-[10px] uppercase font-bold tracking-[0.6em] mb-4 opacity-70">Plateforme Officielle</p>
                    <h2 className="text-8xl font-thin tracking-[0.1em] leading-none mb-4">SEAURA</h2>
                    <div className="h-[1px] w-24 bg-white/30" />
                </div>
            </div>

            {/* Right: The High-End Form Area (Full Height) */}
            <div className="w-full lg:w-[45%] flex flex-col justify-center p-8 md:p-24 bg-white relative">

                {/* Top Corner Brand Info */}


                <div className="w-full max-w-[420px] mx-auto animate-in fade-in slide-in-from-right-10 duration-1000">
                    <div className="mb-20">
                        <span className="text-[10px] font-bold tracking-[0.6em] text-gray-300 uppercase block mb-4">Portail Membre</span>
                        <h1 className="text-6xl font-extralight tracking-tight text-black mb-6">Connexion</h1>
                        <p className="text-sm font-medium text-gray-400">Veuillez entrer vos accès sécurisés pour continuer.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-10 text-left">
                        <div className="space-y-8">
                            {/* Premium Input: Email */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold tracking-[0.2em] text-black/50 uppercase ml-1">E-mail</label>
                                <input
                                    type="email"
                                    className="w-full h-[72px] bg-gray-50 border border-gray-100 rounded-[22px] px-8 py-5 outline-none focus:bg-white focus:ring-8 focus:ring-black/5 focus:border-black transition-all duration-300 text-sm font-medium placeholder:text-gray-200"
                                    placeholder="exemple@seaura.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>

                            {/* Premium Input: Password */}
                            <div className="space-y-3">
                                <label className="text-[11px] font-bold tracking-[0.2em] text-black/50 uppercase ml-1">Mot de passe</label>
                                <div className="relative group/pass">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        className="w-full h-[72px] bg-gray-50 border border-gray-100 rounded-[22px] px-8 py-5 outline-none focus:bg-white focus:ring-8 focus:ring-black/5 focus:border-black transition-all duration-300 text-sm font-medium placeholder:text-gray-200"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-6 top-1/2 -translate-y-1/2 p-2 text-gray-300 hover:text-black transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={20} strokeWidth={1.5} /> : <Eye size={20} strokeWidth={1.5} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 space-y-10">
                            <button className="relative w-full h-[75px] bg-black text-white rounded-[22px] hover:bg-gray-800 transition-all duration-300 tracking-[0.5em] text-[12px] font-bold uppercase overflow-hidden active:scale-[0.98] shadow-2xl shadow-black/10">
                                <span className="relative z-10">Se Connecter</span>
                            </button>

                            <div className="flex flex-col items-center gap-8">
                                <Link
                                    href="/auth/signup"
                                    className="text-[11px] text-gray-400 hover:text-black transition-all tracking-[0.25em] uppercase font-bold border-b border-gray-50 pb-2 hover:border-black"
                                >
                                    Rejoignez Nous
                                </Link>

                                <Link
                                    href="/"
                                    className="group flex items-center gap-6 text-[10px] text-gray-300 hover:text-gray-500 transition-colors tracking-widest uppercase font-medium"
                                >
                                    <div className="h-[1px] w-12 bg-gray-100 group-hover:w-20 group-hover:bg-gray-300 transition-all" />
                                    Retour
                                    <div className="h-[1px] w-12 bg-gray-100 group-hover:w-20 group-hover:bg-gray-300 transition-all" />
                                </Link>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

