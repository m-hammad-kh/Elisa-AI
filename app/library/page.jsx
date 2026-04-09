"use client"
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-react";
import { api } from "@/convex/_generated/api";
import { Folder, Clock, ArrowRight, Sparkles, Plus, Pencil, Trash2, Check, X } from "lucide-react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

const formatDate = (value) => {
  if (!value || value <= 0) return "Unknown";
  try {
    const date = new Date(value);
    return new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  } catch (e) {
    return "Unknown";
  }
};

export default function LibraryPage() {
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const router = useRouter();
  const workspaces = useQuery(
    api.workspace.ListWorkspacesByUser,
    userId ? { userId, limit: 24 } : "skip"
  );
  const renameWorkspace = useMutation(api.workspace.RenameWorkspace);
  const deleteWorkspace = useMutation(api.workspace.DeleteWorkspace);
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState("");

  const startEdit = (workspace) => {
    setEditingId(workspace._id);
    setEditTitle(workspace.title || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const saveEdit = async () => {
    if (!userId || !editingId) return;
    const nextTitle = editTitle.trim();
    if (!nextTitle) return;
    await renameWorkspace({
      workspaceId: editingId,
      userId,
      title: nextTitle,
    });
    setEditingId(null);
  };

  const handleDelete = async (workspaceId) => {
    if (!userId) return;
    const ok = window.confirm("Delete this project? This cannot be undone.");
    if (!ok) return;
    await deleteWorkspace({ workspaceId, userId });
  };

  const hasProjects = Array.isArray(workspaces) && workspaces.length > 0;
  const total = Array.isArray(workspaces) ? workspaces.length : 0;
  const heading = useMemo(() => {
    if (!isLoaded) return "Loading Projects";
    if (!hasProjects) return "No Projects Yet";
    return "Project Library";
  }, [isLoaded, hasProjects]);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/sign-in");
    }
  }, [isLoaded, user, router]);

  return (
    <div className="min-h-screen bg-background pt-24 pb-20 relative overflow-hidden text-foreground">
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8 mb-16">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/70 border border-border/60 text-[9px] font-black uppercase tracking-[0.3em] text-gray-700 mb-4 dark:bg-white/5 dark:text-white/70">
              <Sparkles className="h-3 w-3 text-primary" />
              Your Workspace Archive
            </div>
            <h1 className="text-5xl md:text-7xl font-black uppercase italic text-foreground leading-[0.85]">
              {heading}
            </h1>
            <p className="text-muted-foreground font-bold uppercase tracking-[0.18em] text-[11px] mt-4">
              {hasProjects ? `${total} active builds` : "Start a new build to see it here"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/prompt"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary hover:bg-red-700 text-white font-black uppercase tracking-[0.2em] text-[10px] transition-all shadow-[4px_4px_0px_rgba(0,0,0,0.15)] hover:shadow-[2px_2px_0px_rgba(0,0,0,0.15)]"
            >
              <Plus className="h-4 w-4" />
              New Project
            </Link>
          </div>
        </div>

        {!hasProjects && isLoaded && (
          <div className="rounded-[40px] border border-border/60 bg-card/40 backdrop-blur-md p-16 text-center shadow-2xl shadow-black/5">
            <div className="h-20 w-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 text-primary animate-pulse">
              <Folder className="h-10 w-10" />
            </div>
            <p className="text-foreground font-black uppercase tracking-[0.2em] text-lg">
              Your library is empty
            </p>
            <p className="text-muted-foreground text-xs uppercase tracking-[0.2em] mt-3">
              Generate a project to see it listed here
            </p>
          </div>
        )}

        {hasProjects && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {workspaces.map((workspace, index) => (
              <motion.div
                key={workspace._id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-[40px] border border-border/60 bg-card/40 backdrop-blur-md hover:bg-card/80 hover:border-primary/50 transition-all duration-500 shadow-xl shadow-black/5 overflow-hidden group"
              >
                {editingId === workspace._id ? (
                  <div className="p-6 h-full">
                    <div className="flex items-start justify-between gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={saveEdit}
                          className="h-8 w-8 rounded-full flex items-center justify-center border border-border/60 text-foreground hover:text-primary hover:border-primary transition-colors"
                          title="Save"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="h-8 w-8 rounded-full flex items-center justify-center border border-border/60 text-foreground hover:text-primary hover:border-primary transition-colors"
                          title="Cancel"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <input
                      value={editTitle}
                      onChange={(event) => setEditTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveEdit();
                        if (event.key === "Escape") cancelEdit();
                      }}
                      className="mt-6 w-full rounded-full bg-white/70 border border-border/60 px-4 py-2 text-sm font-bold uppercase tracking-widest text-foreground focus:outline-none focus:border-primary dark:bg-white/5"
                      placeholder="Project name"
                    />
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Updated {formatDate(workspace.updatedAt)}
                    </div>
                  </div>
                ) : (
                  <Link href={`/workspace/${workspace._id}`} className="block p-6 h-full group">
                    <div className="flex items-start justify-between gap-4">
                      <div className="h-10 w-10 rounded-2xl bg-primary/20 text-primary flex items-center justify-center">
                        <Folder className="h-5 w-5" />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            startEdit(workspace);
                          }}
                          className="h-8 w-8 rounded-full flex items-center justify-center border border-border/60 text-foreground hover:text-primary hover:border-primary transition-colors"
                          title="Rename"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            handleDelete(workspace._id);
                          }}
                          className="h-8 w-8 rounded-full flex items-center justify-center border border-border/60 text-foreground hover:text-primary hover:border-primary transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <h3 className="text-xl font-black uppercase italic text-foreground mt-6 leading-tight">
                      {workspace.title || "Untitled Project"}
                    </h3>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Updated {formatDate(workspace.updatedAt)}
                    </div>
                    <div className="mt-4 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                      <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                      Open Workspace
                    </div>
                  </Link>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}




