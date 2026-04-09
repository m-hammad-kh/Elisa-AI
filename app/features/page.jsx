"use client"
import React from 'react';
import { 
    Monitor, MessageSquare, Code, Download, 
    Zap, Shield, Sparkles, MousePointer2, 
    RotateCcw, History, Layout, Globe
} from 'lucide-react';
import { motion } from 'framer-motion';

function FeaturesPage() {
    const features = [
        {
            icon: <Sparkles className="h-10 w-10" />,
            title: "Project Refinement Engine",
            description: "Automatically expands brief ideas into comprehensive technical blueprints with high-end aesthetic definitions."
        },
        {
            icon: <Zap className="h-10 w-10" />,
            title: "Instant Project Scaffolding",
            description: "Generates a complete, organized project directory with all necessary configuration files in seconds."
        },
        {
            icon: <Monitor className="h-10 w-10" />,
            title: "Real-Time Live Preview",
            description: "A fully functional, live-rendered execution environment that reflects changes instantly as you edit."
        },
        {
            icon: <MousePointer2 className="h-10 w-10" />,
            title: "Visual Element Inspector",
            description: "Hover and select any element in the live preview to identify its structure and corresponding source code."
        },
        {
            icon: <Code className="h-10 w-10" />,
            title: "In-Browser Text Editor",
            description: "Modify text directly within the preview window; changes are automatically written back to the source files."
        },
        {
            icon: <Download className="h-10 w-10" />,
            title: "Production-Grade Export",
            description: "Package and download your entire project codebase as a production-ready ZIP file with one click."
        },
        {
            icon: <RotateCcw className="h-10 w-10" />,
            title: "Infinite Revision History",
            description: "Full Undo/Redo capabilities allow you to navigate through every state of your project's development timeline."
        },
        {
            icon: <History className="h-10 w-10" />,
            title: "Session Persistence",
            description: "Your work is automatically saved and synced to a secure cloud workspace, ensuring no progress is ever lost."
        },
        {
            icon: <Layout className="h-10 w-10" />,
            title: "Multi-Device Simulator",
            description: "Toggle between Mobile, Tablet, and Desktop views instantly to verify perfect responsiveness across all screens."
        },
        {
            icon: <MessageSquare className="h-10 w-10" />,
            title: "Digital Creation Assistant",
            description: "Collaborate with an intelligent assistant to request layout changes or implement complex new features via chat."
        },
        {
            icon: <Globe className="h-10 w-10" />,
            title: "Automated Routing",
            description: "Sets up navigation between Home, Features, About, and Contact pages automatically based on project needs."
        },
        {
            icon: <Shield className="h-10 w-10" />,
            title: "Secure Cloud Workspace",
            description: "Professional-grade security and reliability for all your project data and conversation history."
        },
        {
            icon: <MessageSquare className="h-10 w-10" />,
            title: "Live AI Collaboration",
            description: "Interact with our intelligent assistant in real-time to refine your ideas or implement complex new features via chat."
        },
        {
            icon: <Download className="h-10 w-10" />,
            title: "One-Click Project Export",
            description: "Download modern, high-performance Vite-based React projects ready for immediate deployment."
        }
    ];

    return (
        <div className="min-h-screen bg-background text-foreground pt-24 pb-20 relative overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                <div className="max-w-4xl mb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="inline-block px-4 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-6 rounded-full"
                    >
                        PLATFORM CAPABILITIES
                    </motion.div>
                    <motion.h1 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground uppercase italic leading-[0.8] tracking-tighter mb-10"
                    >
                        UNLIMITED <br />
                        <span className="text-primary not-italic">POWER</span>
                    </motion.h1>
                    <p className="text-xl md:text-2xl text-muted-foreground font-bold uppercase tracking-tight leading-tight max-w-2xl">
                        Explore the complete suite of advanced tools designed to empower the next generation of digital revolutionaries.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div 
                            key={index} 
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ delay: index * 0.05 }}
                            className="group p-10 bg-card/40 backdrop-blur-sm border border-border/60 rounded-[40px] hover:bg-card/80 hover:border-primary/50 transition-all duration-500 relative overflow-hidden shadow-xl shadow-black/5"
                        >
                            <div className="absolute top-0 left-0 w-1 h-0 bg-primary group-hover:h-full transition-all duration-500" />
                            <div className="text-primary mb-8 transform group-hover:scale-110 transition-transform duration-500">
                                {React.cloneElement(feature.icon, { className: "w-8 h-8" })}
                            </div>
                            <h3 className="text-2xl font-black text-foreground mb-4 uppercase italic group-hover:text-primary transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-muted-foreground font-bold uppercase text-[11px] tracking-widest leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="mt-32 p-16 bg-primary text-center relative overflow-hidden group cursor-pointer rounded-[60px] shadow-2xl shadow-primary/20"
                >
                    <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                    <h2 className="text-5xl md:text-7xl font-black text-foreground uppercase italic leading-none mb-6 relative z-10">
                        READY TO <span className="text-black not-italic">START?</span>
                    </h2>
                    <p className="text-muted-foreground font-black uppercase tracking-[0.3em] text-[10px] relative z-10">Experience the future of creation today</p>
                </motion.div>
            </div>
        </div>
    );
}

export default FeaturesPage;




