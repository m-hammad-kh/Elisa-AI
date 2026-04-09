"use client"
import React from 'react';
import { motion } from 'framer-motion';
import { Brain, Zap, Clock, Rocket, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useUser, useClerk } from '@clerk/clerk-react';

const FOMOSection = () => {
    const { user } = useUser();
    const { openSignIn } = useClerk();

    const handleAction = (e) => {
        if (!user) {
            e.preventDefault();
            openSignIn({ redirectUrl: "/prompt" });
        }
    };

    const cards = [
        {
            icon: <Clock className="w-8 h-8 text-primary" />,
            title: "Zero to Hero in 60s",
            description: "While your competitors are hiring developers, you're already launching. Don't let time be your enemy.",
            badge: "Time Sensitive"
        },
        {
            icon: <Brain className="w-8 h-8 text-primary" />,
            title: "No Code? No Problem.",
            description: "Technical barriers are officially dead. If you can dream it, Elisa can build it. No experience required.",
            badge: "Entry Level"
        },
        {
            icon: <Rocket className="w-8 h-8 text-primary" />,
            title: "The unfair advantage",
            description: "Early adopters are building 10x faster. Stay ahead or get left behind in the manual era.",
            badge: "Limited Edge"
        }
    ];

    return (
        <section className="py-24 bg-background relative overflow-hidden transition-colors duration-500">
            {/* Background Accents - Theme Aware */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,0,0.08),transparent_70%)] dark:bg-[radial-gradient(circle_at_50%_50%,rgba(255,0,0,0.05),transparent_70%)] pointer-events-none" />
            
            <div className="container mx-auto px-6 relative z-10">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 mb-6"
                    >
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-[10px] font-black uppercase tracking-[0.3em] text-primary">Zero Technical Skills Needed</span>
                    </motion.div>
                    
                    <motion.h2 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 }}
                        className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-6 leading-none text-foreground"
                    >
                        WHY WAIT FOR <span className="text-primary italic underline decoration-primary decoration-8 underline-offset-8">EXPERTS?</span>
                    </motion.h2>
                    
                    <motion.p 
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-muted-foreground text-lg font-medium"
                    >
                        Stop being at the mercy of expensive agencies and slow developers. <span className="text-foreground font-bold">Elisa gives you the power to build, edit, and launch your vision instantly.</span>
                    </motion.p>
                </div>

                <div className="grid md:grid-cols-3 gap-8">
                    {cards.map((card, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.15 }}
                            whileHover={{ y: -10 }}
                            className="p-8 rounded-[32px] bg-card/40 dark:bg-card/50 border border-black/5 dark:border-white/5 hover:border-primary/30 dark:hover:border-primary/30 transition-all group relative overflow-hidden backdrop-blur-sm"
                        >
                            <div className="absolute top-0 right-0 p-4">
                                <span className="text-[8px] font-black uppercase tracking-widest text-primary/40 group-hover:text-primary transition-colors">
                                    {card.badge}
                                </span>
                            </div>
                            
                            <div className="mb-6 p-4 rounded-2xl bg-primary/5 inline-block group-hover:scale-110 transition-transform shadow-inner">
                                {card.icon}
                            </div>
                            
                            <h3 className="text-2xl font-black uppercase tracking-tight mb-4 group-hover:text-primary transition-colors text-foreground">
                                {card.title}
                            </h3>
                            
                            <p className="text-muted-foreground text-sm font-medium leading-relaxed">
                                {card.description}
                            </p>
                            
                            {/* Decorative Corner */}
                            <div className="absolute bottom-0 right-0 w-12 h-12 bg-gradient-to-br from-transparent to-primary/5 rounded-tl-[32px] translate-x-4 translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform" />
                        </motion.div>
                    ))}
                </div>

                {/* Final Hook */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="mt-24 p-12 rounded-[40px] bg-gradient-to-r from-primary/10 via-card to-primary/5 border border-primary/20 text-center relative overflow-hidden"
                >
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.1),transparent_70%)] dark:bg-[radial-gradient(circle_at_center,rgba(255,0,0,0.08),transparent_70%)]" />
                    <h3 className="text-3xl md:text-5xl font-black uppercase tracking-tighter mb-4 relative z-10 text-foreground">
                        THE ONLY LIMIT IS YOUR <span className="text-primary italic">IMAGINATION.</span>
                    </h3>
                    <p className="text-muted-foreground font-bold uppercase tracking-[0.4em] text-[10px] mb-8 relative z-10">
                        Don&apos;t be the person who says &quot;I wish I had built that.&quot;
                    </p>
                    <Link
                        href="/prompt"
                        onClick={handleAction}
                        className="inline-block"
                    >
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            className="bg-primary text-white px-10 py-4 rounded-full font-black uppercase tracking-[0.2em] text-xs shadow-[0_20px_40px_rgba(255,0,0,0.3)] hover:bg-red-600 transition-all relative z-10"
                        >
                            Claim Your Advantage
                        </motion.button>
                    </Link>
                </motion.div>
            </div>
        </section>
    );
};

export default FOMOSection;
