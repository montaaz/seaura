"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface LoadingScreenProps {
    duration?: number;
    onComplete?: () => void;
}

export default function LoadingScreen() {
    return (
        <div className="fixed inset-0 z-[9999] bg-[#F8F3E8] flex flex-col items-center justify-center transition-opacity duration-1000">
            <div className="relative mb-8 group">
                {/* Rotating Circle */}
                <div className="w-64 h-64 border-[0.5px] border-black/10 rounded-full absolute -inset-4 animate-[spin_10s_linear_infinite]" />
                <div className="w-64 h-64 border-t-[1.5px] border-black/80 rounded-full absolute -inset-4 animate-[spin_3s_cubic-bezier(0.4,0,0.2,1)_infinite]" />
                
                {/* Logo Container */}
                <div className="w-56 h-56 rounded-full border-[0.5px] border-black/5 flex items-center justify-center bg-[#F8F3E8] relative z-10">
                    <h1 className="text-4xl md:text-5xl font-light tracking-[0.6em] text-black/90 ml-[0.6em] uppercase" style={{ fontFamily: 'var(--font-kalnia), serif' }}>
                        Seaura
                    </h1>
                </div>
            </div>

            {/* Loading Text */}
            <div className="flex flex-col items-center gap-4">
                <span className="text-[10px] font-black uppercase tracking-[0.8em] text-black/40 animate-pulse">
                    Chargement...
                </span>
                <div className="w-48 h-[1px] bg-black/5 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black/40 animate-[loadingLine_3s_ease-in-out_infinite]" />
                </div>
            </div>

            <style jsx>{`
                @keyframes loadingLine {
                    0% { transform: translateX(-100%); }
                    50% { transform: translateX(0); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
