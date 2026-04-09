"use client"
import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Globe, Palette, Shield, Rocket, Heart, Cloud } from 'lucide-react';

const extraFeatures = [
    { icon: <Globe className="w-10 h-10" />, title: "Global Deployment", desc: "Launch your site to a global CDN with one click. Fast, secure, and reliable." },
    { icon: <Palette className="w-10 h-10" />, title: "Smart Theming", desc: "Our engine autonomously defines cohesive color palettes and typography." },
    { icon: <Shield className="w-10 h-10" />, title: "Secure by Design", desc: "Production-ready code that follows the latest security best practices." },
    { icon: <Rocket className="w-10 h-10" />, title: "SEO Optimized", desc: "Built-in SEO meta tags and semantic structure for maximum visibility." },
    { icon: <Heart className="w-10 h-10" />, title: "User Centric", desc: "Focused on creating the best possible experience for your end users." },
    { icon: <Cloud className="w-10 h-10" />, title: "Auto-Saving", desc: "Your workspace is constantly synced to the cloud, never lose a line of code." }
];

export default function HorizontalScrollFeatures() {
  const targetRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: targetRef,
  });

  const x = useTransform(scrollYProgress, [0, 1], ["0%", "-70%"]);

  return (
    <section ref={targetRef} className="relative h-[300vh] bg-background">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <motion.div style={{ x }} className="flex gap-8 px-12 items-center">
          <div className="flex flex-col justify-center min-w-[500px] pr-16 flex-shrink-0">
            <h2 className="text-6xl md:text-7xl font-black text-foreground uppercase italic leading-[0.8] mb-6">
              UNLIMITED<br />
              <span className="text-primary not-italic">POSSIBILITIES</span>
            </h2>
            <p className="text-xl text-muted-foreground uppercase font-bold tracking-tight max-w-sm">
              Explore the advanced features that make Elisa the world&apos;s most powerful AI builder.
            </p>
          </div>
          {extraFeatures.map((feature, index) => (
            <div
              key={index}
              className="group relative h-[420px] w-[420px] flex-shrink-0 overflow-hidden rounded-3xl border border-border/60 bg-card/80 p-10 transition-all duration-500 hover:border-primary/40 hover:shadow-[0_0_60px_rgba(255,0,0,0.12)]"
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none">
                <div className="absolute -top-24 -right-24 w-56 h-56 bg-primary/10 blur-[80px]" />
              </div>
              <div className="relative z-10 flex h-full flex-col">
                <div className="flex items-center justify-between">
                  <div className="h-12 w-12 rounded-2xl border border-primary/40 text-primary/80 flex items-center justify-center">
                    {React.cloneElement(feature.icon, { className: "w-6 h-6" })}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">FEATURE</div>
                </div>
                <div className="mt-6 h-px w-14 bg-primary/40" />
                <div className="mt-12">
                  <h3 className="text-3xl font-black text-foreground uppercase mb-4 leading-none">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground font-medium uppercase text-xs tracking-widest leading-relaxed max-w-[320px]">
                    {feature.desc}
                  </p>
                </div>
                <div className="mt-10 flex items-center gap-3">
                  <span className="h-[3px] w-14 bg-primary/60" />
                  <span className="h-[3px] w-10 bg-primary/30" />
                  <span className="h-[3px] w-6 bg-primary/15" />
                </div>
                <div className="mt-6 h-px w-full bg-gradient-to-r from-white/10 via-white/5 to-transparent" />
              </div>
              <div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-primary/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}




