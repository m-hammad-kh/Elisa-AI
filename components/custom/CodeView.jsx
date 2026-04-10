"use client"
import React, { useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    SandpackProvider,
    SandpackLayout,
    SandpackCodeEditor,
    SandpackPreview,
    SandpackFileExplorer,
    useSandpack
} from "@codesandbox/sandpack-react";
import Lookup from '@/data/Lookup';
import { MessagesContext } from '@/context/MessagesContext';
import axios from 'axios';
import Prompt from '@/data/Prompt';
import { useConvex, useMutation } from 'convex/react';
import { useParams } from 'next/navigation';
import { api } from '@/convex/_generated/api';
import { useUser } from "@clerk/clerk-react";
import { useTheme } from "next-themes";
import { 
    Loader2Icon, 
    Download, 
    Smartphone, 
    Tablet, 
    Monitor, 
    Code,
    Eye,
    RotateCw,
    RotateCcw,
    MousePointer2,
    ExternalLink,
    X
} from 'lucide-react';
import JSZip from 'jszip';

const isValidSandboxPath = (value) => {
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return (
        normalized.length > 0 && 
        normalized !== 'null' && 
        normalized !== 'undefined' && 
        normalized !== '/null' && 
        normalized !== '/undefined' && 
        normalized !== '[object object]'
    );
};

const toSandboxPath = (value) => {
    if (typeof value !== 'string') return '/unknown';
    let trimmed = value.trim().replace(/\\/g, '/'); // Handle backslashes
    if (!trimmed) return '/unknown';
    // Ensure leading slash and remove redundant slashes
    trimmed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return trimmed.replace(/\/+/g, '/');
};

const toSandboxCode = (content) => {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') {
        if (typeof content.code === 'string') return content.code;
        if (content.code == null) return '';
        return JSON.stringify(content, null, 2);
    }
    return '';
};

