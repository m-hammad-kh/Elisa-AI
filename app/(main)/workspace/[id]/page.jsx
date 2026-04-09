"use client"
import ChatView from '@/components/custom/ChatView';
import CodeView from '@/components/custom/CodeView';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/clerk-react';

const Workspace = () => {
    const router = useRouter();
    const { isLoaded, user } = useUser();

    useEffect(() => {
        if (isLoaded && !user) {
            router.push('/sign-in');
        }
    }, [isLoaded, user, router]);

    if (!isLoaded || !user) {
        return (
        <div className="h-screen bg-background text-foreground flex items-center justify-center">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-muted-foreground">Loading</p>
        </div>
    );
    }

    return (
        <div className="h-[calc(100vh-56px)] bg-background text-foreground relative overflow-hidden flex flex-col">
            
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />

            <div className='flex-1 p-3 md:p-4 lg:p-5 overflow-hidden'>
                <div className='grid grid-cols-1 lg:grid-cols-4 gap-4 h-full'>
                    <div className="lg:col-span-1 h-full overflow-hidden flex flex-col rounded-3xl border border-border/60 bg-card">
                        <ChatView />
                    </div>
                    <div className='lg:col-span-3 h-full overflow-hidden flex flex-col rounded-3xl border border-border/60 bg-card'>
                        <CodeView />
                    </div>
                </div>
            </div>
            
            {/* Bottom Warning Text */}
            <div className="py-1.5 text-center w-full px-4 border-t border-border/60 bg-background z-10 relative">
                <p className="text-[9px] md:text-[10px] text-muted-foreground font-black uppercase tracking-[0.3em]">
                    Elisa is AI and can make mistakes.
                </p>
            </div>
        </div>
    );
};

export default Workspace;
