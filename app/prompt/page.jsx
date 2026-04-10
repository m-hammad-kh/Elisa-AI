"use client"
import React, { useContext, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, ImageIcon, X } from "lucide-react";
import { motion } from "framer-motion";
import { useClerk, useUser } from "@clerk/clerk-react";

import { MessagesContext } from "@/context/MessagesContext";
import { api } from "@/convex/_generated/api";
import Lookup from "@/data/Lookup";

export default function PromptPage() {
  const [userInput, setUserInput] = useState("");
  const [technicalPrompt, setTechnicalPrompt] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const { setMessages, setChatOnly } = useContext(MessagesContext);
  const CreateWorkspace = useMutation(api.workspace.CreateWorkspace);
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { openSignIn } = useClerk();

  const displayName = user?.firstName || user?.fullName || "there";

  useEffect(() => {
    const timer = window.setTimeout(() => textareaRef.current?.focus?.(), 300);
    return () => window.clearTimeout(timer);
  }, []);

  const deriveTitle = (value) => {
    if (typeof value !== "string") return "Untitled Project";
    const firstLine = value.split("\n").find((line) => line.trim().length > 0) || "";
    const cleaned = firstLine.replace(/\s+/g, " ").trim();
    if (!cleaned) return "Untitled Project";
    return cleaned.length > 64 ? `${cleaned.slice(0, 61)}...` : cleaned;
  };

  const onGenerate = async () => {
    if (!userInput && !selectedImage) return;
    if (!isLoaded || !user) {
      openSignIn({ redirectUrl: "/library" });
      return;
    }

    setChatOnly(false);
    setIsGenerating(true);

    const msg = {
      role: "user",
      content: userInput,
      technicalContent: technicalPrompt || userInput,
      imageReference: selectedImage, // Base64 or URL
    };
    setMessages(msg);

    try {
      const workspaceID = await CreateWorkspace({
        messages: [msg],
        userId: user.id,
        title: deriveTitle(userInput || "New Project from Image"),
      });

      router.push("/workspace/" + workspaceID);
    } catch (error) {
      console.error("Error creating workspace:", error);
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      setSelectedImage(reader.result);
      setIsUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePaste = (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf("image") !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          setIsUploading(true);
          const reader = new FileReader();
          reader.onloadend = () => {
            setSelectedImage(reader.result);
            setIsUploading(false);
          };
          reader.readAsDataURL(file);
        }
      }
    }
  };

  const enhancePrompt = async () => {
    if (!userInput) return;

    setIsEnhancing(true);
    try {
      const response = await fetch("/api/enhance-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt: userInput }),
      });

      const data = await response.json();

      if (data.userFacingPrompt) {
        setUserInput(data.userFacingPrompt);
        setTechnicalPrompt(data.technicalPrompt || data.userFacingPrompt);
      } else if (data.enhancedPrompt) {
        setUserInput(data.enhancedPrompt);
        setTechnicalPrompt(data.enhancedPrompt);
      }
    } catch (error) {
      console.error("Error enhancing prompt:", error);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleInput = (e) => {
    const target = e.target;
    setUserInput(target.value);
    setTechnicalPrompt("");
    target.style.height = "auto";
    const newHeight = Math.min(target.scrollHeight, 220);
    target.style.height = `${newHeight}px`;
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onGenerate();
    }
  };

  return (
    <section className="relative min-h-screen bg-background text-foreground pt-24 pb-24 overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-primary/15 blur-[140px] animate-blob" />
        <div className="absolute bottom-0 right-0 h-[420px] w-[420px] translate-x-1/3 translate-y-1/3 rounded-full bg-primary/10 blur-[120px] animate-blob" />
        <div className="absolute inset-0 grid-bg opacity-40 dark:opacity-15" />
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
        {isGenerating && (
          <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="relative">
              <div className="h-24 w-24 rounded-full border-t-4 border-primary animate-spin" />
              <Sparkles className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary animate-pulse" />
            </div>
            <h2 className="mt-8 text-2xl font-black uppercase tracking-[0.4em] text-primary animate-pulse">Initializing...</h2>
            <p className="mt-2 text-muted-foreground font-medium">Preparing your workspace</p>
          </div>
        )}
        <div className="mx-auto max-w-3xl text-center">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 flex flex-wrap items-center justify-center gap-3 font-black tracking-tight uppercase italic"
          >
            <span className="h-12 w-12 md:h-14 md:w-14 bg-transparent flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Elisa AI logo"
                width={56}
                height={56}
                className="h-full w-full object-contain drop-shadow-[0_0_14px_rgba(255,0,0,0.4)]"
                priority
              />
            </span>
            <span className="text-3xl md:text-5xl">HELLO,</span>
            <span className="text-3xl md:text-5xl text-primary">{displayName}</span>
          </motion.h1>
          <p className="mt-4 text-sm md:text-lg text-muted-foreground font-semibold">
            Describe your idea in plain words. We&apos;ll build the full workspace for you.
          </p>

          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative mt-10 rounded-[28px] p-[2px]"
          >
            <div
              className="absolute inset-0 rounded-[28px] bg-gradient-to-r from-primary/70 via-white/70 to-primary/70 transition-opacity"
              style={{ opacity: isFocused ? 1 : 0.5 }}
            />
            <div className="relative rounded-[24px] bg-card/90 p-5 text-left shadow-[0_30px_90px_rgba(255,0,0,0.12)] backdrop-blur">
              <div className="flex flex-col gap-3">
                {selectedImage && (
                  <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-border/60 bg-muted group/img shrink-0 shadow-lg">
                    <Image src={selectedImage} alt="Reference" fill className="object-cover transition-transform group-hover/img:scale-110" />
                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 transition-all" />
                    <button 
                      onClick={removeImage}
                      className="absolute top-1 right-1 p-1.5 bg-black/60 text-white rounded-full opacity-0 group-hover/img:opacity-100 transition-opacity hover:bg-primary z-10"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={userInput}
                  onChange={handleInput}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="What are you building today?"
                  className="min-h-[80px] w-full resize-none bg-transparent text-base md:text-lg font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none leading-relaxed"
                />
              </div>

              <div className="mt-6 flex flex-col items-start justify-between gap-4 border-t border-border/60 pt-5 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3">
                  <button
                    onClick={enhancePrompt}
                    disabled={isEnhancing || !userInput}
                    className="flex items-center gap-2 rounded-full border border-border/60 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50"
                  >
                    <Sparkles className={`h-3.5 w-3.5 ${isEnhancing ? "animate-spin" : ""} text-primary`} />
                    {isEnhancing ? "Refining..." : "Refine Idea"}
                  </button>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-all hover:border-primary/40 hover:text-primary disabled:opacity-50"
                    title="Upload Image Reference"
                  >
                    <ImageIcon className={`h-4 w-4 ${isUploading ? "animate-pulse" : ""} text-primary`} />
                  </button>
                </div>

                <button
                  onClick={onGenerate}
                  disabled={!userInput && !selectedImage}
                  className="group inline-flex items-center gap-3 rounded-full bg-primary px-8 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-[0_20px_50px_rgba(255,0,0,0.35)] transition-all hover:translate-y-[-1px] hover:bg-red-600 active:translate-y-0 disabled:opacity-50"
                >
                  Generate
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </button>
              </div>
            </div>
          </motion.div>

          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-muted-foreground">
              Suggestions
            </p>
            <div className="flex flex-wrap justify-center gap-2">
            {Lookup.SUGGSTIONS.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => setUserInput(suggestion.prompt)}
                className="rounded-full border border-black/10 bg-white/70 px-4 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 transition-all hover:border-primary/40 hover:text-primary dark:border-white/10 dark:bg-white/5 dark:text-white/60 dark:hover:border-primary/40 dark:hover:text-primary dark:hover:bg-white/10"
              >
                {suggestion.label}
              </button>
            ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
