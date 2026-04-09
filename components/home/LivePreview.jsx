import React from 'react';

function LivePreview() {
    return (
        <section className="py-20 bg-background border-t border-border/60 overflow-hidden relative">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-[90%]">
                <div className="relative mx-auto max-w-4xl">
                    <div className="text-center mb-10">
                        <h2 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl uppercase italic">
                            SEE IT <span className="text-primary not-italic">IN ACTION</span>
                        </h2>
                        <p className="mt-4 text-base text-muted-foreground font-bold uppercase tracking-tight">
                            Watch your ideas come to life in real-time as you describe them.
                        </p>
                    </div>
                    
                    {/* Mockup Container */}
                    <div className="relative rounded-none bg-primary/20 p-1 shadow-[0_0_50px_rgba(255,0,0,0.2)] sm:p-2">
                        <div className="relative overflow-hidden rounded-none bg-card shadow-inner border border-border/60">
                            {/* Browser Header */}
                            <div className="flex items-center gap-2 bg-card/80 px-3 py-2 border-b border-border/60">
                                <div className="flex gap-1">
                                    <div className="h-2 w-2 rounded-full bg-red-500/50" />
                                    <div className="h-2 w-2 rounded-full bg-yellow-500/50" />
                                    <div className="h-2 w-2 rounded-full bg-green-500/50" />
                                </div>
                                <div className="mx-auto flex h-5 w-full max-w-xs items-center justify-center rounded-none bg-card/80 px-2 text-[10px] text-muted-foreground font-black uppercase tracking-widest">
                                    elisa.ai
                                </div>
                            </div>
                            
                            {/* Preview Content */}
                            <div className="relative aspect-[16/9] w-full bg-card flex items-center justify-center overflow-hidden">
                                {/* Abstract UI representation */}
                                <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-red-900/10" />
                                <div className="grid grid-cols-12 gap-3 p-6 w-full h-full opacity-60">
                                    {/* Sidebar */}
                                    <div className="col-span-3 h-full rounded-none bg-card/80 border border-border/60 animate-pulse" />
                                    
                                    {/* Main Content */}
                                    <div className="col-span-9 h-full flex flex-col gap-3">
                                        <div className="h-24 w-full rounded-none bg-card/80 border border-border/60 animate-pulse delay-75" />
                                        <div className="grid grid-cols-2 gap-3 flex-1">
                                            <div className="rounded-none bg-card/80 border border-border/60 animate-pulse delay-150" />
                                            <div className="rounded-none bg-card/80 border border-border/60 animate-pulse delay-200" />
                                        </div>
                                    </div>
                                </div>
                                
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="bg-primary text-white px-5 py-2.5 font-black uppercase text-xs tracking-widest shadow-[5px_5px_0px_white]">
                                        Live Preview Mode
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    {/* Decorative Elements */}
                    <div className="absolute -top-20 -left-20 -z-10 h-64 w-64 rounded-full bg-primary/20 blur-[80px]" />
                    <div className="absolute -bottom-20 -right-20 -z-10 h-64 w-64 rounded-full bg-red-900/20 blur-[80px]" />
                </div>
            </div>
        </section>
    );
}

export default LivePreview;



