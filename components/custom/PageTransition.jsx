"use client"
import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

const PageTransition = ({ children }) => {
    const pathname = usePathname();
    const reduceMotion = useReducedMotion();
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [displayChildren, setDisplayChildren] = useState(children);
    const [shouldShowContent, setShouldShowContent] = useState(true);
    const prevPathnameRef = useRef(pathname);
    const prevChildrenRef = useRef(children);
    const isWorkspaceRoute = pathname?.includes('/workspace');
    const shouldAnimate = !reduceMotion && !isWorkspaceRoute;

    useEffect(() => {
        const prevPathname = prevPathnameRef.current;
        if (prevPathname === pathname) return;

        prevPathnameRef.current = pathname;

        if (!shouldAnimate) {
            setDisplayChildren(children);
            setIsTransitioning(false);
            setShouldShowContent(true);
            return;
        }

        setIsTransitioning(true);
        setShouldShowContent(false);
        setDisplayChildren(prevChildrenRef.current);

        // Faster swap + reveal for better responsiveness
        const swapTimer = setTimeout(() => {
            setDisplayChildren(children);
        }, 280);

        const endTimer = setTimeout(() => {
            setIsTransitioning(false);
            setShouldShowContent(true);
        }, 700);

        return () => {
            clearTimeout(swapTimer);
            clearTimeout(endTimer);
        };
    }, [pathname, children, shouldAnimate]);

    useEffect(() => {
        prevChildrenRef.current = children;
    }, [children]);

    return (
        <div className={`relative h-full ${!pathname?.includes('/workspace') ? 'min-h-screen' : ''} bg-background`}>
            {/* The actual page content - Hidden during transition */}
            <div className={`h-full transition-all duration-700 ${shouldShowContent ? 'opacity-100 scale-100 blur-0' : 'opacity-0 scale-95 blur-md'}`}>
                {isTransitioning ? displayChildren : children}
            </div>

            {/* Heavy Vault Doors */}
            <AnimatePresence>
                {isTransitioning && (
                    <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[99999] pointer-events-none flex overflow-hidden backdrop-blur-sm"
                    >
                        {/* Left Door */}
                        <motion.div
                            initial={{ x: '-100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '-100%' }}
                            transition={{ 
                                duration: 0.45, 
                                ease: [0.85, 0, 0.15, 1],
                            }}
                            className="w-1/2 h-full bg-card/95 border-r-[16px] border-border shadow-[40px_0_100px_rgba(0,0,0,0.3)] dark:shadow-[40px_0_100px_rgba(0,0,0,1)] relative flex items-center justify-end overflow-hidden"
                        >
                            {/* Texture/Industrial Look - Theme Aware */}
                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-background/10 to-background/40 dark:to-black/60" />
                            
                            {/* Vertical Reinforcement Bars */}
                            <div className="absolute inset-y-0 right-12 w-24 flex flex-col justify-around py-20 opacity-20 dark:opacity-30">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-40 w-full bg-gradient-to-b from-border/50 via-border to-border/50 dark:from-[#111] dark:via-[#222] dark:to-[#111] border-x-2 border-white/5 shadow-2xl" />
                                ))}
                            </div>

                            {/* Digital Status Bars */}
                            <div className="mr-24 flex flex-col gap-4 opacity-30 dark:opacity-40 scale-150">
                                {[...Array(5)].map((_, i) => (
                                    <motion.div 
                                        key={i}
                                        animate={{ width: [20, 100, 20] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                                        className="h-1 bg-primary/40 rounded-full" 
                                    />
                                ))}
                            </div>
                            
                            {/* Large Rivets */}
                            <div className="absolute right-6 inset-y-0 flex flex-col justify-around py-10 opacity-30 dark:opacity-40">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-border via-card to-border dark:from-[#333] dark:to-[#111] border border-white/5 shadow-inner" />
                                ))}
                            </div>
                        </motion.div>

                        {/* Right Door */}
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ 
                                duration: 0.45, 
                                ease: [0.85, 0, 0.15, 1],
                            }}
                            className="w-1/2 h-full bg-card/95 border-l-[16px] border-border shadow-[-40px_0_100px_rgba(0,0,0,0.3)] dark:shadow-[-40px_0_100px_rgba(0,0,0,1)] relative flex items-center justify-start overflow-hidden"
                        >
                            <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
                            <div className="absolute inset-0 bg-gradient-to-l from-transparent via-background/10 to-background/40 dark:to-black/60" />
                            
                            {/* Vertical Reinforcement Bars */}
                            <div className="absolute inset-y-0 left-12 w-24 flex flex-col justify-around py-20 opacity-20 dark:opacity-30">
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} className="h-40 w-full bg-gradient-to-b from-border/50 via-border to-border/50 dark:from-[#111] dark:via-[#222] dark:to-[#111] border-x-2 border-white/5 shadow-2xl" />
                                ))}
                            </div>

                            {/* Digital Status Bars */}
                            <div className="ml-24 flex flex-col gap-4 opacity-30 dark:opacity-40 scale-150">
                                {[...Array(5)].map((_, i) => (
                                    <motion.div 
                                        key={i}
                                        animate={{ width: [20, 100, 20] }}
                                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 + 0.5 }}
                                        className="h-1 bg-primary/40 rounded-full" 
                                    />
                                ))}
                            </div>
                            
                            {/* Large Rivets */}
                            <div className="absolute left-6 inset-y-0 flex flex-col justify-around py-10 opacity-30 dark:opacity-40">
                                {[...Array(12)].map((_, i) => (
                                    <div key={i} className="h-6 w-6 rounded-full bg-gradient-to-br from-border via-card to-border dark:from-[#333] dark:to-[#111] border border-white/5 shadow-inner" />
                                ))}
                            </div>
                        </motion.div>
                        
                        {/* Center Unit - Rectangular Console */}
                        <motion.div
                            initial={{ scaleX: 0, opacity: 0, x: '-50%', y: '-50%' }}
                            animate={{ scaleX: 1, opacity: 1, x: '-50%', y: '-50%' }}
                            exit={{ scaleX: 0, opacity: 0, x: '-50%', y: '-50%' }}
                            transition={{ 
                                delay: 0.2,
                                duration: 0.3,
                                ease: "circOut"
                            }}
                            className="absolute top-1/2 left-1/2 z-[100000] w-[320px] md:w-[400px] h-[100px] md:h-[120px] bg-card border-y-4 border-primary/60 shadow-[0_0_80px_rgba(255,0,0,0.2)] dark:shadow-[0_0_80px_rgba(255,0,0,0.4)] flex flex-col items-center justify-center gap-4 overflow-hidden"
                        >
                            {/* Console Background Pattern */}
                            <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.1)_50%,transparent_100%)] bg-[length:20px_100%]" />
                            
                            {/* Main Display Area */}
                            <div className="relative z-10 w-full px-8">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-[8px] md:text-[10px] font-black text-primary/80 uppercase tracking-[0.4em] animate-pulse">System Access</span>
                                    <span className="text-[6px] md:text-[8px] font-mono text-primary/40 uppercase">Auth: 128-Bit</span>
                                </div>
                                
                                <div className="h-2 md:h-3 w-full bg-background/40 border border-primary/20 rounded-sm relative overflow-hidden">
                                    <motion.div 
                                        animate={{ x: ['-100%', '100%'] }}
                                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-primary/60 to-transparent"
                                    />
                                </div>
                                
                                <div className="mt-3 md:mt-4 text-center">
                                    <span className="text-[10px] md:text-[12px] font-black text-primary uppercase tracking-[0.6em] md:tracking-[1em] drop-shadow-[0_0_8px_rgba(255,0,0,0.5)] dark:drop-shadow-[0_0_8px_rgba(255,0,0,0.8)]">
                                        {pathname?.includes('/workspace') ? 'Architecting...' : 'Loading...'}
                                    </span>
                                </div>
                            </div>

                            {/* Scanning laser line inside console */}
                            <motion.div 
                                animate={{ top: ['0%', '100%'] }}
                                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                className="absolute inset-x-0 h-[2px] bg-primary shadow-[0_0_15px_rgba(255,0,0,1)] z-20"
                            />
                        </motion.div>

                        {/* Global Scanning Beam */}
                        <motion.div 
                            animate={{ top: ['-20%', '120%'] }}
                            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                            className="fixed inset-x-0 h-[4px] bg-primary/10 dark:bg-primary/20 blur-md z-[100001] pointer-events-none"
                        />
                        
                        {/* Screen Shake Overlay */}
                        <motion.div 
                            animate={{ 
                                x: [0, -2, 2, -2, 0],
                                y: [0, 2, -2, 2, 0]
                            }}
                            transition={{ 
                                delay: 0.5,
                                duration: 0.15,
                                repeat: 1
                            }}
                            className="absolute inset-0 pointer-events-none bg-primary/5 dark:bg-primary/10 mix-blend-overlay"
                        />
                    </motion.div>
                )}
            </AnimatePresence>
            
            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

export default PageTransition;
