"use client"
import React from 'react';
import Image from 'next/image';
import { Menu, X, FolderClock, Sun, Moon } from 'lucide-react';
import Link from 'next/link';
import { Button } from '../ui/button';
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useTheme } from 'next-themes';

function Header() {
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);
    const { resolvedTheme, setTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Fix hydration mismatch
    React.useEffect(() => {
        setMounted(true);
    }, []);

    return (
        <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-md transition-all border-b border-border/60">
            <div className="mx-auto px-4 sm:px-6 lg:px-10 max-w-[96%]">
                <div className="flex h-14 items-center justify-between md:grid md:grid-cols-3">
                    {/* Logo */}
                    <Link href="/" className="flex items-center space-x-2.5 transition-all hover:opacity-80 md:justify-self-start group">
                        <Image
                            src="/logo.png"
                            alt="Elisa AI logo"
                            width={32}
                            height={32}
                            className="h-8 w-8 object-contain drop-shadow-[0_0_8px_rgba(255,0,0,0.3)] transition-all"
                            priority
                        />
                        <span className="text-xl font-black tracking-tighter text-foreground uppercase italic">
                            Elisa <span className="text-primary not-italic">AI</span>
                        </span>
                    </Link>

                    {/* Desktop Navigation */}
                    <nav className="hidden md:flex items-center justify-center space-x-8 md:justify-self-center">
                        <Link href="/" className="text-[11px] font-bold text-muted-foreground transition-all hover:text-primary uppercase tracking-widest">
                            Home
                        </Link>
                        <Link href="/about" className="text-[11px] font-bold text-muted-foreground transition-all hover:text-primary uppercase tracking-widest">
                            About
                        </Link>
                        <Link href="/features" className="text-[11px] font-bold text-muted-foreground transition-all hover:text-primary uppercase tracking-widest">
                            Features
                        </Link>
                        <Link href="/contact" className="text-[11px] font-bold text-muted-foreground transition-all hover:text-primary uppercase tracking-widest">
                            Contact
                        </Link>
                    </nav>

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center justify-end space-x-4 md:justify-self-end">
                        <button
                            onClick={() => setTheme(isDark ? 'light' : 'dark')}
                            className="h-8 w-8 text-muted-foreground transition-all hover:text-primary flex items-center justify-center"
                            title="Toggle theme"
                        >
                            {mounted && (isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />)}
                        </button>
                        <SignedOut>
                            <SignInButton mode="modal">
                                <Button className="h-8 px-4 bg-primary text-white font-bold text-[10px] uppercase tracking-widest transition-all hover:bg-red-600 rounded-full">
                                    Sign In
                                </Button>
                            </SignInButton>
                        </SignedOut>
                        <SignedIn>
                            <div className="flex items-center">
                                <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }}>
                                    <UserButton.MenuItems>
                                        <UserButton.Link label="Recent Projects" labelIcon={<FolderClock className="h-4 w-4" />} href="/library" />
                                    </UserButton.MenuItems>
                                </UserButton>
                            </div>
                        </SignedIn>
                    </div>

                    {/* Mobile Menu Button */}
                    <button 
                        className="md:hidden p-2 text-foreground hover:text-primary transition-all"
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                        {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                    </button>
                </div>
            </div>

            {/* Mobile Navigation */}
            {isMenuOpen && (
                <div className="md:hidden border-t border-border/60 bg-background px-4 py-8 shadow-2xl">
                    <div className="flex flex-col space-y-6">
                        <Link href="/" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-foreground hover:text-primary uppercase tracking-widest">
                            Home
                        </Link>
                        <Link href="/about" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-foreground hover:text-primary uppercase tracking-widest">
                            About
                        </Link>
                        <Link href="/features" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-foreground hover:text-primary uppercase tracking-widest">
                            Features
                        </Link>
                        <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="text-lg font-bold text-foreground hover:text-primary uppercase tracking-widest">
                            Contact
                        </Link>
                        
                        <div className="pt-4 flex flex-col gap-4">
                            <button
                                onClick={() => {
                                    setTheme(isDark ? 'light' : 'dark');
                                    setIsMenuOpen(false);
                                }}
                                className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-foreground hover:text-primary transition-all"
                            >
                                {mounted && (isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />)}
                                Switch Theme
                            </button>
                            <SignedIn>
                                <div className="flex items-center justify-between py-2 border-t border-border/40 mt-2">
                                    <div className="flex items-center gap-3">
                                        <UserButton appearance={{ elements: { avatarBox: "h-9 w-9" } }} />
                                        <span className="text-xs font-bold uppercase tracking-widest text-foreground">My Account</span>
                                    </div>
                                    <Link href="/library" onClick={() => setIsMenuOpen(false)} className="text-primary">
                                        <FolderClock className="h-5 w-5" />
                                    </Link>
                                </div>
                            </SignedIn>
                            <SignedOut>
                                <SignInButton mode="modal">
                                    <Button onClick={() => setIsMenuOpen(false)} className="h-12 w-full bg-primary text-white font-bold uppercase tracking-widest rounded-xl">
                                        Sign In
                                    </Button>
                                </SignInButton>
                            </SignedOut>
                        </div>
                    </div>
                </div>
            )}
        </header>
    );
}

export default Header;



