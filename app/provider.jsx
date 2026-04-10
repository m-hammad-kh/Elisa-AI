"use client"
import React, { useEffect, useState } from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import Header from '@/components/custom/Header';
import Footer from '@/components/home/Footer';
import { MessagesContext } from '@/context/MessagesContext';
import { usePathname } from 'next/navigation';
import { ClerkProvider } from "@clerk/clerk-react";
import PageTransition from '@/components/custom/PageTransition';

function Provider({children}) {
  const [messages,setMessages]=useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [chatOnly, setChatOnly] = useState(false);
  const pathname = usePathname();
  const isWorkspace = pathname?.includes('/workspace');
  const isWorkspacePreview = typeof pathname === 'string' && pathname.includes('/workspace/') && pathname.endsWith('/preview');
  const isPromptPage = typeof pathname === 'string' && pathname.startsWith('/prompt');
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const className = 'workspace-no-scroll';
    const root = document.documentElement;
    const body = document.body;

    if (isWorkspace) {
      root.classList.add(className);
      body.classList.add(className);
    } else {
      root.classList.remove(className);
      body.classList.remove(className);
    }

    return () => {
      root.classList.remove(className);
      body.classList.remove(className);
    };
  }, [isWorkspace]);

  return (
    <div className={isWorkspace ? "h-screen flex flex-col overflow-hidden" : ""}>
      <ClerkProvider publishableKey={clerkKey} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignInUrl="/" afterSignUpUrl="/">
        <MessagesContext.Provider value={{messages,setMessages, selectedElement, setSelectedElement, chatOnly, setChatOnly}}>
          <NextThemesProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem 
              disableTransitionOnChange
              >
                {!isWorkspacePreview && <Header />}
                <div className={isWorkspace ? "flex-1 overflow-hidden" : ""}>
                  <PageTransition>
                    {children}
                  </PageTransition>
                </div>
                {!isWorkspace && !isPromptPage && <Footer />}
          </NextThemesProvider>
        </MessagesContext.Provider>
      </ClerkProvider>
    </div>
  );
}

export default Provider;
