"use client"
import React, { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const faqs = [
    {
        question: "How does Elisa generate code?",
        answer: "Elisa uses advanced large language models trained on millions of lines of high-quality code. It understands your requirements and generates clean, semantic, and responsive React code styled with Tailwind CSS."
    },
    {
        question: "Is the generated code production-ready?",
        answer: "Yes, the code is designed to be production-ready. It follows best practices, is fully responsive, and includes proper error handling. However, as with any AI tool, we recommend reviewing the code before deployment."
    },
    {
        question: "Can I export the code?",
        answer: "Absolutely. You can export your project as a ZIP file containing all the necessary source code, which you can then run locally or deploy to any hosting provider."
    },
    {
        question: "Do I need coding knowledge to use this?",
        answer: "No coding knowledge is required to generate apps. However, having some understanding of web development can help you customize the output even further."
    },
    {
        question: "Is my data secure?",
        answer: "We take security seriously. Your prompts and generated code are private to your workspace. We do not use your private code to train our public models without your permission."
    }
];

function FAQ() {
    const [openIndex, setOpenIndex] = useState(0);

    return (
        <section className="py-24 bg-background border-t border-border/60" id="faq">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[90%]">
                <div className="flex flex-col md:flex-row gap-16">
                    <div className="md:w-1/3">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            className="inline-flex items-center px-4 py-2 rounded-full bg-primary text-white text-[9px] font-black uppercase tracking-widest mb-5"
                        >
                            SUPPORT
                        </motion.div>
                        <h2 className="text-5xl font-black text-foreground uppercase italic leading-[0.8] tracking-tighter mb-6">
                            ANY <br />
                            <span className="text-primary not-italic">QUESTIONS?</span>
                        </h2>
                        <p className="text-muted-foreground font-bold uppercase tracking-tight text-base leading-tight">
                            Find answers to the most common questions about our platform.
                        </p>
                        <Link href="/contact" className="mt-10 rounded-3xl p-6 bg-card/80 border border-border/60 hidden md:block hover:border-primary/40 hover:bg-primary/5 transition-all">
                            <HelpCircle className="text-primary w-10 h-10 mb-3" />
                            <div className="text-foreground font-black uppercase italic text-lg mb-2">Still confused?</div>
                            <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest leading-relaxed">Reach out to our support team for personal assistance.</p>
                        </Link>
                    </div>

                    <div className="md:w-2/3 space-y-4">
                        {faqs.map((faq, index) => (
                            <div 
                                key={index} 
                                className={`rounded-3xl border-2 transition-all duration-300 overflow-hidden ${openIndex === index ? 'border-primary bg-primary/5' : 'border-border/60 bg-transparent hover:border-primary/40'}`}
                            >
                                <button
                                    onClick={() => setOpenIndex(openIndex === index ? -1 : index)}
                                    className="w-full flex items-center justify-between p-8 text-left group"
                                >
                                    <span className={`text-xl font-black uppercase italic tracking-tighter transition-colors ${openIndex === index ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>
                                        {faq.question}
                                    </span>
                                    <div className={`flex-shrink-0 transition-transform duration-500 ${openIndex === index ? 'rotate-180 text-primary' : 'text-muted-foreground'}`}>
                                        <ChevronDown className="h-6 w-6" />
                                    </div>
                                </button>
                                <AnimatePresence>
                                    {openIndex === index && (
                                        <motion.div
                                            initial={{ height: 0, opacity: 0 }}
                                            animate={{ height: 'auto', opacity: 1 }}
                                            exit={{ height: 0, opacity: 0 }}
                                            transition={{ duration: 0.4, ease: "circOut" }}
                                        >
                                            <div className="px-8 pb-8 text-foreground font-black uppercase text-xs tracking-[0.2em] leading-relaxed border-t-2 border-primary/20 pt-8">
                                                {faq.answer}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}

export default FAQ;



