"use client"
import React from 'react';
import { Shield, Eye, FileText, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

function PrivacyPage() {
    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 -translate-x-1/2 pointer-events-none" />
            
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-3xl relative z-10">
                <Link href="/" className="inline-flex items-center text-muted-foreground hover:text-primary font-black uppercase tracking-widest text-[10px] mb-8 transition-colors group">
                    <ArrowLeft className="w-3 h-3 mr-2 group-hover:-translate-x-1 transition-transform" />
                    BACK TO HOME
                </Link>

                <div className="mb-16">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block px-4 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-6 rounded-full"
                    >
                        LEGAL DOCS
                    </motion.div>
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground uppercase italic leading-[0.8] tracking-tighter mb-6"
                    >
                        PRIVACY <br />
                        <span className="text-primary not-italic">POLICY</span>
                    </motion.h1>
                    <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px]">
                        LAST UPDATED: JANUARY 28, 2026
                    </p>
                </div>

                <div className="space-y-12">
                    <section className="p-12 bg-card/40 backdrop-blur-md border border-border/60 rounded-[48px] hover:bg-card/60 transition-all group shadow-xl shadow-black/5">
                        <p className="text-xl text-foreground font-black uppercase tracking-tight leading-tight mb-6 ">
                            At Elisa, we take your privacy seriously. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our digital creation tools.
                        </p>
                    </section>

                    <section className="space-y-10">
                        <h2 className="text-4xl md:text-5xl font-black text-foreground uppercase italic flex items-center tracking-tighter">
                            <Eye className="h-10 w-10 mr-5 text-primary" />
                            Information We Collect
                        </h2>
                        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs leading-relaxed max-w-xl">
                            We collect information that you provide directly to us when you register for an account, create or modify your profile, set preferences, sign up for newsletters, or make a purchase.
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {["NAME AND CONTACT INFO", "ACCOUNT CREDENTIALS", "PAYMENT INFORMATION", "GENERATED CONTENT"].map((item, i) => (
                                <div key={i} className="p-8 bg-card/40 backdrop-blur-sm border border-border/60 rounded-3xl flex items-center gap-5 group hover:border-primary transition-all shadow-lg shadow-black/5">
                                    <div className="w-3 h-3 bg-primary rounded-full shadow-[0_0_8px_rgba(255,0,0,0.4)]" />
                                    <span className="text-foreground font-black text-base uppercase tracking-tight ">{item}</span>
                                </div>
                            ))}
                        </div>
                    </section>

                    <section className="space-y-10">
                        <h2 className="text-4xl md:text-5xl font-black text-foreground uppercase italic flex items-center tracking-tighter">
                            <Shield className="h-10 w-10 mr-5 text-primary" />
                            Usage Policy
                        </h2>
                        <div className="p-12 border border-border/60 bg-primary/5 rounded-[48px] shadow-inner">
                            <ul className="space-y-6">
                                {[
                                    "PROVIDE AND MAINTAIN SERVICES",
                                    "PROCESS TRANSACTIONS AND ALERTS",
                                    "TECHNICAL UPDATES AND SECURITY",
                                    "RESPOND TO COMMENTS AND REQUESTS",
                                    "ANONYMIZED SYSTEM OPTIMIZATION"
                                ].map((item, i) => (
                                    <li key={i} className="flex items-center gap-5 text-foreground font-black text-lg uppercase tracking-tight ">
                                        <div className="w-6 h-1.5 bg-primary rounded-full" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </section>

                    <section className="space-y-6">
                        <h2 className="text-3xl font-black text-foreground uppercase italic flex items-center">
                            <FileText className="h-6 w-6 mr-3 text-primary" />
                            Data Security
                        </h2>
                        <p className="text-muted-foreground font-bold uppercase tracking-widest text-[10px] leading-relaxed">
                            We implement appropriate technical and organizational measures to protect the security of your personal information. However, please be aware that no method of transmission over the Internet is 100% secure.
                        </p>
                    </section>

                    <footer className="pt-12 border-t border-border/60">
                        <p className="text-muted-foreground font-black uppercase tracking-[0.3em] text-[9px]">
                            QUESTIONS? CONTACT US AT <a href="mailto:legal@elisa.ai" className="text-primary hover:underline">LEGAL@ELISA.AI</a>
                        </p>
                    </footer>
                </div>
            </div>
        </div>
    );
}

export default PrivacyPage;





