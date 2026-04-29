﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿"use client"
import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useClerk, useUser } from "@clerk/clerk-react";
import { useState, useEffect } from "react";

const HERO_PHRASES = [
  ["STOP", "THINKING", "START", "BUILDING"],
  ["YOUR", "VISION", "OUR", "ENGINE"],
  ["ONE", "PROMPT", "ONE", "WIN"],
  ["NO", "CODE", "JUST", "MAGIC"]
];

function Hero() {
  const { user } = useUser();
  const { openSignIn } = useClerk();

  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayedWords, setDisplayedWords] = useState(["", "", "", ""]);
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentPhrase = HERO_PHRASES[phraseIndex];
    const currentWord = currentPhrase[wordIndex];
    
    let timer;

    if (!isDeleting) {
      // Typing mode - SLOWER (100ms)
      if (charIndex < currentWord.length) {
        timer = setTimeout(() => {
          const newWords = [...displayedWords];
          newWords[wordIndex] = currentWord.substring(0, charIndex + 1);
          setDisplayedWords(newWords);
          setCharIndex(prev => prev + 1);
        }, 100);
      } else if (wordIndex < 3) {
        // Move to next word in same phrase - LONGER GAP (300ms)
        timer = setTimeout(() => {
          setWordIndex(prev => prev + 1);
          setCharIndex(0);
        }, 300);
      } else {
        // Finished typing entire phrase, wait then delete - MUCH LONGER (4000ms)
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 4000);
      }
    } else {
      // Deleting mode - SLOWER (50ms)
      timer = setTimeout(() => {
        if (charIndex > 0) {
          const newWords = [...displayedWords];
          newWords[wordIndex] = currentWord.substring(0, charIndex - 1);
          setDisplayedWords(newWords);
          setCharIndex(prev => prev - 1);
        } else if (wordIndex > 0) {
          setWordIndex(prev => prev - 1);
          setCharIndex(HERO_PHRASES[phraseIndex][wordIndex - 1].length);
        } else {
          setIsDeleting(false);
          setPhraseIndex((prev) => (prev + 1) % HERO_PHRASES.length);
          setWordIndex(0);
          setCharIndex(0);
        }
      }, 50);
    }

    return () => clearTimeout(timer);
  }, [charIndex, wordIndex, isDeleting, phraseIndex, displayedWords]);

  const handleStartBuilding = (e) => {
    if (!user) {
      e.preventDefault();
      openSignIn({ redirectUrl: "/prompt" });
    }
  };
  return (
    <section className="relative min-h-[calc(100vh-56px)] overflow-hidden bg-background pt-6 pb-12 lg:pt-8 lg:pb-16">
      <div className="absolute inset-0">
        <div className="absolute inset-0 hero-noise opacity-60 dark:opacity-35" />
        <div className="absolute inset-0 grid-bg opacity-30 dark:opacity-15" />
        <div className="absolute -top-40 left-1/2 h-[620px] w-[620px] -translate-x-1/2 rounded-full bg-primary/20 blur-[160px] animate-blob" />
        <div className="absolute bottom-0 right-[-10%] h-[520px] w-[520px] rounded-full bg-primary/15 blur-[140px] animate-blob" />
        <div className="absolute left-1/2 top-1/2 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/20 animate-spin-slow" />
        <div className="absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 dark:border-white/5 animate-spin-slow" />
        <div className="falling-field">
          {[
            { left: "5%", text: "{ }", delay: "0s", duration: "12s", size: 14 },
            { left: "12%", text: "< />", delay: "2s", duration: "15s", size: 16 },
            { left: "20%", text: "const", delay: "4s", duration: "18s", size: 12 },
            { left: "28%", text: "01", delay: "1s", duration: "10s", size: 10 },
            { left: "35%", text: "[ ]", delay: "6s", duration: "20s", size: 15 },
            { left: "42%", text: "=>", delay: "3s", duration: "14s", size: 18 },
            { left: "50%", text: "if()", delay: "0.5s", duration: "11s", size: 13 },
            { left: "58%", text: "10", delay: "5s", duration: "16s", size: 11 },
            { left: "65%", text: "let", delay: "7s", duration: "22s", size: 12 },
            { left: "72%", text: "{...}", delay: "2.5s", duration: "13s", size: 15 },
            { left: "80%", text: "()", delay: "4.5s", duration: "17s", size: 11 },
            { left: "88%", text: "return", delay: "1.5s", duration: "19s", size: 14 },
            { left: "95%", text: "0101", delay: "8s", duration: "25s", size: 9 },
          ].map((chunk, idx) => (
            <span
              key={`chunk-${idx}`}
              className={`falling-shard code-chunk font-mono ${
                idx % 3 === 0 
                  ? "text-primary/50 dark:text-primary/40" 
                  : idx % 3 === 1 
                    ? "text-muted-foreground/40 dark:text-white/20" 
                    : "text-primary/40 dark:text-primary/30"
              }`}
              style={{
                left: chunk.left,
                fontSize: `${chunk.size}px`,
                animationDelay: chunk.delay,
                animationDuration: chunk.duration,
              }}
            >
              {chunk.text}
            </span>
          ))}
        </div>
      </div>

      <div className="container relative z-10 mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid items-center pt-2 lg:pt-6 gap-12 lg:gap-16 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="flex flex-col items-start text-left py-12 lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.3em] text-gray-700 shadow-sm shadow-black/5 dark:border-white/10 dark:bg-white/5 dark:text-white/70"
          >
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Build With Elisa AI
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 text-6xl md:text-9xl lg:text-[110px] font-black uppercase tracking-tighter leading-[0.75] text-foreground flex flex-col relative"
          >
            {displayedWords.map((word, idx) => (
              <div key={idx} className="flex items-center h-[0.85em]">
                <span className={idx === 1 || idx === 3 ? "text-primary italic" : ""}>
                  {word}
                </span>
                {/* Pointer (Cursor) - only show on the currently typing word */}
                {wordIndex === idx && (
                  <motion.span
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity }}
                    className="ml-2 h-[0.8em] w-2 bg-primary inline-block align-middle"
                  />
                )}
              </div>
            ))}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-6 max-w-lg text-sm md:text-lg text-muted-foreground font-medium leading-tight"
          >
            Manifest your vision instantly. Zero code, zero friction. <span className="text-foreground font-bold italic underline decoration-primary/30 decoration-2 md:decoration-4">The era of manual building is over.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex flex-wrap items-center justify-start gap-4"
          >
            <Link
              href="/prompt"
              onClick={handleStartBuilding}
              className="group inline-flex items-center gap-3 rounded-full bg-primary px-8 py-4 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_25px_60px_rgba(255,0,0,0.35)] transition-all hover:translate-y-[-1px] hover:bg-red-600"
            >
              Start Building Now
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/library"
              className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-6 py-4 text-[10px] font-black uppercase tracking-[0.25em] text-gray-700 transition-all hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/70"
            >
              View Projects
            </Link>
          </motion.div>


          </div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="relative mx-auto w-full max-w-[560px] lg:ml-auto"
          >
            <div className="relative aspect-[4/5] w-full">
              <div className="absolute -inset-6 rounded-[36px] bg-primary/20 blur-[120px]" />
              <div className="absolute inset-0 rounded-[28px] border border-border/70 bg-card/85 shadow-[0_40px_120px_rgba(0,0,0,0.45)] overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-transparent to-primary/10" />

                <div className="relative z-10 h-full flex flex-col">
                  <div className="flex items-center justify-between border-b border-border/60 bg-background/70 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-primary shadow-[0_0_8px_rgba(255,0,0,0.4)]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30 dark:bg-white/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20 dark:bg-white/40" />
                    </div>
                    <div className="rounded-full border border-border/70 bg-background/70 px-3 py-1 text-[9px] font-black uppercase tracking-[0.25em] text-muted-foreground">
                      live.tsx
                    </div>
                  </div>

                  <div className="code-marquee flex-1 px-5 py-0 font-mono text-[12px] text-foreground/90 overflow-hidden">
                    <div className="code-track">
                      {[...Array(2)].flatMap((_, blockIndex) => {
                        const codeLines = [
                          <div key={`l1-${blockIndex}`} className="code-line"><span className="text-sky-600 dark:text-sky-300">import</span> React, {'{'} useState, useEffect {'}'} <span className="text-sky-600 dark:text-sky-300">from</span> <span className="text-amber-600 dark:text-amber-200">&apos;react&apos;</span>;</div>,
                          <div key={`l2-${blockIndex}`} className="code-line"><span className="text-sky-600 dark:text-sky-300">import</span> {'{'} motion {'}'} <span className="text-sky-600 dark:text-sky-300">from</span> <span className="text-amber-600 dark:text-amber-200">&apos;framer-motion&apos;</span>;</div>,
                          <div key={`l3-${blockIndex}`} className="code-line"><span className="text-sky-600 dark:text-sky-300">const</span> <span className="text-emerald-600 dark:text-emerald-300">config</span> = {'{'} <span className="text-emerald-600 dark:text-emerald-300">mode</span>: <span className="text-amber-600 dark:text-amber-200">&apos;AI&apos;</span>, <span className="text-emerald-600 dark:text-emerald-300">speed</span>: <span className="text-amber-600 dark:text-amber-200">&apos;fast&apos;</span> {'}'};</div>,
                          <div key={`l4-${blockIndex}`} className="code-line"><span className="text-sky-600 dark:text-sky-300">export</span> <span className="text-sky-600 dark:text-sky-300">default</span> <span className="text-emerald-600 dark:text-emerald-300">function</span> <span className="text-violet-600 dark:text-violet-300">App</span>() {'{'}</div>,
                          <div key={`l5-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">const</span> [data, setData] = useState([]);</div>,
                          <div key={`l6-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">const</span> [loading, setLoading] = useState(<span className="text-sky-600 dark:text-sky-300">true</span>);</div>,
                          <div key={`l7-${blockIndex}`} className="code-line pl-4">useEffect(() =&gt; {'{'} fetch().then(setData) {'}'}, []);</div>,
                          <div key={`l8-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">return</span> (&lt;<span className="text-pink-600 dark:text-pink-300">motion.div</span> <span className="text-emerald-600 dark:text-emerald-300">className</span>=<span className="text-amber-600 dark:text-amber-200">&quot;flex h-screen&quot;</span>&gt;</div>,
                          <div key={`l9-${blockIndex}`} className="code-line pl-8">&lt;<span className="text-pink-600 dark:text-pink-300">h1</span> <span className="text-emerald-600 dark:text-emerald-300">className</span>=<span className="text-amber-600 dark:text-amber-200">&quot;font-black&quot;</span>&gt;</div>,
                          <div key={`l10-${blockIndex}`} className="code-line pl-12"><span className="text-amber-600 dark:text-amber-200">Build faster than thought</span>{blockIndex === 0 && <span className="code-caret" />}</div>,
                          <div key={`l11-${blockIndex}`} className="code-line pl-8">&lt;/<span className="text-pink-600 dark:text-pink-300">h1</span>&gt;</div>,
                          <div key={`l12-${blockIndex}`} className="code-line pl-8">&lt;<span className="text-pink-600 dark:text-pink-300">p</span>&gt;<span className="text-amber-600 dark:text-amber-200">Real UI in seconds.</span>&lt;/<span className="text-pink-600 dark:text-pink-300">p</span>&gt;</div>,
                          <div key={`l13-${blockIndex}`} className="code-line pl-4">&lt;/<span className="text-pink-600 dark:text-pink-300">motion.div</span>&gt;);</div>,
                          <div key={`l14-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">async</span> <span className="text-emerald-600 dark:text-emerald-300">function</span> <span className="text-violet-600 dark:text-violet-300">syncAI</span>() {'{'}</div>,
                          <div key={`l15-${blockIndex}`} className="code-line pl-8"><span className="text-sky-600 dark:text-sky-300">const</span> response = <span className="text-sky-600 dark:text-sky-300">await</span> fetch(<span className="text-amber-600 dark:text-amber-200">&apos;/api/ai&apos;</span>);</div>,
                          <div key={`l16-${blockIndex}`} className="code-line pl-8"><span className="text-sky-600 dark:text-sky-300">const</span> json = <span className="text-sky-600 dark:text-sky-300">await</span> response.json();</div>,
                          <div key={`l17-${blockIndex}`} className="code-line pl-8"><span className="text-sky-600 dark:text-sky-300">return</span> json.result;</div>,
                          <div key={`l18-${blockIndex}`} className="code-line pl-4">{'}'}</div>,
                          <div key={`l19-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">const</span> router = useRouter();</div>,
                          <div key={`l20-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">const</span> {'{'} user {'}'} = useUser();</div>,
                          <div key={`l21-${blockIndex}`} className="code-line pl-4">console.log(<span className="text-amber-600 dark:text-amber-200">&quot;Elisa AI: Synced&quot;</span>);</div>,
                          <div key={`l22-${blockIndex}`} className="code-line pl-4"><span className="text-sky-600 dark:text-sky-300">if</span> (error) <span className="text-sky-600 dark:text-sky-300">return</span> &lt;<span className="text-pink-600 dark:text-pink-300">ErrorView</span> /&gt;;</div>,
                          <div key={`l23-${blockIndex}`} className="code-line">{'}'}</div>,
                          <div key={`l24-${blockIndex}`} className="code-line text-foreground/40 opacity-0">.</div>,
                        ];
                        return codeLines;
                      })}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </motion.div>
        </div>
      </div>

    </section>
  );
}

export default Hero;


