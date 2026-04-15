"use client";

import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface LoadingScreenProps {
    duration?: number;
    onComplete?: () => void;
}

export default function LoadingScreen({ duration = 3000, onComplete }: { duration?: number; onComplete?: () => void }) {
    const [isVisible, setIsVisible] = useState(true);
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        const intervalTime = 20;
        const totalSteps = duration / intervalTime;
        const stepAmount = 100 / totalSteps;
        
        const progressTimer = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(progressTimer);
                    return 100;
                }
                return prev + stepAmount;
            });
        }, intervalTime);

        const completionTimer = setTimeout(() => {
            setIsVisible(false);
            if (onComplete) onComplete();
        }, duration + 500); // Small delay after bar is full

        return () => {
            clearInterval(progressTimer);
            clearTimeout(completionTimer);
        };
    }, [duration, onComplete]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center transition-opacity duration-1000">
            <div className="flex flex-col items-center w-[360px]"> {/* Unified container for alignment */}
                <div className="mb-12 w-full flex justify-center">
                    <Image
                        src="/logo1.png"
                        alt="SEAURA Logo"
                        width={360}
                        height={90}
                        className="object-contain"
                        priority
                    />
                </div>

                <div className="w-[230px] h-[3px] bg-black/5 relative overflow-hidden mx-auto">
                    <div 
                        className="absolute h-full left-0 top-0 bg-black transition-all duration-100 ease-linear" 
                        style={{ width: `${progress}%` }}
                    />
                </div>
            </div>
        </div>
    );
}

