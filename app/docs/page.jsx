"use client"
import React from 'react';
import { Book, Code, Zap, Globe, Shield, Sparkles, MousePointer2, RotateCcw, Download, Layout, ArrowRight, Terminal } from 'lucide-react';
import { motion } from 'framer-motion';
import Link from 'next/link';

function DocsPage() {
    const sections = [
        {
            id: "introduction",
            title: "Introduction",
            icon: <Sparkles className="w-6 h-6 text-primary" />,
            content: "Elisa is a high-fidelity digital creation platform that transforms simple user prompts into production-ready React applications. It provides a complete end-to-end environment for designing, previewing, and launching sophisticated digital experiences."
        },
        {
            id: "core-features",
            title: "Core Features",
            icon: <Zap className="w-6 h-6 text-primary" />,
            features: [
                { name: "Intelligent Specification Engine", desc: "Automatically expands brief ideas into detailed project blueprints with aesthetic definitions." },
                { name: "Self-Healing Code Pipeline", desc: "Regex-based sanitization that fixes AI-generated React code before runtime execution." },
                { name: "Live Interactive Preview", desc: "A real-time execution environment powered by Sandpack for instant code rendering." },
                { name: "Visual Element Inspector", desc: "Surgically identify and select preview elements to view their underlying source structure." }
            ]
        },
        {
            id: "advanced-tools",
            title: "Advanced Tools",
            icon: <Terminal className="w-6 h-6 text-primary" />,
            features: [
                { name: "Direct Source Text Editing", desc: "Modify text directly within the preview window; changes sync back to source files automatically." },
                { name: "Production-Grade Export", desc: "Bundle and download entire project as a production-ready Vite/React ZIP file." },
                { name: "Relational Session Persistence", desc: "Powered by Convex for secure, real-time synchronization of project files and chat history." },
                { name: "Multi-Device Simulation", desc: "Test project responsiveness across Desktop, Tablet, and Mobile views instantly." }
            ]
        },
        {
            id: "architecture",
            title: "Technical Architecture",
            icon: <Layout className="w-6 h-6 text-primary" />,
            content: "Elisa utilizes a modern serverless architecture built on Next.js and Convex. It leverages Google Gemini 2.0 Flash for code generation and Sandpack for in-browser project execution, providing a seamless bridge between visual design and raw code production."
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="flex flex-col lg:flex-row gap-16">
                    {/* Sidebar Navigation */}
                    <div className="w-full lg:w-56 flex-shrink-0">
                        <div className="sticky top-24">
                            <div className="flex items-center gap-2.5 mb-8">
                                <div className="h-8 w-8 bg-primary text-white flex items-center justify-center font-black text-[10px] rounded-lg">DOCS</div>
                                <span className="text-foreground font-black uppercase tracking-tight text-xl">CENTRAL</span>
                            </div>
                            <nav className="space-y-3">
                                {sections.map((section) => (
                                    <Link 
                                        key={section.id} 
                                        href={`#${section.id}`}
                                        className="block text-muted-foreground hover:text-primary font-black uppercase tracking-widest text-[10px] transition-all hover:translate-x-2"
                                    >
                                        {section.title}
                                    </Link>
                                ))}
                            </nav>
                            <div className="mt-16 p-6 border border-border/60 bg-card/40 backdrop-blur-md rounded-[32px] shadow-xl shadow-black/5">
                                <div className="text-primary font-black text-[9px] tracking-widest uppercase mb-3">Need Help?</div>
                                <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-5">Can&apos;t find what you&apos;re looking for?</p>
                                <Link href="/contact" className="text-foreground font-black uppercase text-[9px] tracking-widest hover:text-primary transition-colors flex items-center">
                                    CONTACT SUPPORT <ArrowRight className="w-2.5 h-2.5 ml-2" />
                                </Link>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="flex-1 max-w-3xl space-y-24">
                        {sections.map((section) => (
                            <section key={section.id} id={section.id} className="scroll-mt-24">
                                <div className="flex items-center gap-5 mb-8">
                                    <div className="h-14 w-14 bg-card/40 backdrop-blur-sm border border-border/60 flex items-center justify-center rounded-2xl shadow-lg shadow-black/5">
                                        {section.icon}
                                    </div>
                                    <h2 className="text-4xl md:text-6xl font-black text-foreground uppercase italic tracking-tighter">{section.title}</h2>
                                </div>
                                
                                {section.content && (
                                    <p className="text-lg text-muted-foreground font-bold uppercase tracking-tight leading-relaxed mb-10 border-l-4 border-primary pl-6">
                                        {section.content}
                                    </p>
                                )}

                                {section.features && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {section.features.map((feature, i) => (
                                            <div key={i} className="p-8 bg-card/40 backdrop-blur-sm border border-border/60 rounded-[32px] hover:bg-card/80 hover:border-primary/30 transition-all duration-500 group shadow-xl shadow-black/5">
                                                <h3 className="text-foreground font-black uppercase italic text-xl mb-4 group-hover:text-primary transition-colors">{feature.name}</h3>
                                                <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest leading-relaxed">{feature.desc}</p>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        ))}

                        <div className="pt-20 border-t border-border/60 flex items-center justify-between">
                            <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em]">
                                UPDATED JANUARY 2026
                            </p>
                            <div className="flex gap-4">
                                <div className="h-10 w-10 bg-card/40 backdrop-blur-sm border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary cursor-pointer transition-all rounded-xl shadow-md">
                                    <Download className="w-4 h-4" />
                                </div>
                                <div className="h-10 w-10 bg-card/40 backdrop-blur-sm border border-border/60 flex items-center justify-center text-muted-foreground hover:text-primary cursor-pointer transition-all rounded-xl shadow-md">
                                    <Globe className="w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default DocsPage;




