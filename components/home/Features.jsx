"use client"
import React from 'react';
import { Monitor, MessageSquare, Code, Download, Zap, MousePointer2 } from 'lucide-react';
import { motion } from 'framer-motion';

const features = [
    {
        icon: <Monitor className="h-8 w-8 text-primary" />,
        title: 'LIVE PREVIEW',
        description: 'WATCH YOUR CODE COME TO LIFE IN REAL-TIME WITH OUR INTEGRATED BROWSER RUNTIME.'
    },
    {
        icon: <MessageSquare className="h-8 w-8 text-primary" />,
        title: 'LIVE AI CHAT',
        description: 'COLLABORATE WITH AN INTELLIGENT ASSISTANT TO REFINE YOUR IDEAS AND IMPLEMENT FEATURES VIA CHAT.'
    },
    {
        icon: <MousePointer2 className="h-8 w-8 text-primary" />,
        title: 'VISUAL SELECTOR',
        description: 'SELECT ANY ELEMENT IN THE PREVIEW TO IDENTIFY ITS STRUCTURE AND SOURCE CODE INSTANTLY.'
    },
    {
        icon: <Code className="h-8 w-8 text-primary" />,
        title: 'PRO CODE EDITOR',
        description: 'A FULLY-FEATURED CODE EDITOR INTEGRATED DIRECTLY INTO YOUR CLOUD WORKSPACE.'
    },
    {
        icon: <Download className="h-8 w-8 text-primary" />,
        title: 'PROJECT EXPORTS',
        description: 'EXPORT YOUR ENTIRE PROJECT AS A MODERN VITE-BASED REACT BUNDLE IN ONE CLICK.'
    },
    {
        icon: <Zap className="h-8 w-8 text-primary" />,
        title: 'LIGHTNING FAST',
        description: 'ACHIEVE 10X FASTER DEVELOPMENT CYCLES WITHOUT SACRIFICING QUALITY OR SECURITY.'
    }
];

function Features() {
    return (
        <section className="py-24 bg-background border-t border-border/60" id="features">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[90%]">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                    <div className="max-w-2xl">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-5"
                        >
                            CORE CAPABILITIES
                        </motion.div>
                        <h2 className="text-5xl md:text-7xl font-black text-foreground uppercase italic leading-[0.8] tracking-tighter">
                            EVERYTHING <br />
                            <span className="text-primary not-italic">YOU NEED</span>
                        </h2>
                    </div>
                    <p className="max-w-sm text-muted-foreground uppercase font-bold tracking-tight text-base leading-tight">
                        Elisa AI provides a complete suite of digital creation tools to bring your most ambitious visions to life.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {features.map((feature, index) => (
                        <motion.div 
                            key={index} 
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="group p-10 border border-border/60 rounded-3xl bg-card/80 hover:bg-primary/5 transition-all duration-500 relative overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.08)]"
                        >
                            <div className="absolute top-0 left-0 h-1 w-0 bg-primary group-hover:w-full transition-all duration-500" />
                            <div className="mb-6 transform group-hover:scale-110 transition-transform duration-500">
                                {feature.icon}
                            </div>
                            <h3 className="text-2xl font-black text-foreground mb-3 uppercase italic group-hover:text-primary transition-colors">
                                {feature.title}
                            </h3>
                            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}

export default Features;





