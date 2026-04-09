"use client"
import React, { useState } from 'react';
import { Mail, Send, Sparkles, MapPin, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

export default function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setSubmitted(true);
    }, 1500);
  };

  return (
    <div className="bg-background text-foreground min-h-screen pt-24 pb-20 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
          
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <div className="inline-block px-4 py-1.5 bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-6 rounded-full">
              GET IN TOUCH
            </div>
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black text-foreground uppercase italic leading-[0.8] tracking-tighter mb-10">
              LET&apos;S <br />
              <span className="text-primary not-italic">TALK</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground font-bold uppercase tracking-tight leading-tight max-w-md mb-12">
              Have questions about Elisa? We&apos;re here to help you build the future.
            </p>

            <div className="space-y-8">
              {[
                { icon: <Mail className="w-6 h-6" />, label: "EMAIL", val: "contact@ELISA.AI" },
                { icon: <Phone className="w-6 h-6" />, label: "PHONE", val: "+92 320 570 3820" },
                { icon: <MapPin className="w-6 h-6" />, label: "HQ", val: "Taxila, Pakistan" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-5 group">
                  <div className="h-14 w-14 bg-card/80 border border-border/60 rounded-2xl flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all shadow-lg shadow-black/5">
                    {item.icon}
                  </div>
                  <div>
                    <div className="text-[9px] font-black text-muted-foreground tracking-widest uppercase">{item.label}</div>
                    <div className="text-lg font-black text-foreground tracking-tighter uppercase italic">{item.val}</div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-card/40 backdrop-blur-md border border-border/60 p-8 md:p-12 relative rounded-[48px] shadow-2xl shadow-black/5"
          >
            <div className="absolute top-0 right-0 p-6 opacity-10">
              <Sparkles className="w-16 h-16 text-primary animate-pulse" />
            </div>

            {submitted ? (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="h-24 w-24 bg-primary text-white flex items-center justify-center mx-auto mb-6 rounded-[32px] shadow-[0_20px_50px_rgba(255,0,0,0.3)]">
                  <Send className="h-10 w-10" />
                </div>
                <h2 className="text-3xl font-black text-foreground uppercase italic mb-3">MESSAGE SENT</h2>
                <p className="text-muted-foreground font-bold uppercase tracking-tight mb-10 text-xs">
                  THANK YOU FOR CONTACTING US. WE&apos;LL GET BACK TO YOU SHORTLY.
                </p>
                <Button 
                    onClick={() => setSubmitted(false)} 
                    className="bg-foreground text-background hover:bg-primary hover:text-white font-black uppercase tracking-tight px-10 py-5 h-auto text-xs rounded-full transition-all hover:scale-105"
                >
                  SEND ANOTHER
                </Button>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-[9px] font-black text-muted-foreground tracking-[0.3em] uppercase">FULL NAME</label>
                  <input
                    type="text"
                    required
                    className="w-full bg-white/5 border border-border/60 rounded-2xl focus:border-primary text-foreground text-lg font-bold uppercase tracking-tight px-6 py-4 outline-none transition-all placeholder:text-muted-foreground/40"
                    placeholder="ENTER NAME"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-muted-foreground tracking-[0.3em] uppercase">EMAIL ADDRESS</label>
                  <input
                    type="email"
                    required
                    className="w-full bg-white/5 border border-border/60 rounded-2xl focus:border-primary text-foreground text-lg font-bold uppercase tracking-tight px-6 py-4 outline-none transition-all placeholder:text-muted-foreground/40"
                    placeholder="EMAIL@EXAMPLE.COM"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-black text-muted-foreground tracking-[0.3em] uppercase">YOUR MESSAGE</label>
                  <textarea
                    required
                    rows={3}
                    className="w-full bg-white/5 border border-border/60 rounded-2xl focus:border-primary text-foreground text-lg font-bold uppercase tracking-tight px-6 py-4 outline-none transition-all placeholder:text-muted-foreground/40 resize-none"
                    placeholder="WHAT&apos;S ON YOUR MIND?"
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                  />
                </div>

                <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="w-full bg-primary hover:bg-red-700 text-white font-black uppercase tracking-tight py-6 h-auto text-lg rounded-2xl shadow-xl shadow-primary/20 transition-all hover:translate-y-[-2px] active:scale-[0.98]"
                >
                  {isSubmitting ? 'SENDING...' : 'SEND MESSAGE'}
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}





