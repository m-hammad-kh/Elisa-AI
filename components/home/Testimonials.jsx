"use client"
import React from 'react';
import { motion } from 'framer-motion';

const testimonialsTop = [
    {
        content: "The prompts translate into clean, usable layouts instantly.",
        author: "Sarah Chen",
        role: "Product Designer"
    },
    {
        content: "The output is organized and easy to extend for real projects.",
        author: "Michael Ross",
        role: "Senior Developer"
    },
    {
        content: "UI decisions feel thoughtful and on-brand, not random.",
        author: "Jessica Lee",
        role: "Freelance Developer"
    },
    {
        content: "Preview to edit flow is super smooth for quick iterations.",
        author: "David Miller",
        role: "Agency Lead"
    },
    {
        content: "Clean components and smart defaults without the noise.",
        author: "Alex Thompson",
        role: "Frontend Engineer"
    },
    {
        content: "Feels like a senior designer helping live.",
        author: "Priya Shah",
        role: "Design Lead"
    }
];

const testimonialsBottom = [
    {
        content: "Our team aligns faster with these strong starting points.",
        author: "Noah Brooks",
        role: "Product Manager"
    },
    {
        content: "Responsive layouts land right without extra tweaks.",
        author: "Amina Yusuf",
        role: "UI Engineer"
    },
    {
        content: "The structure is reliable and the styles are tasteful.",
        author: "Leo Park",
        role: "Creative Technologist"
    },
    {
        content: "From idea to prototype in one sitting.",
        author: "Isabella Cruz",
        role: "Founder"
    },
    {
        content: "It understands context better than most tools.",
        author: "Omar Ali",
        role: "Full-Stack Developer"
    },
    {
        content: "Great for client demos and quick feedback cycles.",
        author: "Emily Carter",
        role: "UX Consultant"
    }
];

function Testimonials() {
    return (
        <section className="py-24 bg-background border-t border-border/60 overflow-hidden relative">
            {/* Subtle background glow */}
            <div className="absolute -top-20 right-10 h-64 w-64 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

            <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-16 text-center relative z-10 max-w-[90%]">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-5"
                >
                    REVIEWS
                </motion.div>
                <h2 className="text-5xl md:text-7xl font-black text-foreground uppercase italic leading-[0.85] tracking-tighter">
                    BUILT FOR <br />
                    <span className="text-primary/80 not-italic">MODERN TEAMS</span>
                </h2>
            </div>
            
            <div className="relative space-y-6">
                <div className="marquee-row">
                    <div className="marquee-track marquee-left">
                        {[...testimonialsTop, ...testimonialsTop].map((testimonial, index) => (
                            <div 
                                key={`row1-${index}`} 
                                className="inline-block w-[320px] flex-shrink-0 rounded-2xl bg-card/70 p-4 border border-border/70 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
                                        ★★★★★
                                    </div>
                                    <div className="h-1.5 w-12 rounded-full bg-primary/25" />
                                </div>
                                <p className="text-foreground font-semibold uppercase text-[14px] tracking-tight leading-[1.2] mb-5 italic">
                                    &quot;{testimonial.content}&quot;
                                </p>
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-lg border border-border/70 bg-muted/40 text-foreground flex items-center justify-center font-black text-[12px] italic">
                                        {testimonial.author.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground uppercase italic tracking-tight">{testimonial.author}</div>
                                        <div className="text-muted-foreground font-semibold text-[10px] uppercase tracking-[0.3em]">{testimonial.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="marquee-row">
                    <div className="marquee-track marquee-right">
                        {[...testimonialsBottom, ...testimonialsBottom].map((testimonial, index) => (
                            <div 
                                key={`row2-${index}`} 
                                className="inline-block w-[320px] flex-shrink-0 rounded-2xl bg-card/70 p-4 border border-border/70 transition-all duration-300 hover:border-primary/30 hover:shadow-[0_18px_40px_rgba(0,0,0,0.12)]"
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
                                        ★★★★★
                                    </div>
                                    <div className="h-1.5 w-12 rounded-full bg-primary/25" />
                                </div>
                                <p className="text-foreground font-semibold uppercase text-[14px] tracking-tight leading-[1.2] mb-5 italic">
                                    &quot;{testimonial.content}&quot;
                                </p>
                                <div className="flex items-center gap-4">
                                    <div className="h-8 w-8 rounded-lg border border-border/70 bg-muted/40 text-foreground flex items-center justify-center font-black text-[12px] italic">
                                        {testimonial.author.charAt(0)}
                                    </div>
                                    <div>
                                        <div className="font-bold text-foreground uppercase italic tracking-tight">{testimonial.author}</div>
                                        <div className="text-muted-foreground font-semibold text-[10px] uppercase tracking-[0.3em]">{testimonial.role}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default Testimonials;





