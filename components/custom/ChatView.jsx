"use client"
import { MessagesContext } from '@/context/MessagesContext';
import { Loader2Icon, MousePointer2, MessageSquareOff, MessageSquare } from 'lucide-react';
import { api } from '@/convex/_generated/api';
import { useConvex } from 'convex/react';
import { useParams } from 'next/navigation';
import { useContext, useEffect, useState } from 'react';
import { useMutation } from 'convex/react';
import Prompt from '@/data/Prompt';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import { useRef, useCallback } from 'react';
import { useUser } from "@clerk/clerk-react";

function ChatView() {
    const { id } = useParams();
    const convex = useConvex();
    const { messages, setMessages, selectedElement, setSelectedElement, chatOnly, setChatOnly } = useContext(MessagesContext);
    const [userInput, setUserInput] = useState("");
    const [loading, setLoading] = useState(false);
    const UpdateMessages = useMutation(api.workspace.UpdateWorkspace);
    const scrollRef = useRef(null);
    const { user, isLoaded } = useUser();
    const userId = user?.id;

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({
                top: scrollRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [messages]);

    const GetWorkSpaceData = useCallback(async () => {
        if (!userId) return;
        const result = await convex.query(api.workspace.GetWorkspace, {
            workspaceId: id,
            userId
        });
        if (!result) return;
        const hydratedMessages = Array.isArray(result?.messages)
            ? result.messages.map((msg) => ({ ...msg, fromDb: true }))
            : result?.messages;
        setMessages(hydratedMessages);
        
        // If it's a new workspace (only 1 user message), reset to creation mode
        if (result?.messages?.length === 1 && result?.messages[0].role === 'user') {
            setChatOnly(false);
        }
    }, [id, convex, setMessages, setChatOnly, userId]);

    useEffect(() => {
        id && isLoaded && GetWorkSpaceData();
    }, [id, isLoaded, GetWorkSpaceData])

    const GetAiResponse = useCallback(async () => {
        setLoading(true);
        // Use a different prompt if in Chat Only mode to avoid JSON generation
        const PROMPT = chatOnly 
            ? JSON.stringify(messages) + "\n\n You are in 'Chat Only' mode. Do NOT generate any code. Just talk to the user naturally and concisely."
            : JSON.stringify(messages) + Prompt.CHAT_PROMPT;
            
        try {
            const result = await axios.post('/api/ai-chat', {
                prompt: PROMPT
            });

            // Handle both JSON string and raw text responses
            let content = result.data.result;
            try {
                // If AI returned a JSON string (e.g. from history), parse it
                if (typeof content === 'string' && (content.startsWith('{') || content.startsWith('['))) {
                    const parsed = JSON.parse(content);
                    content = parsed.result || parsed.content || content;
                }
            } catch (e) {
                // Not JSON, use as is
            }

            const aiResp = {
                role: 'ai',
                content: content
            }
            
            setMessages(prev => {
                const updated = [...prev, aiResp];
                
                // Update database in the background
                if (userId) {
                    UpdateMessages({ 
                        messages: updated,
                        workspaceId: id,
                        userId
                    });
                }
                
                return updated;
            });
        } catch (error) {
            console.error('Error getting AI response:', error);
        } finally {
            setLoading(false);
        }
    }, [id, messages, chatOnly, setMessages, UpdateMessages, userId]);

    useEffect(() => {
        if (messages?.length > 0) {
            const role = messages[messages?.length - 1].role;
            if (role === 'user') {
                GetAiResponse();
            }
        }
    }, [messages, GetAiResponse])

    const onGenerate = async (input) => {
        setMessages(prev => [...prev, {
            role: 'user',
            content: input,
            selectedElement: selectedElement
        }]);
        setUserInput('');
        setSelectedElement(null);
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onGenerate(userInput);
        }
    };

    return (
        <div className="relative h-full flex flex-col bg-card text-foreground overflow-hidden transition-all duration-300">
            {/* Chat Header */}
            <div className="p-3 border-b border-border/60 bg-background flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center font-black text-xs">AI</div>
                    <h2 className="text-xs font-black text-foreground uppercase tracking-widest">
                        SYSTEM <span className="text-primary">ASSISTANT</span>
                    </h2>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest">Online</span>
                </div>
            </div>

            {/* Chat messages */}
            <div 
                ref={scrollRef}
                className="flex-1 overflow-y-auto scrollbar-hide p-3 space-y-4 scroll-smooth"
            >
                <div className="space-y-4">
                    {Array.isArray(messages) && messages?.filter(m => m.role !== 'command')?.map((msg, index) => (
                        <div
                            key={index}
                            className={`flex items-start gap-2.5 ${
                                msg.role === 'user' ? 'flex-row-reverse text-right' : 'text-left'
                            }`}
                        >
                            <div className={`shrink-0 h-6 w-6 rounded-full flex items-center justify-center font-bold text-[9px] ${
                                msg.role === 'user' 
                                    ? 'bg-foreground text-background' 
                                    : 'bg-primary text-white'
                            }`}>
                                {msg.role === 'user' ? 'YOU' : 'AI'}
                            </div>
                            
                            <div className={`p-3 max-w-[90%] relative group rounded-2xl ${
                                msg.role === 'user' 
                                    ? 'bg-card/80 border border-border/60 text-foreground' 
                                    : 'bg-primary/10 border border-primary/30 text-foreground'
                            }`}>
                                {msg.selectedElement && (
                                    <div className="mb-2.5 rounded-full p-1.5 flex items-center gap-1.5 border border-primary/30 bg-primary/5">
                                        <MousePointer2 className="h-2.5 w-2.5 text-primary" />
                                        <span className="text-[9px] font-black uppercase tracking-widest text-primary">Target: {msg.selectedElement.tagName}</span>
                                    </div>
                                )}
                                <ReactMarkdown className="prose dark:prose-invert text-[11px] font-medium leading-relaxed">
                                    {msg.content}
                                </ReactMarkdown>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex items-start gap-2.5">
                            <div className="shrink-0 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center font-black text-[9px]">
                                AI
                            </div>
                            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/30 flex items-center gap-2.5">
                                <Loader2Icon className="h-3.5 w-3.5 animate-spin text-primary" />
                                <span className="text-[9px] font-black text-muted-foreground uppercase tracking-widest animate-pulse">Processing...</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Input Section */}
            <div className="p-3 bg-background border-t border-border/60">
                <div className="relative">
                    <textarea
                        placeholder="TYPE YOUR COMMAND HERE..."
                        value={userInput}
                        onChange={(event) => setUserInput(event.target.value)}
                        onKeyDown={handleKeyDown}
                        className="w-full rounded-2xl bg-card/80 border border-border/60 p-3 text-foreground placeholder:text-muted-foreground/70 focus:border-primary outline-none resize-none h-20 text-[11px] font-medium transition-all"
                    />
                    <div className="absolute bottom-2.5 right-2.5 flex items-center gap-2.5">
                         <button
                            onClick={() => setChatOnly(!chatOnly)}
                            title={chatOnly ? "Switch to Creation Mode" : "Switch to Chat Only Mode"}
                            className={`p-2 rounded-full transition-all border ${
                                chatOnly 
                                    ? 'bg-primary border-primary text-white' 
                                    : 'bg-card border-border/60 text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {chatOnly ? <MessageSquareOff className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                        </button>
                        <button
                            onClick={() => onGenerate(userInput)}
                            disabled={!userInput || loading}
                            className="bg-primary hover:bg-red-700 text-white rounded-full p-2 px-4 font-black transition-all disabled:opacity-20 uppercase text-xs"
                        >
                            Send
                        </button>
                    </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                    <div className="text-[9px] font-black text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                        <div className={`h-1.5 w-1.5 rounded-full ${chatOnly ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                        {chatOnly ? 'Chat Mode' : 'Creation Mode'}
                    </div>
                    {selectedElement && (
                         <div className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-2 animate-pulse">
                            <MousePointer2 className="h-3 w-3" />
                            Targeting: {selectedElement.tagName}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ChatView;