const fixUnsafeSandboxCode = (input) => {
    let code = typeof input === 'string' ? input : '';
    code = code.replace(/\r\n/g, '\n');
    
    const lines = code.split('\n');
    const seenImports = new Set();
    
    // Filter and deduplicate imports
    code = lines
        .filter(line => {
            // Remove lines that import from null, undefined, or empty strings
            const isUnsafeImport = /^\s*import\s+.*from\s+['"](null|undefined|)['"]\s*;?\s*$/.test(line);
            const isUnsafeRequire = /require\(\s*(null|undefined|['"]['"])\s*\)/.test(line);
            
            // Remove our internal selector-helper.js from final exports/saved state
            const isInternalHelper = line.includes('selector-helper.js');
            
            if (isUnsafeImport || isUnsafeRequire || isInternalHelper) return false;

            // Handle duplicate imports
            const importMatch = line.match(/^\s*import\s+.*from\s+['"](.*)['"]\s*;?\s*$/);
            if (importMatch) {
                // Normalize for comparison: remove extra spaces and convert to a standard quote/format
                const normalizedImport = line.trim()
                    .replace(/\s+/g, ' ')
                    .replace(/['"]/g, '"')
                    .replace(/;$/, '');
                
                if (seenImports.has(normalizedImport)) return false; // Duplicate import
                seenImports.add(normalizedImport);
            }

            return true;
        })
        .map(line => line.replace(/require\(\s*(null|undefined)\s*\)/g, '({})'))
        .join('\n');

    // Fix path module usage with null/undefined
    code = code.replace(/\bpath\.(resolve|join|normalize|dirname|basename|extname|relative|isAbsolute|parse)\(([^)]*)\)/g, (_, method, args) => {
        const safeArgs = String(args).replace(/\b(null|undefined)\b/g, '"."');
        return `path.${method}(${safeArgs})`;
    });

    // Fix common null/undefined path assignments
    code = code.replace(/\bpath\s*:\s*(null|undefined)\b/g, 'path: "/"');
    code = code.replace(/\bpath\s*=\s*\{\s*(null|undefined)\s*\}/g, 'path="/"');
    code = code.replace(/\bpath\s*=\s*['"](null|undefined|)['"]/g, 'path="/"');
    code = code.replace(/\bpath\s*:\s*['"]\s*['"]/g, 'path: "/"');
    code = code.replace(/\bpath\s*=\s*\{\s*['"]\s*['"]\s*\}/g, 'path="/"');

    // Fix invalid URLs/links
    code = code.replace(/(src|href|to|action|poster)\s*=\s*\{\s*(null|undefined|['"]['"])\s*\}/g, '$1="/"');
    code = code.replace(/(src|href|to|action|poster)\s*=\s*['"](null|undefined|)['"]/g, '$1="/"');

    // Fix new URL(null/undefined, ...) usage
    code = code.replace(/new URL\(\s*(null|undefined)\s*,/g, 'new URL(".",');

    return code;
};

const SANDBOX_EXTERNAL_RESOURCES = [
    'https://cdn.tailwindcss.com',
    'https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css'
];

const MAX_PROMPT_MESSAGE_CHARS = 22000;
const MAX_PROMPT_FILES_CHARS = 420000;
const MAX_IMPORTANT_FILE_CHARS = 18000;
const MAX_OTHER_FILE_CHARS = 6000;

const truncateForPrompt = (code, limit) => {
    const text = typeof code === 'string' ? code : '';
    if (!Number.isFinite(limit) || limit === Infinity) return text;
    if (text.length <= limit) return text;
    const head = Math.max(400, Math.floor(limit * 0.6));
    const tail = Math.max(200, Math.floor(limit * 0.2));
    const trimmedHead = text.slice(0, Math.min(head, text.length));
    const trimmedTail = text.slice(Math.max(text.length - tail, 0));
    const removed = Math.max(text.length - trimmedHead.length - trimmedTail.length, 0);
    return `${trimmedHead}\n... [truncated ${removed} chars] ...\n${trimmedTail}`;
};


const trimMessagesForPrompt = (messages) => {
    const list = Array.isArray(messages) ? messages : [];
    if (list.length <= 8) return list;
    const kept = [];
    let size = 0;
    for (let i = list.length - 1; i >= 0; i -= 1) {
        const msg = list[i];
        const content = typeof msg?.content === 'string' ? msg.content : '';
        const nextSize = size + content.length;
        if (kept.length < 8 || nextSize <= MAX_PROMPT_MESSAGE_CHARS) {
            kept.unshift(msg);
            size = nextSize;
            continue;
        }
        break;
    }
    return kept;
};

const compressMessagesForPrompt = (messages) => {
    const list = Array.isArray(messages) ? messages : [];
    if (list.length === 0) return list;
    return list.map((msg, idx) => {
        const content = typeof msg?.content === 'string' ? msg.content : '';
        if (!content) return msg;
        const isRecent = idx >= list.length - 2;
        const limit = msg.role === 'ai'
            ? (isRecent ? 2200 : 1200)
            : (isRecent ? 2600 : 1600);
        if (content.length <= limit) return msg;
        return {
            ...msg,
            content: `${content.slice(0, limit)}\n... [truncated] ...`
        };
    });
};

const buildPromptFiles = (inputFiles, activeFile) => {
    const source = inputFiles && typeof inputFiles === 'object' ? inputFiles : {};
    const totalSize = JSON.stringify(source).length;
    const useCompression = totalSize > MAX_PROMPT_FILES_CHARS;
    const important = new Set([
        '/index.html',
        '/index.jsx',
        '/index.js',
        '/index.tsx',
        '/App.jsx',
        '/App.tsx',
        '/styles.css',
        '/package.json',
        '/src/index.jsx',
        '/src/index.js',
        '/src/index.tsx',
        '/src/main.jsx',
        '/src/main.tsx',
        '/src/App.jsx',
        '/src/App.tsx'
    ]);

    const addVariants = (path) => {
        if (!path || typeof path !== 'string') return;
        const clean = path.startsWith('/') ? path : `/${path}`;
        important.add(clean);
        if (clean.startsWith('/src/')) {
            important.add(clean.slice(4));
        } else {
            important.add(`/src${clean}`);
        }
        if (clean.startsWith('/public/')) {
            important.add(clean.slice(7));
        } else if (!clean.startsWith('/public/')) {
            important.add(`/public${clean}`);
        }
    };

    addVariants(activeFile);

    const entries = Object.entries(source).map(([path, content]) => {
        const rawCode = toSandboxCode(content);
        const size = rawCode.length;
        const priority = important.has(path)
            ? 3
            : (path.includes('/components/') || path.includes('/pages/'))
                ? 2
                : (path.includes('/sections/') || path.includes('/layouts/'))
                    ? 1
                    : 0;
        return { path, rawCode, size, priority };
    });

    entries.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.size - a.size;
    });

    const promptFiles = {};
    const fileIndex = [];
    let used = 0;

    entries.forEach((entry) => {
        const limit = useCompression
            ? (entry.priority >= 2 ? MAX_IMPORTANT_FILE_CHARS : MAX_OTHER_FILE_CHARS)
            : Infinity;
        const trimmed = truncateForPrompt(entry.rawCode, limit);
        const cost = trimmed.length + entry.path.length + 12;
        const mustInclude = entry.priority >= 2;
        if (!useCompression || mustInclude || used + cost <= MAX_PROMPT_FILES_CHARS) {
            promptFiles[entry.path] = { code: trimmed };
            used += cost;
        } else {
            fileIndex.push({ path: entry.path, size: entry.size });
        }
    });

    if (fileIndex.length > 0) {
        fileIndex.sort((a, b) => b.size - a.size);
    }

    return {
        files: promptFiles,
        fileIndex,
        useCompression,
        totalSize
    };
};

const formatSelectedElement = (element) => {
    if (!element || typeof element !== 'object') return '';
    const tag = element.tagName ? String(element.tagName).toLowerCase() : 'element';
    const id = element.id ? `#${element.id}` : '';
    const classToken = typeof element.className === 'string' && element.className.trim().length > 0
        ? `.${element.className.trim().split(/\s+/)[0]}`
        : '';
    const textSnippet = typeof element.textContent === 'string' && element.textContent.trim().length > 0
        ? ` text="${element.textContent.trim().slice(0, 80)}"`
        : '';
    return `${tag}${id}${classToken}${textSnippet}`;
};

function CodeView() {

    const { id } = useParams();
    const { user, isLoaded } = useUser();
    const userId = user?.id;
    const [activeTab, setActiveTab] = useState('code');
    const [files, setFiles] = useState(Lookup?.DEFAULT_FILE);
    const [activeEditorFile, setActiveEditorFile] = useState('/index.html');
    const { messages, setMessages, selectedElement, setSelectedElement, chatOnly } = useContext(MessagesContext);
    const UpdateFiles = useMutation(api.workspace.UpdateFiles);
    const convex = useConvex();
    const [loading, setLoading] = useState(false);
    
    // Selector State
    const [isSelectorActive, setIsSelectorActive] = useState(false);
    const isSelectorActiveRef = useRef(isSelectorActive);
    const previewWrapperRef = useRef(null);

    useEffect(() => {
        isSelectorActiveRef.current = isSelectorActive;
    }, [isSelectorActive]);

    // Novelty Features State
    const [previewDevice, setPreviewDevice] = useState('desktop'); // desktop, tablet, mobile
    const [editorTheme, setEditorTheme] = useState('dark');
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (!resolvedTheme) return;
        setEditorTheme(resolvedTheme === 'light' ? 'light' : 'dark');
    }, [resolvedTheme]);
    
    // History State
    const [history, setHistory] = useState([Lookup.DEFAULT_FILE]);
    const [historyIndex, setHistoryIndex] = useState(0);
    const [sandpackKey, setSandpackKey] = useState(0); // For forcing remount
    const sandpackFilesRef = useRef(files);
    const skipInitialGenerateRef = useRef(false);
    const hasPersistedFilesRef = useRef(false);
    const [filesLoaded, setFilesLoaded] = useState(false);
    const lastProcessedIndexRef = useRef(-1);

    useEffect(() => {
        // Reset per-workspace refs when switching IDs
        lastProcessedIndexRef.current = -1;
        skipInitialGenerateRef.current = false;
        hasPersistedFilesRef.current = false;
        setSelectedElement(null);
    }, [id, setSelectedElement]);

    useEffect(() => {
        sandpackFilesRef.current = files;
    }, [files]);
    
    // Message listener for selector
    useEffect(() => {
        const handleMessage = (event) => {
            if (event.data.type === 'ELEMENT_SELECTED') {
                setSelectedElement(event.data.element);
                setIsSelectorActive(false); // Auto-deactivate after selection
            }
            if (event.data.type === 'ELISA_SELECTOR_READY') {
                try {
                    event.source?.postMessage?.({ type: 'ELISA_SELECTOR_SET_ACTIVE', active: isSelectorActiveRef.current }, '*');
                } catch (e) {}
            }
            if (event.data.type === 'TEXT_EDITED') {
                const { oldText, newText, element } = event.data;
                if (oldText === newText) return;

                setFiles(prev => {
                    const next = { ...prev };
                    const elementId = typeof element?.id === 'string' ? element.id.trim() : '';
                    const elementClass = typeof element?.className === 'string' ? element.className.trim() : '';
                    const classToken = elementClass ? elementClass.split(/\s+/)[0] : '';

                    const replaceInTarget = (code) => {
                        if (typeof code !== 'string' || !code.includes(oldText)) return code;

                        const tryReplaceNear = (hintIndex) => {
                            if (hintIndex < 0) return null;
                            const searchStart = hintIndex;
                            const searchEnd = Math.min(code.length, hintIndex + 800);
                            const windowText = code.slice(searchStart, searchEnd);
                            const localIndex = windowText.indexOf(oldText);
                            if (localIndex === -1) return null;
                            const absoluteIndex = searchStart + localIndex;
                            return code.slice(0, absoluteIndex) + newText + code.slice(absoluteIndex + oldText.length);
                        };

                        if (elementId) {
                            const hint1 = code.indexOf(`id="${elementId}"`);
                            const replaced1 = tryReplaceNear(hint1);
                            if (replaced1) return replaced1;
                            const hint2 = code.indexOf(`id='${elementId}'`);
                            const replaced2 = tryReplaceNear(hint2);
                            if (replaced2) return replaced2;
                        }

                        if (classToken) {
                            const hintCandidates = [
                                code.indexOf(`className="${classToken}`),
                                code.indexOf(`className='${classToken}`),
                                code.indexOf(`class="${classToken}`),
                                code.indexOf(`class='${classToken}`)
                            ];
                            for (const hint of hintCandidates) {
                                const replaced = tryReplaceNear(hint);
                                if (replaced) return replaced;
                            }
                        }

                        return code.replace(oldText, newText);
                    };

                    const matchesHint = (code) => {
                        if (!code) return false;
                        if (elementId) {
                            return code.includes(`id="${elementId}"`) || code.includes(`id='${elementId}'`);
                        }
                        if (classToken) {
                            return (
                                code.includes(`className="${classToken}`) ||
                                code.includes(`className='${classToken}`) ||
                                code.includes(`class="${classToken}`) ||
                                code.includes(`class='${classToken}`)
                            );
                        }
                        return true;
                    };

                    let found = false;
                    const candidates = Object.entries(next).filter(([path, content]) => {
                        if (path === '/selector-helper.js') return false;
                        return typeof content?.code === 'string' && content.code.includes(oldText);
                    });

                    const preferred = candidates.find(([, content]) => matchesHint(content.code));
                    const targetEntry = preferred || candidates[0];

                    if (targetEntry) {
                        const [path, content] = targetEntry;
                        next[path] = {
                            ...content,
                            code: replaceInTarget(content.code)
                        };
                        found = true;
                    }
                    
                    if (found) {
                        if (userId) {
                            UpdateFiles({
                                workspaceId: id,
                                userId,
                                files: next
                            });
                        }
                        // setSandpackKey(prev => prev + 1); // REMOVED: No reload on text edit
                    }
                    return next;
                });
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setSelectedElement, id, UpdateFiles, userId]);

    const postSelectorStateToPreview = useCallback((active) => {
        const iframe = previewWrapperRef.current?.querySelector?.('iframe');
        if (!iframe?.contentWindow) return;
        iframe.contentWindow.postMessage({ type: 'ELISA_SELECTOR_SET_ACTIVE', active }, '*');
    }, []);

    useEffect(() => {
        if (activeTab !== 'preview') {
            postSelectorStateToPreview(false);
            return;
        }
        const t1 = window.setTimeout(() => postSelectorStateToPreview(isSelectorActive), 50);
        const t2 = window.setTimeout(() => postSelectorStateToPreview(isSelectorActive), 250);
        const t3 = window.setTimeout(() => postSelectorStateToPreview(isSelectorActive), 800);
        return () => {
            window.clearTimeout(t1);
            window.clearTimeout(t2);
            window.clearTimeout(t3);
        };
    }, [isSelectorActive, activeTab, previewDevice, sandpackKey, postSelectorStateToPreview]);

    // Internal component to sync files from Sandpack
    const SandpackSync = () => {
        const { sandpack } = useSandpack();
        const { files: currentSandpackFiles, activeFile } = sandpack;
        const debounceTimerRef = useRef(null);

        // Keep the ref updated for AI generation context
        useEffect(() => {
            if (currentSandpackFiles) {
                sandpackFilesRef.current = currentSandpackFiles;
            }
        }, [currentSandpackFiles]);

        // Persist manual changes to state and database with debouncing
        useEffect(() => {
            if (!currentSandpackFiles || loading) return;

            // Clear any existing timer
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            // Set a new timer to update after 2 seconds of inactivity
            debounceTimerRef.current = setTimeout(() => {
                const processedCurrent = preprocessFiles(currentSandpackFiles);
                const processedState = preprocessFiles(files);
                
                const currentStr = JSON.stringify(processedCurrent);
                const stateStr = JSON.stringify(processedState);
                
                if (currentStr !== stateStr) {
                    console.log("Manual edit detected, syncing to database...");
                    // We only update the database (Convex) here. 
                    // We DO NOT call setFiles(processedCurrent) because that would trigger a re-render 
                    // of the SandpackProvider, causing the preview to reload.
                    // Sandpack already has the latest code in its internal state.
                    if (userId) {
                        UpdateFiles({
                            workspaceId: id,
                            userId,
                            files: processedCurrent
                        });
                    }
                    
                    // Update our internal files state SILENTLY (without triggering re-render if possible)
                    // or just rely on the next AI generation to pull from sandpackFilesRef.current
                }
            }, 2000);

            return () => {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                }
            };
        }, [currentSandpackFiles, id, UpdateFiles, loading, files, userId]);

        // Sync active file from Sandpack back to our state
        useEffect(() => {
            if (activeFile) {
                // Normalize the active file path to match our state
                let normalizedActive = activeFile;
                if (normalizedActive.startsWith('/src/')) normalizedActive = '/' + normalizedActive.slice(5);
                else if (normalizedActive.startsWith('/public/')) normalizedActive = '/' + normalizedActive.slice(8);
                
                if (normalizedActive !== activeEditorFile) {
                    setActiveEditorFile(normalizedActive);
                }
            }
        }, [activeFile]);

        return null;
    }


    const preprocessFiles = useCallback((files) => {
        const processed = {};
        Object.entries(files || {}).forEach(([path, content]) => {
            if (!isValidSandboxPath(path)) return;
            
            // Normalize path by removing /src/ or /public/ prefixes for easier merging
            let cleanPath = toSandboxPath(path);
            if (cleanPath.startsWith('/src/')) cleanPath = '/' + cleanPath.slice(5);
            else if (cleanPath.startsWith('/public/')) cleanPath = '/' + cleanPath.slice(8);
            
            // Fix missing or wrong extensions for React components (AI often forgets or uses .js)
            const isReactFile = cleanPath.startsWith('/components/') || 
                              cleanPath.startsWith('/pages/') || 
                              cleanPath === '/App' || 
                              cleanPath === '/index' ||
                              cleanPath === '/App.js' ||
                              cleanPath === '/index.js' ||
                              (cleanPath.endsWith('.js') && (cleanPath.includes('/components/') || cleanPath.includes('/pages/')));

            if (isReactFile && !cleanPath.endsWith('.jsx')) {
                if (cleanPath.endsWith('.js')) {
                    cleanPath = cleanPath.slice(0, -3) + '.jsx';
                } else if (!cleanPath.includes('.')) {
                    cleanPath += '.jsx';
                }
            }

            const code = fixUnsafeSandboxCode(toSandboxCode(content));
            processed[cleanPath] = { code };
        });
        return processed;
    }, []);

    const pickActiveEditorFile = useCallback((fileObj) => {
        const has = (path) => Boolean(fileObj?.[path] && typeof toSandboxCode(fileObj[path]) === 'string' && toSandboxCode(fileObj[path]).trim().length > 0);
        if (has('/index.html')) return '/index.html';
        if (has('/App.jsx')) return '/App.jsx';
        if (has('/pages/Home.jsx')) return '/pages/Home.jsx';
        const keys = Object.keys(fileObj || {});
        return keys.find(k => k.endsWith('.jsx')) || keys[0] || '/index.html';
    }, []);

    const normalizeGeneratedFiles = useCallback((inputFiles) => {
        const next = { ...(inputFiles || {}) };
        const hasFile = (path) => Boolean(next[path] && typeof toSandboxCode(next[path]) === 'string' && toSandboxCode(next[path]).trim().length > 0);
        const setFile = (path, content) => {
            next[path] = { code: fixUnsafeSandboxCode(toSandboxCode(content)) };
        };
        const ensureDefaultExport = (path, componentName, fallbackCode) => {
            if (!hasFile(path)) {
                setFile(path, fallbackCode);
                return;
            }

            let code = toSandboxCode(next[path]) || '';
            if (/\bexport\s+default\b/.test(code)) {
                setFile(path, code);
                return;
            }

            const hasDeclaration = new RegExp(`\\b(function|const|class)\\s+${componentName}\\b`).test(code);
            if (hasDeclaration) {
                code = `${code}\n\nexport default ${componentName};`;
                setFile(path, code);
                return;
            }

            const merged = `${code}\n\n${fallbackCode}`.trim();
            setFile(path, merged);
        };

        // If we have both .jsx and .js for the same component, prefer the .jsx and delete the .js to avoid duplication/conflicts
        Object.keys(next).forEach(path => {
            if (path.endsWith('.jsx')) {
                const jsPath = path.slice(0, -1); // remove 'x'
                if (hasFile(jsPath)) {
                    delete next[jsPath];
                }
            }
        });

        // Ensure essentials exist
        if (!hasFile('/App.jsx') && hasFile('/App.js')) {
            setFile('/App.jsx', next['/App.js']);
            delete next['/App.js'];
        }

        if (!hasFile('/index.jsx') && hasFile('/index.js')) {
            setFile('/index.jsx', next['/index.js']);
            delete next['/index.js'];
        }

        if (!hasFile('/styles.css') && hasFile('/App.css')) {
            setFile('/styles.css', next['/App.css']);
            delete next['/App.css'];
        }

        ensureDefaultExport(
            '/components/Footer.jsx',
            'Footer',
            `const Footer = () => (
  <footer className="bg-gray-100 p-8 text-center text-gray-600 border-t mt-12">
    ï¿½ ${new Date().getFullYear()} Project. All rights reserved.
  </footer>
);

export default Footer;`
        );

        ensureDefaultExport(
            '/components/Navbar.jsx',
            'Navbar',
            `const Navbar = () => (
  <nav className="p-4 bg-white shadow-sm flex justify-between items-center px-8 border-b">
    <div className="font-bold text-xl">Logo</div>
    <div className="flex gap-4">
      <span>Home</span>
      <span>About</span>
      <span>Contact</span>
    </div>
  </nav>
);

export default Navbar;`
        );
        
        // Final sanity check for entry points
        if (!hasFile('/index.html')) {
            setFile('/index.html', Lookup.DEFAULT_FILE['/index.html'].code);
        }

        return next;
    }, []);

    const GetFiles = useCallback(async () => {
        if (!userId) return;
        try {
            const result = await convex.query(api.workspace.GetWorkspace, {
                workspaceId: id,
                userId
            });
            if (!result) {
                setFilesLoaded(true);
                return;
            }
            const persistedFiles = result?.fileData && Object.keys(result.fileData).length > 0;
            hasPersistedFilesRef.current = Boolean(persistedFiles);
            if (persistedFiles) {
                skipInitialGenerateRef.current = true;
            }
            const processedFiles = preprocessFiles(result?.fileData || {});
            const defaultFiles = preprocessFiles(Lookup.DEFAULT_FILE);
            const mergedFiles = { ...defaultFiles, ...processedFiles };
            const normalizedFiles = normalizeGeneratedFiles(mergedFiles);
            try {
                if (JSON.stringify(normalizedFiles) !== JSON.stringify(mergedFiles)) {
                    UpdateFiles({
                        workspaceId: id,
                        userId,
                        files: normalizedFiles
                    });
                }
            } catch (e) {
                // ignore normalization sync errors
            }
            setFiles(normalizedFiles);
            setActiveEditorFile(pickActiveEditorFile(normalizedFiles));
            // Reset history on load
            setHistory([normalizedFiles]);
            setHistoryIndex(0);
            setSandpackKey(prev => prev + 1);
            setFilesLoaded(true);
        } catch (error) {
            console.error('Error loading workspace files:', error);
            setFilesLoaded(true);
        }
    }, [id, convex, preprocessFiles, pickActiveEditorFile, userId, normalizeGeneratedFiles, UpdateFiles]);

    useEffect(() => {
        if (!id || !isLoaded) return;
        setFilesLoaded(false);
        GetFiles();
    }, [id, isLoaded, GetFiles])

    const GenerateAiCode = useCallback(async () => {
        setLoading(true);
        
        // Count user messages to determine if this is an update
        const userMessagesCount = messages.filter(m => m.role === 'user').length;
        const isUpdate = userMessagesCount > 1;

        // Clean messages to avoid sending redundant huge code blocks
        // BUT keep enough context for updates
        const cleanMessages = messages
              .filter(msg => msg.role !== 'command')
              .map(msg => {
                  const contentToUse = msg.technicalContent || msg.content;
                  if (msg.role === 'ai') {
                    try {
                        const parsed = JSON.parse(msg.content);
                        // For AI messages, we send the explanation. 
                        // The actual code is sent separately in the 'Current Code Files' block
                        return {
                            role: 'ai',
                            content: parsed.explanation || "Updated the project based on your request."
                        };
                    } catch (e) {
                        return {
                            role: 'ai',
                            content: msg.content.substring(0, 500)
                        };
                    }
                }
                  if (msg.role === 'user' && msg.selectedElement) {
                      const targetHint = formatSelectedElement(msg.selectedElement);
                      return {
                          role: msg.role,
                          content: [
                              `TARGET ELEMENT: ${targetHint}`,
                              'INSTRUCTION: Only update this element or its nearest relevant section. Do not change other sections, layout, or styling.',
                              `USER REQUEST: ${contentToUse}`
                          ].join('\n')
                      };
                  }
                  return {
                      role: msg.role,
                      content: contentToUse
                  };
              });
        const compressedMessages = compressMessagesForPrompt(cleanMessages);
        const trimmedMessages = trimMessagesForPrompt(compressedMessages);

        // CRITICAL: Use the most up-to-date files from Sandpack internal state if available
        // This ensures AI updates include manual edits even if they haven't synced to DB yet
        const currentFiles = sandpackFilesRef.current && Object.keys(sandpackFilesRef.current).length > 0
            ? sandpackFilesRef.current
            : files;
        
        let currentFilesToSync = preprocessFiles(currentFiles);
        const promptFilesResult = buildPromptFiles(currentFilesToSync, activeEditorFile);
        const cleanFiles = { ...promptFilesResult.files };
        const fileIndex = promptFilesResult.fileIndex || [];

        const promptPayload = {
            files: cleanFiles,
            fileIndex
        };

        let PROMPT = JSON.stringify(trimmedMessages) + "\n\n Current Code Files Structure: " + JSON.stringify(promptPayload) + "\n\n" + Prompt.CODE_GEN_PROMPT;
        if (promptFilesResult.useCompression) {
            PROMPT += "\n\n NOTE: Some files were truncated or omitted from content. Use fileIndex for awareness and avoid rewriting unrelated files.";
        }
        const latestTargetedMessage = [...messages].reverse().find((msg) => msg.role === 'user' && msg.selectedElement);
        const targetedHint = latestTargetedMessage?.selectedElement
            ? formatSelectedElement(latestTargetedMessage.selectedElement)
            : '';
        
        if (isUpdate) {
            PROMPT += "\n\n CRITICAL: You are UPDATING an existing project. Focus on modifying the relevant files while PRESERVING the existing structure and high-end design. DO NOT reset to a blank project or 'Hello World'. Return the FULL content of all modified files. If the project already has complex components and pages, you MUST keep them and only update the requested parts.";
            PROMPT += "\n\n IMPORTANT: Only return the files that actually need changing. Do not send back standard boilerplates unless they need updates. If you rename or delete a file, specify it clearly in your explanation.";
            PROMPT += "\n\n FILE EXTENSIONS: Always use .jsx for React components. If the current project uses .jsx, continue using .jsx. Ensure all imports are correct and relative.";
            PROMPT += "\n\n IMPORT CONFLICTS: Avoid duplicate declarations. For example, if you have a page component named 'Menu', and you also need the 'Menu' icon from lucide-react, you MUST alias one of them (e.g., import { Menu as MenuIcon } from 'lucide-react').";
            if (targetedHint) {
                PROMPT += `\n\n TARGETED UPDATE MODE: The user targeted ${targetedHint}. ONLY update that element or its closest section. Do NOT change other sections, layout, or styling.`;
            }
        }
        
        try {
            const result = await axios.post('/api/gen-ai-code', {
                prompt: PROMPT,
                existingFiles: cleanFiles
            }, {
                timeout: 80000
            });

            if (result.data?.error) {
                throw new Error(result.data.error);
            }

            const processedAiFiles = preprocessFiles(result.data?.files || {});
            
            // Merge AI generated files with current files. 
            // We prioritize AI files, then current files, and only use DEFAULT_FILE as a base for missing essentials.
            const mergedFiles = normalizeGeneratedFiles({ 
                ...Lookup.DEFAULT_FILE, 
                ...currentFilesToSync, 
                ...processedAiFiles 
            });
            
            setFiles(mergedFiles);
            setActiveEditorFile(pickActiveEditorFile(mergedFiles));
            setHistory(prev => {
                const next = [...prev.slice(0, historyIndex + 1), mergedFiles];
                return next;
            });
            setHistoryIndex(prev => prev + 1);

            const nextTitle = typeof result.data?.projectTitle === 'string'
                ? result.data.projectTitle.trim()
                : undefined;
            if (userId) {
                await UpdateFiles({
                    workspaceId: id,
                    userId,
                    files: mergedFiles,
                    title: nextTitle && nextTitle.length > 0 ? nextTitle : undefined
                });
            }
            setSandpackKey(prev => prev + 1);
        } catch (error) {
            console.error('GenerateAiCode Error:', error);
            const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
            const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error occurred';
            alert(isTimeout
                ? "Generation timed out (~80s max). Please try again. If it keeps timing out, shorten the request or try again in a minute."
                : "Error generating code: " + errorMsg);
        } finally {
            setLoading(false);
        }
    }, [id, messages, files, historyIndex, preprocessFiles, pickActiveEditorFile, normalizeGeneratedFiles, UpdateFiles, userId, activeEditorFile]);

    useEffect(() => {
        if (!filesLoaded) return;
        if (messages?.length > 0) {
            const lastIndex = messages.length - 1;

            if (skipInitialGenerateRef.current) {
                skipInitialGenerateRef.current = false;
                lastProcessedIndexRef.current = lastIndex;
                return;
            }
            
            // If we've already processed this message, skip
            if (lastProcessedIndexRef.current >= lastIndex) {
                return;
            }

            // Find the last 'user' message that hasn't been processed
            // We look from the end of the messages
            let userMessageIndex = -1;
            for (let i = lastIndex; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    userMessageIndex = i;
                    break;
                }
                // If we hit a command, stop looking for user messages for now
                if (messages[i].role === 'command') break;
            }

            if (userMessageIndex > lastProcessedIndexRef.current) {
                lastProcessedIndexRef.current = lastIndex; // Mark up to the end as processed

                const latestUserMsg = messages[userMessageIndex];
                if (latestUserMsg?.fromDb && hasPersistedFilesRef.current) {
                    return;
                }

                // Only generate code if NOT in chatOnly mode
                if (!chatOnly) {
                    GenerateAiCode();
                }
                return;
            }

            // Handle commands
            const lastMsg = messages[lastIndex];
            if (lastMsg.role === 'command') {
                lastProcessedIndexRef.current = lastIndex;
                const cmd = lastMsg.content;
                if (cmd === 'UNDO' && historyIndex > 0) {
                    const newIndex = historyIndex - 1;
                    setHistoryIndex(newIndex);
                    setFiles(history[newIndex]);
                    setSandpackKey(prev => prev + 1);
                    if (userId) {
                        UpdateFiles({
                            workspaceId: id,
                            userId,
                            files: history[newIndex]
                        });
                    }
                } else if (cmd === 'REDO' && historyIndex < history.length - 1) {
                    const newIndex = historyIndex + 1;
                    setHistoryIndex(newIndex);
                    setFiles(history[newIndex]);
                    setSandpackKey(prev => prev + 1);
                    if (userId) {
                        UpdateFiles({
                            workspaceId: id,
                            userId,
                            files: history[newIndex]
                        });
                    }
                }
            }
        }
    }, [messages, history, historyIndex, id, UpdateFiles, chatOnly, GenerateAiCode, userId, filesLoaded])

    const downloadFiles = async () => {
        try {
            const zip = new JSZip();
            const fileMap = {};
            Object.entries(files || {}).forEach(([filename, content]) => {
                if (!isValidSandboxPath(filename)) return;
                const cleanPath = toSandboxPath(filename);
                const fileContent = fixUnsafeSandboxCode(toSandboxCode(content));
                if (!fileContent) return;
                fileMap[cleanPath] = fileContent;
            });

            const hasViteEntry = Boolean(fileMap['/index.html'] && (fileMap['/index.jsx'] || fileMap['/index.tsx']));
            const hasLegacyEntry = Boolean(fileMap['/public/index.html'] && (fileMap['/index.js'] || fileMap['/App.js']));

            const exportDependencies = { ...(Lookup.DEPENDENCIES || {}) };
            
            // Extract dependencies from generated package.json if available
            const pkgJsonStr = fileMap['/package.json'] || fileMap['/src/package.json'];
            if (pkgJsonStr) {
                try {
                    const parsed = JSON.parse(pkgJsonStr);
                    if (parsed.dependencies) {
                        Object.assign(exportDependencies, parsed.dependencies);
                    }
                } catch (e) {}
            }

            delete exportDependencies.vite;
            delete exportDependencies['@vitejs/plugin-react'];

            const packageJson = {
                name: "generated-project",
                version: "1.0.0",
                private: true,
                type: "module",
                scripts: {
                    dev: "vite",
                    build: "vite build",
                    preview: "vite preview"
                },
                dependencies: exportDependencies,
                devDependencies: {
                    vite: "latest",
                    "@vitejs/plugin-react": "latest"
                }
            };

            const writeFile = (path, content) => {
                if (!path || typeof path !== 'string') return;
                const cleanFileName = path.startsWith('/') ? path.slice(1) : path;
                if (!cleanFileName) return;
                zip.file(cleanFileName, content);
            };

            const ensureExternalStylesInHtml = (html) => {
                const input = typeof html === 'string' ? html : '';
                if (!input.trim()) return input;
                let out = input;

                const needsTailwind = !out.includes('cdn.tailwindcss.com');
                const needsTypography = !out.includes('@tailwindcss/typography');
                const needsScript = !out.includes('type="module"') && !out.includes('src="/index.jsx"');

                if (!needsTailwind && !needsTypography && !needsScript) return out;

                const headInjections = [
                    needsTypography
                        ? '<link rel="stylesheet" href="https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css" />'
                        : null,
                    needsTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : null
                ].filter(Boolean).join('\n    ');

                if (headInjections) {
                    const headCloseMatch = out.match(/<\/head>/i);
                    if (headCloseMatch) {
                        out = out.replace(/<\/head>/i, `    ${headInjections}\n  </head>`);
                    } else {
                        const headOpenMatch = out.match(/<head[^>]*>/i);
                        if (headOpenMatch) {
                            out = out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${headInjections}`);
                        }
                    }
                }

                if (needsScript) {
                    const bodyCloseMatch = out.match(/<\/body>/i);
                    const scriptTag = '    <script type="module" src="/index.jsx"></script>';
                    if (bodyCloseMatch) {
                        out = out.replace(/<\/body>/i, `${scriptTag}\n  </body>`);
                    } else {
                        out = out + `\n${scriptTag}`;
                    }
                }

                return out;
            };

            if (hasViteEntry && !hasLegacyEntry) {
                const indexHtml = ensureExternalStylesInHtml(fileMap['/index.html']);
                Object.entries(fileMap).forEach(([path, content]) => {
                    if (path === '/selector-helper.js') return;
                    if (path === '/package.json') return;
                    if (path === '/index.html') {
                        writeFile(path, indexHtml);
                        return;
                    }
                    writeFile(path, content);
                });
                writeFile('/package.json', JSON.stringify(packageJson, null, 2));
            } else {
                const indexHtml = ensureExternalStylesInHtml((Lookup.DEFAULT_FILE?.['/index.html']?.code || fileMap['/index.html'] || '').trim());
                const indexJsx = `import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;

                const appCode = fileMap['/App.jsx'] || fileMap['/App.js'] || (Lookup.DEFAULT_FILE?.['/App.jsx']?.code || '');
                const styles = fileMap['/styles.css'] || fileMap['/App.css'] || '';

                writeFile('/index.html', indexHtml || `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Website</title>
    <script src="https://cdn.tailwindcss.com"></script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/index.jsx"></script>
  </body>
</html>`);
                writeFile('/index.jsx', indexJsx);
                writeFile('/App.jsx', appCode);
                writeFile('/styles.css', styles);
                writeFile('/vite.config.js', `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react({
      include: "**/*.{js,jsx,ts,tsx}"
    })
  ]
});
`);

                Object.entries(fileMap).forEach(([path, content]) => {
                    if (path === '/selector-helper.js') return;
                    if (path === '/package.json') return;
                    if (path === '/public/index.html') return;
                    if (path === '/index.js' || path === '/index.jsx' || path === '/index.tsx') return;
                    if (path === '/App.js' || path === '/App.jsx' || path === '/App.tsx') return;
                    if (path === '/App.css' || path === '/styles.css') return;
                    writeFile(path, content);
                });

                writeFile('/package.json', JSON.stringify(packageJson, null, 2));
            }

            const blob = await zip.generateAsync({ type: "blob" });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'project-files.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Error downloading files:', error);
        }
    };

    const toggleSelector = () => {
        const nextState = !isSelectorActive;
        setIsSelectorActive(nextState);
        if (nextState) {
            setActiveTab('preview');
            // setSandpackKey(prev => prev + 1); // REMOVED: No reload on activation
        } else {
            setSelectedElement(null);
            // setSandpackKey(prev => prev + 1); // REMOVED: No reload on deactivation
        }
    };

    const openPreviewInNewTab = () => {
        if (!id) return;
        window.open(`/workspace/${id}/preview`, '_blank', 'noopener,noreferrer');
    };

    // Final validation of files object before passing to Sandpack
    const validatedFiles = useMemo(() => {
        const validated = {};
        Object.entries(files || {}).forEach(([path, content]) => {
            if (!isValidSandboxPath(path)) return;
            const cleanPath = toSandboxPath(path);
            validated[cleanPath] = { code: fixUnsafeSandboxCode(toSandboxCode(content)) };
        });

        // Inject Selector Helper if active
        // NOTE: We inject the script logic regardless of active state, 
        // but the script itself checks `isSelectorActive` (passed as a var) to enable/disable listeners
        const selectorScript = `
if (typeof window !== 'undefined') {
  (function () {
    const STYLE_ID = 'elisa-selector-styles';
    const STATE_KEY = '__elisaSelectorState';

    const state = window[STATE_KEY] || (window[STATE_KEY] = {});

    const ensureStyles = () => {
      if (document.getElementById(STYLE_ID)) return;
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.innerHTML = \`
        .elisa-selector-highlight {
          outline: 2px solid #6366f1 !important;
          outline-offset: -2px !important;
          box-shadow: 0 0 20px rgba(99, 102, 241, 0.6) !important;
          cursor: crosshair !important;
          z-index: 9999999 !important;
        }
        .elisa-selector-text-mode {
          cursor: text !important;
        }
      \`;
      document.head.appendChild(style);
    };

    const clearHighlight = () => {
      if (state.lastElement?.classList) {
        state.lastElement.classList.remove('elisa-selector-highlight', 'elisa-selector-text-mode');
      }
      state.lastElement = null;
    };

    const isInputLike = (el) => {
      const tag = el?.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'OPTION';
    };

    const hasMeaningfulText = (el) => {
      const text = el?.textContent || '';
      return text.trim().length > 0;
    };

    const hasDirectTextNode = (el) => {
      if (!el?.childNodes) return false;
      for (let i = 0; i < el.childNodes.length; i += 1) {
        const n = el.childNodes[i];
        if (n.nodeType === 3 && (n.textContent || '').trim().length > 0) return true;
      }
      return false;
    };

    const findEditableTextElement = (start) => {
      let el = start;
      while (el && el !== document.body && el !== document.documentElement) {
        if (el.nodeType !== 1) return null;
        if (isInputLike(el)) return null;
        const tag = el.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') return null;
        if (el.isContentEditable) return el;
        const elementChildren = el.children ? el.children.length : 0;
        if ((hasDirectTextNode(el) || (elementChildren === 0 && hasMeaningfulText(el))) && hasMeaningfulText(el)) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    };

    const getHighlightTarget = (start) => findEditableTextElement(start) || start;

    state.onPointerOver = state.onPointerOver || ((e) => {
      if (!state.active) return;
      const raw = e.target;
      if (!raw || raw === document.body || raw === document.documentElement) return;
      const target = getHighlightTarget(raw);
      if (!target?.classList) return;
      if (state.lastElement && state.lastElement !== target) {
        state.lastElement.classList.remove('elisa-selector-highlight', 'elisa-selector-text-mode');
      }
      target.classList.add('elisa-selector-highlight');
      const textEl = findEditableTextElement(raw);
      if (textEl === target) {
        target.classList.add('elisa-selector-text-mode');
      } else {
        target.classList.remove('elisa-selector-text-mode');
      }
      state.lastElement = target;
    });

    state.onPointerDown = state.onPointerDown || ((e) => {
      if (!state.active) return;
      const raw = e.target;
      if (!raw || raw === document.body || raw === document.documentElement) return;
      if (raw.nodeType !== 1) return;

      if (state.isEditing) return;

      const editableEl = findEditableTextElement(raw);
      if (editableEl) {
        e.preventDefault();
        e.stopPropagation();

        const oldText = editableEl.textContent || '';
        editableEl.contentEditable = 'true';
        editableEl.focus();
        state.isEditing = true;
        state.editingEl = editableEl;
        try {
          const selection = window.getSelection && window.getSelection();
          if (selection) {
            const range = document.createRange();
            range.selectNodeContents(editableEl);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);
          }
        } catch (e) {}

        const onKeyDown = (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            editableEl.blur();
          }
        };

        const onBlur = () => {
          editableEl.contentEditable = 'false';
          const newText = editableEl.textContent || '';
          if (oldText !== newText) {
            const elementInfo = {
              tagName: editableEl.tagName,
              id: editableEl.id,
              className: typeof editableEl.className === 'string' ? editableEl.className : ''
            };
            window.parent.postMessage({ type: 'TEXT_EDITED', oldText, newText, element: elementInfo }, '*');
          }
          state.isEditing = false;
          state.editingEl = null;
          editableEl.removeEventListener('keydown', onKeyDown);
        };

        editableEl.addEventListener('keydown', onKeyDown);
        editableEl.addEventListener('blur', onBlur, { once: true });
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      const target = raw;
      const elementInfo = {
        tagName: target.tagName,
        id: target.id,
        className: typeof target.className === 'string' ? target.className : '',
        textContent: (target.textContent || '').substring(0, 100)
      };
      window.parent.postMessage({ type: 'ELEMENT_SELECTED', element: elementInfo }, '*');
    });

    const setActive = (nextActive) => {
      const active = Boolean(nextActive);
      if (state.active === active) return;
      state.active = active;
      ensureStyles();
      if (active) {
        document.addEventListener('pointerover', state.onPointerOver, true);
        document.addEventListener('pointerdown', state.onPointerDown, true);
      } else {
        document.removeEventListener('pointerover', state.onPointerOver, true);
        document.removeEventListener('pointerdown', state.onPointerDown, true);
        clearHighlight();
      }
    };

    if (state.onMessage) {
      window.removeEventListener('message', state.onMessage);
    }
    state.onMessage = (event) => {
      if (event?.data?.type === 'ELISA_SELECTOR_SET_ACTIVE') {
        setActive(event.data.active);
      }
    };
    window.addEventListener('message', state.onMessage);

    state.setActive = setActive;
    ensureStyles();
    window.parent.postMessage({ type: 'ELISA_SELECTOR_READY' }, '*');
  })();
}
`;
        validated['/selector-helper.js'] = { code: selectorScript };
        const entryCandidates = ['/index.jsx', '/index.tsx', '/index.js'];
        const entryFile = entryCandidates.find(p => Boolean(validated[p]));
        if (entryFile) {
            const baseIndexCode = toSandboxCode(validated[entryFile]);
            const importLine = "import './selector-helper.js';";
            validated[entryFile] = {
                code: baseIndexCode.includes(importLine) ? baseIndexCode : `${importLine}\n${baseIndexCode}`
            };
        }

        return validated;
    }, [files]);

    const sandpackConfig = useMemo(() => {
        const template = 'react';
        const previewDependencies = { ...(Lookup.DEPENDENCIES || {}) };

        // Dynamically extract dependencies from generated package.json if available
        const pkgJson = validatedFiles['/package.json'] || validatedFiles['/src/package.json'];
        if (pkgJson) {
            try {
                const parsed = JSON.parse(toSandboxCode(pkgJson));
                if (parsed.dependencies) {
                    Object.assign(previewDependencies, parsed.dependencies);
                }
            } catch (e) {}
        }

        delete previewDependencies.vite;
        delete previewDependencies['@vitejs/plugin-react'];
        delete previewDependencies['esbuild-wasm'];

        const ensureExternalStylesInHtml = (html) => {
            const input = typeof html === 'string' ? html : '';
            if (!input.trim()) return input;
            let out = input;
            const needsTailwind = !out.includes('cdn.tailwindcss.com');
            const needsTypography = !out.includes('@tailwindcss/typography');
            const needsScript = !out.includes('type="module"') && !out.includes('src="/index.jsx"');

            if (!needsTailwind && !needsTypography && !needsScript) return out;

            const headInjections = [
                needsTypography
                    ? '<link rel="stylesheet" href="https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css" />'
                    : null,
                needsTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : null
            ].filter(Boolean).join('\n    ');

            if (headInjections) {
                if (out.match(/<\/head>/i)) {
                    out = out.replace(/<\/head>/i, `    ${headInjections}\n  </head>`);
                } else if (out.match(/<head[^>]*>/i)) {
                    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${headInjections}`);
                }
            }

            if (needsScript) {
                const bodyCloseMatch = out.match(/<\/body>/i);
                const scriptTag = '    <script type="module" src="/index.jsx"></script>';
                if (bodyCloseMatch) {
                    out = out.replace(/<\/body>/i, `${scriptTag}\n  </body>`);
                } else {
                    out = out + `\n${scriptTag}`;
                }
            }
            return out;
        };

        const stripViteModuleScripts = (html) => {
            const input = typeof html === 'string' ? html : '';
            return input.replace(/<script[^>]*type=["']module["'][\s\S]*?<\/script>/gi, '');
        };

        const isViteLike = Boolean(
            validatedFiles['/index.html'] &&
            (validatedFiles['/index.jsx'] ||
                validatedFiles['/index.tsx'] ||
                validatedFiles['/index.js'] ||
                validatedFiles['/src/main.jsx'] ||
                validatedFiles['/src/main.tsx'] ||
                validatedFiles['/vite.config.js'])
        );

        let sandpackFiles = validatedFiles;
        let entry;
        let activeFile;

        if (isViteLike) {
            const nextFiles = {};
            const fallbackHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AI Website</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
            const rawHtml = toSandboxCode(validatedFiles['/index.html'] || '').trim();
            nextFiles['/public/index.html'] = { code: ensureExternalStylesInHtml(stripViteModuleScripts(rawHtml || fallbackHtml)) };

            Object.entries(validatedFiles).forEach(([path, content]) => {
                if (path === '/index.html') return;
                if (path.startsWith('/public/') || path.startsWith('/src/')) {
                    nextFiles[path] = content;
                    return;
                }
                nextFiles[`/src${path}`] = content;
            });

            if (!nextFiles['/src/index.tsx'] && !nextFiles['/src/index.jsx'] && !nextFiles['/src/index.js']) {
                if (nextFiles['/src/main.tsx']) {
                    nextFiles['/src/index.tsx'] = { code: `import "./main.tsx";` };
                } else if (nextFiles['/src/main.jsx']) {
                    nextFiles['/src/index.jsx'] = { code: `import "./main.jsx";` };
                }
            }

            const rewriteEntryCode = (code) => {
                const input = typeof code === 'string' ? code : '';
                return input
                    .replace(/from\s+["']\.\/App\.(jsx|js|tsx|ts)["']/g, 'from "./App"')
                    .replace(/from\s+["']\.\/App["']/g, 'from "./App"')
                    .replace(/import\s+App\s+from\s+["']\.\/App\.(jsx|js|tsx|ts)["']/g, 'import App from "./App"');
            };

            if (nextFiles['/src/index.tsx']) {
                nextFiles['/src/index.tsx'] = { code: rewriteEntryCode(toSandboxCode(nextFiles['/src/index.tsx'])) };
            } else if (nextFiles['/src/index.jsx']) {
                nextFiles['/src/index.jsx'] = { code: rewriteEntryCode(toSandboxCode(nextFiles['/src/index.jsx'])) };
            } else if (nextFiles['/src/index.js']) {
                nextFiles['/src/index.js'] = { code: rewriteEntryCode(toSandboxCode(nextFiles['/src/index.js'])) };
            }

            sandpackFiles = nextFiles;
            entry = nextFiles['/src/index.tsx']
                ? '/src/index.tsx'
                : nextFiles['/src/index.jsx']
                    ? '/src/index.jsx'
                    : nextFiles['/src/index.js']
                        ? '/src/index.js'
                        : Object.keys(nextFiles)[0] || '/src/index.js';
        } else {
            const entryCandidates = [
                '/index.jsx',
                '/index.tsx',
                '/index.js',
                '/src/main.jsx',
                '/src/main.tsx',
                '/src/index.jsx',
                '/src/index.tsx',
                '/src/index.js'
            ];
            entry = entryCandidates.find((path) => Boolean(validatedFiles[path])) || Object.keys(validatedFiles)[0] || '/index.js';
        }

        const desiredActive = typeof activeEditorFile === 'string' ? activeEditorFile : '';
        if (isViteLike) {
            if (desiredActive === '/index.html') {
                activeFile = '/public/index.html';
            } else if (desiredActive.startsWith('/public/') || desiredActive.startsWith('/src/')) {
                activeFile = desiredActive;
            } else if (desiredActive.startsWith('/')) {
                activeFile = `/src${desiredActive}`;
            } else {
                activeFile = entry;
            }
        } else {
            activeFile = desiredActive && desiredActive.startsWith('/') ? desiredActive : entry;
        }

        if (!sandpackFiles[activeFile]) {
            if (sandpackFiles['/public/index.html']) activeFile = '/public/index.html';
            else if (sandpackFiles['/index.html']) activeFile = '/index.html';
            else if (sandpackFiles[entry]) activeFile = entry;
            else activeFile = Object.keys(sandpackFiles)[0] || entry;
        }

        return {
            template,
            previewDependencies,
            sandpackFiles,
            entry,
            activeFile
        };
    }, [validatedFiles, activeEditorFile]);

    const sandpackOptions = useMemo(() => ({
        externalResources: SANDBOX_EXTERNAL_RESOURCES,
        activeFile: sandpackConfig.activeFile,
        bundlerTimeoutSecs: 120,
        initMode: 'immediate',
        autorun: true,
    }), [sandpackConfig.activeFile]);

    const sandpackCustomSetup = useMemo(() => ({
        dependencies: sandpackConfig.previewDependencies,
        entry: sandpackConfig.entry
    }), [sandpackConfig.previewDependencies, sandpackConfig.entry]);

    const onUndo = () => {
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), {
            role: 'command',
            content: 'UNDO'
        }]);
    }
    const onRedo = () => {
        setMessages(prev => [...(Array.isArray(prev) ? prev : []), {
            role: 'command',
            content: 'REDO'
        }]);
    }


    return (
        <div className="relative h-full flex flex-col border border-border/60 bg-background overflow-hidden">
            {/* Toolbar */}
            <div className="bg-background border-b border-border/60 px-3 py-2 flex items-center justify-between shrink-0">
                {/* Left Side: Tabs + History */}
                <div className="flex items-center gap-3">
                    <div className='flex items-center bg-card/80 p-0.5 rounded-full'>
                        <button 
                            onClick={() => setActiveTab('code')}
                            className={`flex items-center px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-full ${activeTab === 'code' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Code className="h-3 w-3 mr-1.5" />
                            Code
                        </button>
                        <button 
                            onClick={() => setActiveTab('preview')}
                            className={`flex items-center px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest transition-all rounded-full ${activeTab === 'preview' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                        >
                            <Eye className="h-3 w-3 mr-1.5" />
                            Preview
                        </button>
                    </div>

                    {/* History Controls */}
                    <div className="flex items-center bg-card/80 p-0.5 gap-0.5 rounded-full">
                        <button
                            onClick={onUndo}
                            disabled={historyIndex <= 0}
                            className={`p-1 transition-all rounded-full ${
                                historyIndex > 0 
                                    ? 'text-foreground hover:bg-primary hover:text-white' 
                                    : 'text-muted-foreground/40 cursor-not-allowed'
                            }`}
                            title="Undo"
                        >
                            <RotateCcw className="h-3 w-3" />
                        </button>
                        <button
                            onClick={onRedo}
                            disabled={historyIndex >= history.length - 1}
                            className={`p-1 transition-all rounded-full ${
                                historyIndex < history.length - 1 
                                    ? 'text-foreground hover:bg-primary hover:text-white' 
                                    : 'text-muted-foreground/40 cursor-not-allowed'
                            }`}
                            title="Redo"
                        >
                            <RotateCw className="h-3 w-3" />
                        </button>
                    </div>
                </div>
                
                {/* Right Actions */}
                <div className="flex items-center gap-3">
                    {/* Selector - Only visible in preview */}
                    {activeTab === 'preview' && (
                        <div className="flex items-center bg-card/80 p-0.5 rounded-full">
                            <button
                                onClick={toggleSelector}
                                className={`p-1.5 transition-all flex items-center gap-1.5 rounded-full ${isSelectorActive ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                title={isSelectorActive ? "Deactivate Selector" : "Activate Selector"}
                            >
                                <MousePointer2 className={`h-3 w-3 ${isSelectorActive ? 'animate-pulse' : ''}`} />
                                <span className="text-[8px] font-black uppercase tracking-widest">{isSelectorActive ? 'Active' : 'Select'}</span>
                            </button>
                        </div>
                    )}

                    {/* Device Toggle - Only visible in preview */}
                    {activeTab === 'preview' && (
                        <div className="flex items-center bg-card/80 p-0.5 rounded-full">
                            <button 
                                onClick={() => setPreviewDevice('desktop')}
                                className={`p-1.5 transition-colors rounded-full ${previewDevice === 'desktop' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Desktop view"
                            >
                                <Monitor className="h-3 w-3" />
                            </button>
                            <button 
                                onClick={() => setPreviewDevice('tablet')}
                                className={`p-1.5 transition-colors rounded-full ${previewDevice === 'tablet' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Tablet view"
                            >
                                <Tablet className="h-3 w-3" />
                            </button>
                            <button 
                                onClick={() => setPreviewDevice('mobile')}
                                className={`p-1.5 transition-colors rounded-full ${previewDevice === 'mobile' ? 'bg-primary text-white' : 'text-muted-foreground hover:text-foreground'}`}
                                title="Mobile view"
                            >
                                <Smartphone className="h-3 w-3" />
                            </button>
                        </div>
                    )}

                    {activeTab === 'preview' && (
                        <div className="flex items-center bg-card/80 p-0.5 rounded-full">
                            <button
                                type="button"
                                onClick={openPreviewInNewTab}
                                aria-label="Open link in browser"
                                className="p-1.5 transition-colors text-muted-foreground hover:text-foreground hover:bg-primary/20 rounded-full"
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    )}

                    <button
                        onClick={downloadFiles}
                        className="flex items-center px-4 py-1.5 bg-foreground text-background font-black text-[9px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all rounded-full"
                    >
                        <Download className="h-3.5 w-3.5 mr-2" />
                        Export
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className={`flex-1 overflow-hidden relative bg-background`}>
                <SandpackProvider 
                    key={sandpackKey}
                    files={sandpackConfig.sandpackFiles}
                    template={sandpackConfig.template}
                    theme={editorTheme}
                    customSetup={sandpackCustomSetup}
                    options={sandpackOptions}
                    style={{ height: '100%' }}
                >
                    <SandpackSync />
                    <div className="h-full flex flex-col relative workspace-sandpack">
                        {isSelectorActive && activeTab === 'preview' && (
                            <div className="absolute inset-0 z-[9999] pointer-events-none border-4 border-primary/30 animate-pulse">
                                <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1 text-[9px] font-black uppercase tracking-widest shadow-xl flex items-center gap-1.5 border border-border/60">
                                    <MousePointer2 className="h-2.5 w-2.5" />
                                    SELECTOR ACTIVE
                                </div>
                            </div>
                        )}
                        {selectedElement && (
                            <div className="absolute top-14 right-3 z-[10000] bg-background border border-border/60 p-2.5 shadow-2xl flex items-center gap-2.5 animate-in fade-in slide-in-from-right-4 duration-300">
                                <div className="bg-primary/10 p-1.5">
                                    <MousePointer2 className="h-3.5 w-3.5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest leading-none mb-1">Selected</p>
                                    <p className="text-[11px] font-black text-foreground uppercase truncate max-w-[110px]">
                                        {selectedElement.tagName.toLowerCase()}
                                        {selectedElement.id ? `#${selectedElement.id}` : selectedElement.className ? `.${selectedElement.className.split(' ')[0]}` : ''}
                                    </p>
                                </div>
                                <button 
                                    onClick={() => setSelectedElement(null)}
                                    className="p-1 hover:bg-card/80 transition-colors rounded-full"
                                >
                                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                                </button>
                            </div>
                        )}
                        <div className="flex-1 overflow-hidden relative">
                            <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'code' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                <SandpackLayout className="flex-1 !border-none !rounded-none h-full" style={{ height: '100%' }}>
                                    <SandpackFileExplorer style={{ height: '100%' }} />
                                    <SandpackCodeEditor 
                                        style={{ height: '100%' }}
                                        showTabs={true}
                                        showLineNumbers={true}
                                        showInlineErrors={true}
                                        showRunButton={false}
                                        closableTabs={true}
                                        wrapContent={true}
                                    />
                                </SandpackLayout>
                            </div>
                            <div className={`absolute inset-0 transition-opacity duration-200 ${activeTab === 'preview' ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                                <div className="h-full w-full flex items-stretch justify-center p-0 bg-background transition-all duration-300 rounded-b-3xl overflow-hidden">
                                    <div 
                                        ref={previewWrapperRef}
                                        className={`bg-white shadow-2xl overflow-hidden transition-all duration-500 h-full relative rounded-b-3xl ${
                                            previewDevice === 'mobile' ? 'w-[375px]' : 
                                            previewDevice === 'tablet' ? 'w-[768px]' : 'w-full'
                                        }`}
                                    >
                                        <SandpackPreview 
                                            showNavigator={true}
                                            style={{ height: '100%' }}
                                            showOpenInCodeSandbox={false}
                                            showRefreshButton={false}
                                            showRestartButton={false}
                                            actionsChildren={<div style={{ display: 'none' }} />}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </SandpackProvider>

                {loading && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center">
                        <div className="relative">
                            <Loader2Icon className="h-16 w-16 text-primary animate-spin" />
                            <div className="absolute inset-0 flex items-center justify-center">
                                <div className="h-8 w-8 bg-primary/20 rounded-full animate-ping" />
                            </div>
                        </div>
                        <div className="mt-6 text-center">
                            <h3 className="text-2xl font-black text-foreground uppercase italic tracking-tighter mb-2">Architecting</h3>
                            <p className="text-primary font-black text-[9px] uppercase tracking-[0.5em] animate-pulse">Building the future...</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CodeView;


