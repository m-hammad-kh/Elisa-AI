"use client"
import React from 'react';
import { Sparkles, Code, Globe, Zap, ArrowRight, Star } from 'lucide-react';
import { motion } from 'framer-motion';

export default function About() {
  return (
    <div className="bg-background text-foreground min-h-screen pt-32 pb-24 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 blur-[150px] rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-900/10 blur-[120px] rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-4xl mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-6 rounded-full"
          >
            OUR MISSION
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground uppercase italic leading-[0.8] tracking-tighter mb-10"
          >
            REDEFINING <br />
            <span className="text-primary not-italic">CREATION</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl lg:text-3xl text-muted-foreground font-bold uppercase tracking-tight leading-tight max-w-2xl"
          >
            At Elisa, we believe that everyone should have the power to bring their ideas to life, regardless of their technical background.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-4xl font-black text-foreground uppercase italic mb-6 border-l-6 border-primary pl-6">THE VISION</h2>
            <div className="space-y-5">
              <p className="text-lg text-muted-foreground font-bold uppercase tracking-tight leading-relaxed">
                We envision a world where the barrier to entry for software development is zero. By leveraging the power of advanced Artificial Intelligence, we are building tools that understand human intent and translate it into production-grade code.
              </p>
              <p className="text-lg text-muted-foreground font-bold uppercase tracking-tight leading-relaxed">
                Our mission is to empower entrepreneurs, designers, and visionaries to build professional-grade applications in minutes, not months.
              </p>
            </div>
            <div className="mt-10 flex items-center gap-4 group cursor-pointer">
              <div className="h-12 w-12 rounded-full border-2 border-primary flex items-center justify-center group-hover:bg-primary transition-all">
                <ArrowRight className="text-primary group-hover:text-foreground h-5 w-5" />
              </div>
              <span className="text-foreground font-black uppercase tracking-widest italic text-xs">Join the movement</span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full animate-pulse" />
            <div className="grid grid-cols-2 gap-4 relative">
              {[
                { icon: <Sparkles className="h-8 w-8" />, label: "AI POWERED" },
                { icon: <Code className="h-8 w-8" />, label: "CLEAN CODE" },
                { icon: <Globe className="h-8 w-8" />, label: "GLOBAL SCALE" },
                { icon: <Zap className="h-8 w-8" />, label: "ULTRA FAST" }
              ].map((item, i) => (
                <div key={i} className="aspect-square bg-card/80 backdrop-blur-sm border border-border/60 rounded-[32px] flex flex-col items-center justify-center group hover:border-primary transition-all p-6 shadow-xl shadow-black/5">
                  <div className="text-primary group-hover:scale-125 transition-transform duration-500 mb-3">{item.icon}</div>
                  <span className="text-foreground font-black text-[10px] uppercase tracking-[0.2em]">{item.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <div className="text-center">
          <h2 className="text-4xl md:text-6xl font-black text-foreground uppercase italic mb-16 tracking-tighter">OUR <span className="text-primary not-italic">VALUES</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { title: "INNOVATION", desc: "Pushing the boundaries of what's possible with intelligent systems." },
              { title: "SIMPLICITY", desc: "Making complex technology accessible to every single human." },
              { title: "QUALITY", desc: "Delivering code that developers trust, love, and can rely on." }
            ].map((value, i) => (
              <div key={i} className="p-10 bg-card/40 backdrop-blur-sm border border-border/60 rounded-[40px] hover:bg-card/80 transition-all group relative overflow-hidden text-left">
                <div className="absolute top-0 left-0 w-0 h-1 bg-primary group-hover:w-full transition-all duration-500" />
                <Star className="text-primary w-6 h-6 mb-6 opacity-50 group-hover:opacity-100 transition-opacity" />
                <h3 className="text-2xl font-black text-foreground uppercase italic mb-3">{value.title}</h3>
                <p className="text-muted-foreground font-bold uppercase text-[11px] tracking-widest leading-relaxed">{value.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}





