import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

function Footer() {
    return (
        <footer className="bg-background border-t-4 border-primary pt-20 pb-10 relative overflow-hidden">
            {/* Red Accent Lines */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/20" />
            <div className="absolute top-3 left-0 w-full h-px bg-primary/10" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[90%]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-12 mb-20">
                    <div className="md:col-span-5">
                        <Link href="/" className="flex items-center space-x-2.5 mb-8 group">
                            <Image
                                src="/logo.png"
                                alt="Elisa AI logo"
                                width={48}
                                height={48}
                                className="h-12 w-12 object-contain drop-shadow-[0_0_20px_rgba(255,0,0,0.4)] group-hover:drop-shadow-[0_0_28px_rgba(255,0,0,0.55)] transition-all"
                            />
                            <span className="text-4xl font-black tracking-tighter text-foreground uppercase italic leading-none">
                                Elisa <span className="text-primary not-italic">AI</span>
                            </span>
                        </Link>
                        <p className="text-muted-foreground text-base leading-relaxed max-w-sm mb-10">
                            Building The Future Of Digital Creation With Systems That Empower The Next Generation Of Revolutionaries.
                        </p>
                    </div>

                    <div className="md:col-span-2">
                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-8">PRODUCT</h3>
                        <ul className="space-y-4">
                            <li><Link href="/features" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">Features</Link></li>
                            <li><Link href="/docs" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">Documentation</Link></li>
                            <li><Link href="/prompt" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">Build Now</Link></li>
                        </ul>
                    </div>

                    <div className="md:col-span-2">
                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-8">COMPANY</h3>
                        <ul className="space-y-4">
                            <li><Link href="/about" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">About Us</Link></li>
                            <li><Link href="/contact" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">Contact</Link></li>
                        </ul>
                    </div>

                    <div className="md:col-span-3">
                        <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-8">LEGAL</h3>
                        <ul className="space-y-4">
                            <li><Link href="/privacy" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">Privacy Policy</Link></li>
                            <li><Link href="/terms" className="text-muted-foreground font-black uppercase text-xs tracking-widest hover:text-primary transition-all hover:translate-x-2 block">Terms of Service</Link></li>
                        </ul>
                    </div>
                </div>

                <div className="border-t-2 border-border/60 pt-10 flex flex-col items-center gap-10">
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.5em] text-center">
                        © 2026 Elisa AI. ALL RIGHTS RESERVED.
                    </p>
                </div>
            </div>
        </footer>
    );
}

export default Footer;


