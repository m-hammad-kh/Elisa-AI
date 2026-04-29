"use client"
import React from "react";
import { SignIn } from "@clerk/clerk-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4 py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
            Secure Access
          </p>
          <h1 className="text-4xl md:text-5xl font-black uppercase italic text-foreground mt-3">
            Welcome Back
          </h1>
        </div>
        <div className="border border-border/60 bg-card/80 p-6 shadow-[0_0_60px_rgba(255,0,0,0.15)]">
          <SignIn routing="path" path="/sign-in" />
        </div>
      </div>
    </div>
  );
}


