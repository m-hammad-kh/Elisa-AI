"use client"
import React, { useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { parse as parseBabel } from '@babel/parser';
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
        normalized !== 'unknown' &&
        normalized !== '/unknown' &&
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

const SYNC_EXCLUDED_FILES = new Set(['/selector-helper.js']);

const stableFilesHash = (fileMap) => {
    if (!fileMap || typeof fileMap !== 'object') return '';
    const entries = Object.entries(fileMap)
        .filter(([path]) => isValidSandboxPath(path) && !SYNC_EXCLUDED_FILES.has(toSandboxPath(path)))
        .map(([path, content]) => [toSandboxPath(path), toSandboxCode(content)])
        .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
};

const REACT_HOOK_NAMES = [
    'useState',
    'useEffect',
    'useMemo',
    'useCallback',
    'useRef',
    'useContext',
    'useReducer',
    'useLayoutEffect',
    'useImperativeHandle',
    'useTransition',
    'useDeferredValue',
    'useId'
];

const ensureReactImports = (input) => {
    let code = typeof input === 'string' ? input : '';
    if (!code.trim()) return code;

    const usedHooks = REACT_HOOK_NAMES.filter((hook) => new RegExp(`\\b${hook}\\s*\\(`).test(code));
    if (usedHooks.length === 0) return code;

    const reactImportMatch = code.match(/^import\s+(.+?)\s+from\s+['"]react['"];?\s*$/m);
    if (!reactImportMatch) {
        const importStatement = `import React, { ${usedHooks.join(', ')} } from "react";`;
        const useClientMatch = code.match(/^(['"])use client\1;?\s*/);
        if (useClientMatch) {
            return `${useClientMatch[0]}${importStatement}\n${code.slice(useClientMatch[0].length)}`;
        }
        return `${importStatement}\n${code}`;
    }

    const existingClause = reactImportMatch[1].trim();
    const defaultImportMatch = existingClause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    const defaultImport = defaultImportMatch?.[1] || 'React';
    const namedImportsMatch = existingClause.match(/\{([^}]+)\}/);
    const existingNamedImports = namedImportsMatch
        ? namedImportsMatch[1].split(',').map((part) => part.trim()).filter(Boolean)
        : [];

    const mergedNamedImports = [...new Set([...existingNamedImports, ...usedHooks])].sort();
    const nextClause = mergedNamedImports.length > 0
        ? `${defaultImport}, { ${mergedNamedImports.join(', ')} }`
        : defaultImport;

    return code.replace(reactImportMatch[0], `import ${nextClause} from "react";\n`);
};

const fixClassContrast = (code) => {
    const input = typeof code === 'string' ? code : '';
    if (!input) return input;

    const darkBg = /\bbg-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightBg = /\bbg-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50)\b/;
    const darkText = /\btext-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightText = /\btext-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50|gray-100|slate-100)\b/;
    const paleTextOnLight = /\btext-(slate|gray|neutral|zinc|stone)-(200|300|400|500)\b/;

    const fixClassValue = (value) => {
        let v = value;
        const hasAnyTextClass = /\btext-[^\s]+\b/.test(v);
        if (darkBg.test(v) && !hasAnyTextClass) {
            v = `${v} text-slate-100`;
        }
        if (darkBg.test(v) && darkText.test(v)) {
            v = v.replace(/\btext-black\b/g, 'text-white');
            v = v.replace(/\btext-(slate|gray|neutral|zinc|stone)-9\d\d\b/g, 'text-slate-100');
        }
        if (lightBg.test(v) && !hasAnyTextClass) {
            v = `${v} text-slate-900`;
        }
        if (lightBg.test(v) && lightText.test(v)) {
            v = v.replace(/\btext-white\b/g, 'text-slate-900');
            v = v.replace(/\btext-(slate|gray|neutral|zinc|stone)-50\b/g, 'text-slate-900');
            v = v.replace(/\btext-(gray|slate)-100\b/g, 'text-slate-900');
        }
        if (lightBg.test(v) && paleTextOnLight.test(v)) {
            v = v.replace(/\btext-(slate|gray|neutral|zinc|stone)-200\b/g, 'text-slate-700');
            v = v.replace(/\btext-(slate|gray|neutral|zinc|stone)-300\b/g, 'text-slate-700');
            v = v.replace(/\btext-(slate|gray|neutral|zinc|stone)-400\b/g, 'text-slate-700');
            v = v.replace(/\btext-(slate|gray|neutral|zinc|stone)-500\b/g, 'text-slate-700');
        }
        return v;
    };

    const rewriteAttr = (attr) => new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, 'g');
    const rewriteAttrS = (attr) => new RegExp(`\\b${attr}\\s*=\\s*'([^']*)'`, 'g');

    return input
        .replace(rewriteAttr('className'), (m, v) => m.replace(v, fixClassValue(v)))
        .replace(rewriteAttrS('className'), (m, v) => m.replace(v, fixClassValue(v)))
        .replace(rewriteAttr('class'), (m, v) => m.replace(v, fixClassValue(v)))
        .replace(rewriteAttrS('class'), (m, v) => m.replace(v, fixClassValue(v)));
};

const repairMismatchedJsxTags = (input) => {
    const code = typeof input === 'string' ? input : '';
    const stack = [];
    const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

    return code.replace(/<\/?([A-Za-z][\w.:]*)\b[^>]*>/g, (tag) => {
        const isClosing = tag.startsWith('</');
        const match = tag.match(/^<\/?([A-Za-z][\w.:]*)/);
        const tagName = match?.[1];
        const isHtmlVoidTag = typeof tagName === 'string' && tagName === tagName.toLowerCase() && voidTags.has(tagName);
        const isSelfClosing = /\/>$/.test(tag) || isHtmlVoidTag;

        if (!tagName || isSelfClosing) return tag;

        if (!isClosing) {
            stack.push(tagName);
            return tag;
        }

        if (stack.length === 0) return '';
        const expected = stack.pop();
        if (!expected) return '';
        if (expected === tagName) return tag;
        return tag.replace(tagName, expected);
    });
};

const ensureLibraryImports = (input) => {
    let code = typeof input === 'string' ? input : '';
    const prependImport = (statement) => {
        if (code.includes(statement.trim())) return;
        const useClientMatch = code.match(/^(['"])use client\1;?\s*/);
        if (useClientMatch) {
            code = `${useClientMatch[0]}${statement}\n${code.slice(useClientMatch[0].length)}`;
            return;
        }
        code = `${statement}\n${code}`;
    };

    const framerSymbols = ['motion', 'AnimatePresence'];
    const usedFramerSymbols = framerSymbols.filter((symbol) => {
        if (symbol === 'motion') return /\bmotion\./.test(code);
        return new RegExp(`\\b${symbol}\\b|<${symbol}\\b`).test(code);
    });
    if (usedFramerSymbols.length > 0 && !/from\s+['"]framer-motion['"]/.test(code)) {
        prependImport(`import { ${usedFramerSymbols.join(', ')} } from 'framer-motion';`);
    }

    const routerSymbols = ['BrowserRouter', 'Routes', 'Route', 'Link', 'NavLink', 'Navigate', 'Outlet', 'useNavigate', 'useLocation', 'useParams', 'useSearchParams'];
    const usedRouterSymbols = routerSymbols.filter((symbol) => {
        if (symbol.startsWith('use')) return new RegExp(`\\b${symbol}\\b`).test(code);
        return new RegExp(`<${symbol}\\b|\\b${symbol}\\b`).test(code);
    });
    if (usedRouterSymbols.length > 0 && !/from\s+['"]react-router-dom['"]/.test(code)) {
        prependImport(`import { ${usedRouterSymbols.join(', ')} } from 'react-router-dom';`);
    }

    return code;
};

const sanitizeUnsupportedLibraries = (input) => {
    let code = typeof input === 'string' ? input : '';

    const prependBlock = (block) => {
        if (!block || code.includes(block.trim())) return;
        const useClientMatch = code.match(/^(['"])use client\1;?\s*/);
        if (useClientMatch) {
            code = `${useClientMatch[0]}${block}\n${code.slice(useClientMatch[0].length)}`;
            return;
        }
        code = `${block}\n${code}`;
    };

    if (/from\s+['"]react-intersection-observer['"]/.test(code)) {
        code = code.replace(/^\s*import\s+\{?\s*useInView\s*\}?\s+from\s+['"]react-intersection-observer['"];?\s*$/gm, '');
    }
    if (/\buseInView\s*\(/.test(code) && !/\bconst\s+useInView\b/.test(code)) {
        prependBlock(`const useInView = () => {
  const ref = () => {};
  const result = [ref, true];
  result.ref = ref;
  result.inView = true;
  result.entry = undefined;
  return result;
};`);
    }

    if (/from\s+['"]react-router-hash-link['"]/.test(code)) {
        code = code.replace(/^[ \t]*import[^\n]*from\s+['"]react-router-hash-link['"];?[ \t]*$/gm, '');
        code = code.replace(/\s+smooth(?=[\s>])/g, '');
        code = code.replace(/\s+scroll\s*=\s*\{[^}]*\}/g, '');
    }

    return code;
};

const injectSafetyStubs = (input) => {
    let code = typeof input === 'string' ? input : '';

    const prependBlock = (block) => {
        if (!block || code.includes(block.trim())) return;
        const useClientMatch = code.match(/^(['"])use client\1;?\s*/);
        if (useClientMatch) {
            code = `${useClientMatch[0]}${block}\n${code.slice(useClientMatch[0].length)}`;
            return;
        }
        code = `${block}\n${code}`;
    };

    if (/\bScrollTrigger\./.test(code) && !/\bconst\s+ScrollTrigger\b/.test(code)) {
        prependBlock(`const ScrollTrigger = { defaults: () => {}, create: () => {}, refresh: () => {}, killAll: () => {} };`);
    }
    if (/\bgsap\./.test(code) && !/\bconst\s+gsap\b/.test(code)) {
        prependBlock(`const gsap = { registerPlugin: () => {}, from: () => {}, to: () => {}, fromTo: () => {}, timeline: () => ({ from: () => {}, to: () => {}, fromTo: () => {} }) };`);
    }
    if (/from\s+['"]react-intersection-observer['"]/.test(code)) {
        code = code.replace(/^\s*import\s+\{?\s*useInView\s*\}?\s+from\s+['"]react-intersection-observer['"];?\s*$/gm, '');
    }
    if (/\buseInView\s*\(/.test(code) && !/\bconst\s+useInView\b/.test(code)) {
        prependBlock(`const useInView = () => {
  const ref = () => {};
  const result = [ref, true];
  result.ref = ref;
  result.inView = true;
  result.entry = undefined;
  return result;
};`);
    }

    const definedNames = new Set();
    const knownGlobals = new Set(['React', 'Fragment', 'Suspense', 'StrictMode', 'BrowserRouter', 'Routes', 'Route', 'Link', 'NavLink', 'Navigate', 'Outlet']);

    for (const match of code.matchAll(/import\s+([A-Z][A-Za-z0-9_$]*)\s+from\b/g)) {
        definedNames.add(match[1]);
    }
    for (const match of code.matchAll(/import\s+\{([^}]+)\}\s+from\b/g)) {
        const names = match[1].split(',').map((part) => part.trim().split(/\s+as\s+/i).pop()).filter(Boolean);
        names.forEach((name) => definedNames.add(name));
    }
    for (const match of code.matchAll(/\b(?:const|function|class)\s+([A-Z][A-Za-z0-9_$]*)\b/g)) {
        definedNames.add(match[1]);
    }

    const usedComponentNames = new Set();
    for (const match of code.matchAll(/<([A-Z][A-Za-z0-9_$]*)\b/g)) {
        usedComponentNames.add(match[1]);
    }

    const isImportedSomewhere = (name) => {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`import[\\s\\S]{0,240}\\b${escaped}\\b[\\s\\S]{0,240}from\\s+['"]`, 'm').test(code);
    };

    const unresolved = [...usedComponentNames].filter((name) => (
        !definedNames.has(name) &&
        !knownGlobals.has(name) &&
        !isImportedSomewhere(name)
    ));
    if (unresolved.length > 0) {
        const stubBlock = unresolved.map((name) => buildVisibleComponentStub(name)).join('\n\n');
        prependBlock(stubBlock);
    }

    return code;
};

const normalizeRelativeComponentImports = (input) => {
    let code = typeof input === 'string' ? input : '';
    code = code.replace(
        /^\s*import\s+\{\s*([A-Z][A-Za-z0-9_$]*)\s*\}\s+from\s+(['"])(\.[^'"]+)\2\s*;?\s*$/gm,
        'import $1 from $2$3$2;'
    );
    return code;
};

const cssPropertyToJsxKey = (property) => {
    const trimmed = String(property || '').trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('--')) return JSON.stringify(trimmed);
    return trimmed.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

const cssTextToJsxStyleObject = (styleText) => {
    const entries = String(styleText || '')
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const colonIndex = part.indexOf(':');
            if (colonIndex === -1) return null;
            const key = cssPropertyToJsxKey(part.slice(0, colonIndex));
            const value = part.slice(colonIndex + 1).trim().replace(/\s*!important\s*$/i, '');
            if (!key || !value) return null;
            return `${key}: ${JSON.stringify(value)}`;
        })
        .filter(Boolean);
    return entries.length > 0 ? `{ ${entries.join(', ')} }` : '{}';
};

const fixStringStyleProps = (input) => {
    let code = typeof input === 'string' ? input : '';
    return code.replace(/\bstyle\s*=\s*(["'])([^"'\n{}]*)\1/g, (_, quote, styleText) => {
        const styleObject = cssTextToJsxStyleObject(styleText);
        return `style={${styleObject}}`;
    });
};

const hardenFooterSource = (path, input) => {
    const filePath = typeof path === 'string' ? path : '';
    let code = typeof input === 'string' ? input : '';
    if (!/\/Footer\.(jsx|tsx|js|ts)$/i.test(filePath)) {
        return code;
    }

    code = code.replace(
        /^\s*import\s+\{\s*([^}]+)\}\s+from\s+['"]react-router-dom['"]\s*;?\s*$/gm,
        (_, imports) => {
            const kept = String(imports)
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .filter((name) => name !== 'Link');
            return kept.length > 0 ? `import { ${kept.join(', ')} } from "react-router-dom";` : '';
        }
    );
    code = code.replace(/<Link\b/g, '<a');
    code = code.replace(/\bto=/g, 'href=');
    code = code.replace(/<\/Link>/g, '</a>');
    code = code.replace(/^\s*import\s+.*\s+from\s+['"](@heroicons\/[^'"]+|react-icons\/[^'"]+|lucide-react)['"];?\s*$/gm, '');
    const footerIconFallback = '<span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 rounded-full bg-current opacity-70" />';
    code = code.replace(/<([A-Z][A-Za-z0-9_$]*)\b[^>]*\/>/g, (match, name) => {
        if (name === 'Footer') return match;
        return footerIconFallback;
    });
    code = code.replace(/<([A-Z][A-Za-z0-9_$]*)\b[^>]*>\s*<\/\1>/g, (match, name) => {
        if (name === 'Footer') return match;
        return footerIconFallback;
    });
    return code;
};

const DEFAULT_APP_MARKERS = [
    'Your AI website is ready',
    'Welcome to Your AI Website',
    'Your generated code will appear here.'
];

const isPlaceholderAppCode = (code) => {
    const input = typeof code === 'string' ? code : '';
    return DEFAULT_APP_MARKERS.some((marker) => input.includes(marker));
};

const pickPrimaryGeneratedPage = (files) => {
    const paths = Object.keys(files || {}).filter((path) => /^\/pages\/.+\.(jsx|tsx|js|ts)$/i.test(path));
    const preferred = ['/pages/HomePage.jsx', '/pages/Home.jsx', '/pages/LandingPage.jsx', '/pages/Index.jsx'];
    for (const path of preferred) {
        if (paths.includes(path)) return path;
    }
    return paths[0] || '';
};

const buildAppShellFromPage = (pagePath, options = {}) => {
    if (!pagePath) return '';
    const includeNavbar = options.includeNavbar !== false;
    const includeFooter = options.includeFooter !== false;
    const importPath = pagePath.replace(/^\//, './');
    return `import React from "react";
${includeNavbar ? 'import Navbar from "./components/Navbar.jsx";\n' : ''}${includeFooter ? 'import Footer from "./components/Footer.jsx";\n' : ''}import GeneratedPage from "${importPath}";

export default function App() {
  return (
    <>
      ${includeNavbar ? '<Navbar />' : ''}
      <GeneratedPage />
      ${includeFooter ? '<Footer />' : ''}
    </>
  );
}`;
};

const fixUnsafeSandboxCode = (input) => {
    let code = typeof input === 'string' ? input : '';
    code = code.replace(/\r\n/g, '\n');
    code = ensureReactImports(code);
    code = normalizeRelativeComponentImports(code);
    code = fixStringStyleProps(code);
    code = sanitizeUnsupportedLibraries(code);
    code = repairMismatchedJsxTags(code);
    
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

    // Fix invalid JSX attribute paths (Route/Link)
    code = code.replace(/\b(path|to|href|src|action|poster)\s*=\s*\{\s*(null|undefined)\s*\}/g, '$1="/"');
    code = code.replace(/\b(path|to|href|src|action|poster)\s*=\s*\{\s*['"]\s*['"]\s*\}/g, '$1="/"');
    code = code.replace(/\b(path|to|href|src|action|poster)\s*=\s*['"](null|undefined|)['"]/g, '$1="/"');

    // Remove broken closing tags like "</n" before a valid closing tag
    code = code.replace(/<\/n\s*(?=\n\s*<\/)/g, '');
    code = code.replace(/<\/n\s*>/g, '');
    // Even broader, but safe: keep only real tags like </nav> and </noscript>
    code = code.replace(/<\/n(?!av\b|oscript\b)/gi, '');

    // Fix common JSX corruption where a block closing tag is accidentally appended inside a <p> text node.
    // Example: <p>... </motion.div>  => <p>...</p>\n</motion.div>
    code = code.replace(/(<p\b[^>]*>[^<]*)(\s*)(<\/(?!p\b)[^>]+>)/g, '$1</p>\n$2$3');

    // Fix new URL(null/undefined, ...) usage
    code = code.replace(/new URL\(\s*(null|undefined)\s*,/g, 'new URL(".",');

    code = repairMismatchedJsxTags(code);
    code = ensureLibraryImports(code);

    code = fixClassContrast(code);

    return code;
};

const getJsxParseIssues = (path, input) => {
        const code = typeof input === 'string' ? input : '';
        if (!isValidSandboxPath(path) || !code.trim()) return [];

        const normalizedPath = toSandboxPath(path);
        if (!/\.(jsx|tsx|js|ts)$/i.test(normalizedPath)) return [];

        const plugins = ['jsx', 'topLevelAwait', 'importMeta'];
        if (/\.(ts|tsx)$/i.test(normalizedPath)) {
                plugins.push('typescript');
        }

        try {
                parseBabel(code, {
                        sourceType: 'module',
                        plugins,
                });
                return [];
        } catch (error) {
                const message = String(error?.message || error || 'Unknown syntax error').split('\n')[0];
                return [`${normalizedPath}: ${message}`];
        }
};

const buildSafeReactFallback = (path) => {
        const normalizedPath = toSandboxPath(path);
        const defaultCode = toSandboxCode(Lookup?.DEFAULT_FILE?.[normalizedPath]);
        if (defaultCode.trim()) {
                return fixUnsafeSandboxCode(defaultCode);
        }

        const baseName = normalizedPath.split('/').pop() || 'FallbackComponent';
        const componentName = baseName.replace(/\.(jsx|tsx|js|ts)$/i, '').replace(/[^A-Za-z0-9_$]/g, '') || 'FallbackComponent';

        return `import React from "react";

export default function ${componentName}() {
    return (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border bg-card px-6 py-10 text-center text-card-foreground shadow-xl">
            <div className="max-w-md">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-primary">Recovered Preview</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">${componentName}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    This file was replaced with a safe fallback because the generated JSX failed validation.
                </p>
            </div>
        </div>
    );
}`;
};

    const resolveSandboxRelativePath = (fromPath, importPath) => {
        const fromSegments = toSandboxPath(fromPath).split('/').filter(Boolean);
        if (fromSegments.length > 0) {
            fromSegments.pop();
        }

        const rawSegments = String(importPath || '').split('/').filter(Boolean);
        const resolvedSegments = [...fromSegments];

        rawSegments.forEach((segment) => {
            if (segment === '.') return;
            if (segment === '..') {
                resolvedSegments.pop();
                return;
            }
            resolvedSegments.push(segment);
        });

        if (resolvedSegments.length === 0) {
            return '/';
        }

        return `/${resolvedSegments.join('/')}`.replace(/\/+/g, '/');
    };

    const buildSafeLocalStub = (path) => {
        const normalizedPath = toSandboxPath(path);
        if (/\.css$/i.test(normalizedPath)) {
            return `:root { color-scheme: light dark; }
    html, body, #root { min-height: 100%; }
    body { margin: 0; }
    `;
        }

        return buildSafeReactFallback(normalizedPath);
    };

const buildVisibleComponentStub = (componentName) => {
        const safeName = String(componentName || 'RecoveredComponent').replace(/[^A-Za-z0-9_$]/g, '') || 'RecoveredComponent';
        return `const ${safeName} = () => (
    <div className="flex min-h-[160px] items-center justify-center rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center text-card-foreground">
        <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-primary">Recovered Component</p>
            <p className="mt-2 text-sm font-semibold">${safeName} rendered a safe fallback because the generated module was incomplete.</p>
        </div>
    </div>
);`;
};

    const ensureLocalImportTargets = (fileMap) => {
        const next = { ...(fileMap || {}) };
        const existingPaths = new Set(Object.keys(next).map((path) => toSandboxPath(path)));
        const createdPaths = new Set();

        const addStub = (candidatePath) => {
            const normalized = toSandboxPath(candidatePath);
            if (!isValidSandboxPath(normalized) || existingPaths.has(normalized) || createdPaths.has(normalized)) return;
            next[normalized] = { code: buildSafeLocalStub(normalized) };
            createdPaths.add(normalized);
            existingPaths.add(normalized);
        };

        Object.entries(next).forEach(([path, content]) => {
            const code = toSandboxCode(content);
            if (!code.trim()) return;

            for (const match of code.matchAll(/import\s+[\s\S]*?from\s+['"](\.[^'"]+)['"]/g)) {
                const importPath = match[1];
                const resolvedPath = resolveSandboxRelativePath(path, importPath);
                const hasExtension = /\.[A-Za-z0-9]+$/i.test(resolvedPath);

                const candidates = hasExtension
                    ? [resolvedPath]
                    : [
                        `${resolvedPath}.jsx`,
                        `${resolvedPath}.js`,
                        `${resolvedPath}.tsx`,
                        `${resolvedPath}.ts`,
                        `${resolvedPath}.css`,
                        `${resolvedPath}/index.jsx`,
                        `${resolvedPath}/index.js`,
                        `${resolvedPath}/index.tsx`,
                        `${resolvedPath}/index.ts`
                    ];

                const existing = candidates.find((candidate) => existingPaths.has(toSandboxPath(candidate)));
                if (existing) continue;

                addStub(candidates[0]);
            }
        });

        return next;
    };

const ensureImportedLocalComponentDefaults = (fileMap) => {
    const next = { ...(fileMap || {}) };
    const existingPaths = new Set(Object.keys(next).map((path) => toSandboxPath(path)));

    const resolveTargetPath = (fromPath, importPath) => {
        const fromSegments = toSandboxPath(fromPath).split('/').filter(Boolean);
        if (fromSegments.length > 0) fromSegments.pop();

        const rawSegments = String(importPath || '').split('/').filter(Boolean);
        const resolvedSegments = [...fromSegments];
        rawSegments.forEach((segment) => {
            if (segment === '.') return;
            if (segment === '..') {
                resolvedSegments.pop();
                return;
            }
            resolvedSegments.push(segment);
        });

        const basePath = `/${resolvedSegments.join('/')}`.replace(/\/+/g, '/');
        const candidates = /\.[A-Za-z0-9]+$/i.test(basePath)
            ? [basePath]
            : [
                `${basePath}.jsx`,
                `${basePath}.js`,
                `${basePath}.tsx`,
                `${basePath}.ts`,
                `${basePath}/index.jsx`,
                `${basePath}/index.js`,
                `${basePath}/index.tsx`,
                `${basePath}/index.ts`
            ];
        return candidates.find((candidate) => existingPaths.has(toSandboxPath(candidate))) || candidates[0];
    };

    const ensureDefaultExportForCode = (path, code) => {
        const componentPathLike = /(?:^|\/)(components|pages|sections|features|home|custom)\//i.test(path) || /[A-Z][A-Za-z0-9_$]*\.(jsx|tsx|js|ts)$/i.test(path);
        if (!componentPathLike) return code;
        if (/\bexport\s+default\b/.test(code)) return code;

        const baseName = path.split('/').pop() || 'RecoveredComponent';
        const componentName = baseName.replace(/\.(jsx|tsx|js|ts)$/i, '').replace(/[^A-Za-z0-9_$]/g, '') || 'RecoveredComponent';

        if (new RegExp(`\b(function|const|class|let|var)\s+${componentName}\b`).test(code)) {
            return `${code}\n\nexport default ${componentName};`;
        }

        const anyComponentMatch = code.match(/\b(function|const|class|let|var)\s+([A-Z][A-Za-z0-9_$]*)\b/);
        if (anyComponentMatch) {
            return `${code}\n\nexport default ${anyComponentMatch[2]};`;
        }

        const fallback = buildVisibleComponentStub(componentName);
        return `import React from "react";\n\n${fallback}\n\nexport default ${componentName};`;
    };

    Object.entries(next).forEach(([path, content]) => {
        const code = toSandboxCode(content);
        if (!code.trim()) return;

        for (const match of code.matchAll(/import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/g)) {
            const importClause = match[1] || '';
            const importPath = match[2];
            const targetPath = resolveTargetPath(path, importPath);
            const targetCode = toSandboxCode(next[targetPath]);
            if (!targetCode.trim()) continue;

            const hasCapitalizedImport = /\b[A-Z][A-Za-z0-9_$]*\b/.test(importClause);
            const isComponentLikeTarget = /(?:^|\/)(components|pages|sections|features|home|custom)\//i.test(targetPath) || /[A-Z][A-Za-z0-9_$]*\.(jsx|tsx|js|ts)$/i.test(targetPath);
            if (!hasCapitalizedImport || !isComponentLikeTarget) continue;

            next[targetPath] = { code: ensureDefaultExportForCode(targetPath, targetCode) };
        }
    });

    return next;
};

const sanitizePreviewFiles = (inputFiles) => {
        const next = {};
        const parseIssues = [];

        Object.entries(inputFiles || {}).forEach(([path, content]) => {
                if (!isValidSandboxPath(path)) return;
                const cleanPath = toSandboxPath(path);
                const code = fixUnsafeSandboxCode(toSandboxCode(content));
                const issues = getJsxParseIssues(cleanPath, code);
                if (issues.length > 0) {
                        parseIssues.push(...issues);
                        next[cleanPath] = { code: buildSafeReactFallback(cleanPath) };
                        return;
                }
                next[cleanPath] = { code };
        });

        return {
                files: ensureLocalImportTargets(next),
                issues: parseIssues,
        };
};

const SANDBOX_EXTERNAL_RESOURCES = [
    // Prefer a CSS fallback (prebuilt) so preview still styles even if Play CDN JS is blocked
    'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
    'https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css',
    // Keep Play CDN as a secondary option
    'https://cdn.tailwindcss.com'
];
const SAFE_FOOTER_CODE = `import React from "react";

const footerLinks = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" }
];

const Footer = () => {
  return (
    <footer className="mt-16 border-t border-white/10 bg-slate-950 text-slate-200">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-10 md:flex-row md:items-start md:justify-between">
        <div className="max-w-md">
          <p className="text-xs font-black uppercase tracking-[0.35em] text-amber-400">Built With Elisa</p>
          <h2 className="mt-3 text-2xl font-black tracking-tight text-white">Modern websites without the chaos.</h2>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Clean, responsive, production-ready experiences generated for fast iteration and stable previewing.
          </p>
        </div>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Navigation</p>
          <div className="mt-4 flex flex-col gap-3 text-sm">
            {footerLinks.map((item) => (
              <a key={item.label} href={item.href} className="text-slate-300 transition-colors duration-200 hover:text-white">
                {item.label}
              </a>
            ))}
          </div>
        </div>
      </div>
      <div className="border-t border-white/10 px-6 py-4 text-xs text-slate-500">
        &copy; {new Date().getFullYear()} Elisa AI. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
`;
const PREVIEW_ALLOWED_DEPENDENCIES = {
    react: '^19.2.4',
    'react-dom': '^19.2.4',
    'framer-motion': 'latest',
    'lucide-react': 'latest',
    'react-router-dom': 'latest',
    axios: 'latest',
    clsx: 'latest',
    'tailwind-merge': 'latest',
    'tailwindcss-animate': 'latest'
};
const PREVIEW_DEPENDENCY_ALIASES = {
    clx: 'clsx'
};

const STYLE_PRESETS = [
    {
        name: "Neo Brutalist Citrus",
        palette: "charcoal #0f172a, citrus #f59e0b, mint #34d399, cream #fff7ed",
        fonts: "Space Grotesk for headings, Manrope for body",
        hero: "Split hero with bold left text and a large rectangular media panel with clean angled edges",
        background: "Layered gradients with subtle grain texture",
        accents: "Thick borders, pill buttons, high-contrast CTA"
    },
    {
        name: "Modern Editorial",
        palette: "ink #0b0f19, pearl #f8fafc, rose #fb7185, gold #fbbf24",
        fonts: "Playfair Display for headings, Source Sans 3 for body",
        hero: "Asymmetric hero with stacked text and a tall editorial image block with generous whitespace",
        background: "Soft paper texture with oversized typography accents",
        accents: "Underline links, thin rules, editorial cards"
    },
    {
        name: "Coastal Tech",
        palette: "navy #0b1f3a, teal #14b8a6, sky #38bdf8, sand #fde68a",
        fonts: "Outfit for headings, Plus Jakarta Sans for body",
        hero: "Wide hero with panoramic image and floating stat cards",
        background: "Wave-like gradients with glass panels",
        accents: "Rounded buttons, subtle glow highlights"
    },
    {
        name: "Retro Future",
        palette: "black #0a0a0a, electric #7c3aed, neon #22d3ee, lime #a3e635",
        fonts: "Sora for headings, Space Mono for labels",
        hero: "Centered hero with a cinematic wide media banner below the headline and clean neon edge accents",
        background: "Grid pattern with glowing gradients",
        accents: "Neon borders, hover glows, animated pills"
    },
    {
        name: "Warm Minimal",
        palette: "espresso #1f1b16, terracotta #f97316, clay #fed7aa, olive #84a98c",
        fonts: "DM Serif Display for headings, Work Sans for body",
        hero: "Two-column hero with clean image and stacked CTA buttons",
        background: "Soft radial gradients with warm tint",
        accents: "Subtle shadows, rounded corners, calm spacing"
    }
];

const pickStylePreset = () => STYLE_PRESETS[Math.floor(Math.random() * STYLE_PRESETS.length)];

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
    const generationInFlightRef = useRef(false);
    const skipInitialGenerateRef = useRef(false);
    const hasPersistedFilesRef = useRef(false);
    const [filesLoaded, setFilesLoaded] = useState(false);
    const lastProcessedIndexRef = useRef(-1);
    const lastSyncedFilesHashRef = useRef('');
    const lastObservedSandpackHashRef = useRef('');
    const lastKnownFilesHashRef = useRef('');

    useEffect(() => {
        // Reset per-workspace refs when switching IDs
        lastProcessedIndexRef.current = -1;
        skipInitialGenerateRef.current = false;
        hasPersistedFilesRef.current = false;
        lastSyncedFilesHashRef.current = '';
        lastObservedSandpackHashRef.current = '';
        lastKnownFilesHashRef.current = '';
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

                const currentHash = stableFilesHash(processedCurrent);
                const stateHash = lastKnownFilesHashRef.current;
                if (!currentHash || currentHash === lastObservedSandpackHashRef.current) return;
                lastObservedSandpackHashRef.current = currentHash;

                if (currentHash !== stateHash && currentHash !== lastSyncedFilesHashRef.current) {
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
                        lastSyncedFilesHashRef.current = currentHash;
                    }
                    // Also send a one-time postMessage to the embedded workspace preview iframe
                    // so the workspace preview picks up the change immediately (no DB roundtrip).
                    try {
                        const iframe = previewWrapperRef.current?.querySelector?.('iframe');
                        if (iframe?.contentWindow) {
                            iframe.contentWindow.postMessage({ type: 'ELISA_SYNC_FILES', files: processedCurrent }, '*');
                        }
                    } catch (e) {
                        // ignore
                    }
                }
            }, 2000);

            return () => {
                if (debounceTimerRef.current) {
                    clearTimeout(debounceTimerRef.current);
                }
            };
        }, [currentSandpackFiles, id, UpdateFiles, loading, userId, preprocessFiles]);

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
            if (SYNC_EXCLUDED_FILES.has(cleanPath)) return;
            
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

            const rawCode = toSandboxCode(content);
            if (!rawCode || typeof rawCode !== 'string' || rawCode.length < 5) return; // Skip empty/broken files

            const code = hardenFooterSource(cleanPath, fixUnsafeSandboxCode(rawCode));
            processed[cleanPath] = { code };
        });
        return processed;
    }, []);

    useEffect(() => {
        lastKnownFilesHashRef.current = stableFilesHash(preprocessFiles(files));
    }, [files, preprocessFiles]);

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
            next[path] = { code: hardenFooterSource(path, fixUnsafeSandboxCode(toSandboxCode(content))) };
        };
        const ensurePackageJson = () => {
            const fallbackPackage = {
                name: 'generated-project',
                private: true,
                version: '1.0.0',
                type: 'module',
                scripts: {
                    dev: 'vite',
                    build: 'vite build',
                    preview: 'vite preview'
                },
                dependencies: PREVIEW_ALLOWED_DEPENDENCIES,
                devDependencies: {
                    vite: 'latest',
                    '@vitejs/plugin-react': 'latest'
                }
            };

            if (!hasFile('/package.json')) {
                setFile('/package.json', JSON.stringify(fallbackPackage, null, 2));
                return;
            }

            try {
                const parsed = JSON.parse(toSandboxCode(next['/package.json']) || '{}');
                const rawDependencies = parsed?.dependencies && typeof parsed.dependencies === 'object'
                    ? parsed.dependencies
                    : {};
                const sanitizedDependencies = {};

                Object.entries(rawDependencies).forEach(([name, version]) => {
                    const normalizedName = PREVIEW_DEPENDENCY_ALIASES[name] || name;
                    if (!Object.prototype.hasOwnProperty.call(PREVIEW_ALLOWED_DEPENDENCIES, normalizedName)) {
                        return;
                    }
                    sanitizedDependencies[normalizedName] = version;
                });

                const normalized = {
                    ...parsed,
                    private: true,
                    version: parsed?.version || '1.0.0',
                    type: parsed?.type || 'module',
                    scripts: {
                        dev: 'vite',
                        build: 'vite build',
                        preview: 'vite preview',
                        ...(parsed?.scripts || {})
                    },
                    dependencies: {
                        ...fallbackPackage.dependencies,
                        ...sanitizedDependencies
                    },
                    devDependencies: {
                        ...fallbackPackage.devDependencies
                    }
                };
                setFile('/package.json', JSON.stringify(normalized, null, 2));
            } catch (e) {
                setFile('/package.json', JSON.stringify(fallbackPackage, null, 2));
            }
        };
        const ensureDefaultExport = (path, componentName, fallbackCode) => {
            if (!hasFile(path)) {
                setFile(path, fallbackCode);
                return;
            }

            let code = toSandboxCode(next[path]) || '';
            
            // 🔴 FIX: If there's already ANY default export, DO NOT ADD ANOTHER ONE!
            if (/\bexport\s+default\b/.test(code)) {
                setFile(path, code);
                return;
            }

            // Remove incorrect curly imports of the same component
            code = code.replace(new RegExp(`import\\s+\\{\\s*${componentName}\\s*\\}\\s+from\\s+['"][^'"]+['"];?`, 'g'), '');

            const hasDeclaration = new RegExp(`\\b(function|const|class|let|var)\\s+${componentName}\\b`).test(code);
            if (hasDeclaration) {
                code = `${code}\n\nexport default ${componentName};`;
                setFile(path, code);
                return;
            }

            // If the file has substantial JSX content (AI-generated component),
            // just wrap it in a default export instead of appending fallback code.
            const trimmedCode = code.trim();
            if (trimmedCode.length > 30 && (trimmedCode.includes('<') || trimmedCode.includes('return'))) {
                // Try to find any function/arrow component and export it
                const anyFuncMatch = trimmedCode.match(/(?:const|function|let|var)\s+([A-Z]\w+)/);
                if (anyFuncMatch) {
                    code = `${code}\n\nexport default ${anyFuncMatch[1]};`;
                    setFile(path, code);
                    return;
                }
                // Last resort: wrap the entire code as a default export component
                code = `import React from 'react';\n\nconst ${componentName} = () => {\n  return (\n    ${trimmedCode.startsWith('<') ? trimmedCode : `<>${trimmedCode}</>`}\n  );\n};\n\nexport default ${componentName};`;
                setFile(path, code);
                return;
            }

            // Only use fallback for truly empty or broken files
            setFile(path, fallbackCode);
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

        const currentAppCode = hasFile('/App.jsx') ? toSandboxCode(next['/App.jsx']) || '' : '';
        if ((!hasFile('/App.jsx') || isPlaceholderAppCode(currentAppCode)) && Object.keys(next).some((path) => path.startsWith('/pages/'))) {
            const primaryPage = pickPrimaryGeneratedPage(next);
            if (primaryPage) {
                setFile('/App.jsx', buildAppShellFromPage(primaryPage, {
                    includeNavbar: hasFile('/components/Navbar.jsx'),
                    includeFooter: hasFile('/components/Footer.jsx')
                }));
            }
        }

        ensureDefaultExport(
            '/components/Footer.jsx',
            'Footer',
            `const Footer = () => (
  <footer className="bg-gray-100 p-8 text-center text-gray-600 border-t mt-12">
    &copy; ${new Date().getFullYear()} Project. All rights reserved.
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

        // Ensure Navbar/Footer exist AND are rendered in App.jsx (models sometimes forget to mount them)
        const ensureNavbarFooterInApp = () => {
            if (!hasFile('/App.jsx')) return;
            if (!hasFile('/components/Navbar.jsx') || !hasFile('/components/Footer.jsx')) return;

            let out = toSandboxCode(next['/App.jsx']) || '';
            if (!out.trim() || out.length < 20) return;

            const needsNavbar = !out.includes('<Navbar');
            const needsFooter = !out.includes('<Footer');
            if (!needsNavbar && !needsFooter) return;

            const ensureImport = (name) => {
                if (new RegExp(`\\bimport\\s+${name}\\b`).test(out)) return;
                const stmt = `import ${name} from "./components/${name}.jsx";\n`;
                if (/^import\s.+/m.test(out)) {
                    out = out.replace(/^(?:import[^\n]*\n)+/m, (m) => m + stmt);
                } else {
                    out = stmt + out;
                }
            };

            if (needsNavbar) ensureImport('Navbar');
            if (needsFooter) ensureImport('Footer');
            out = out.replace(/import\s+\{\s*Navbar\s*\}\s+from\s+(['"][^'"]+['"]);?/g, 'import Navbar from $1;');
            out = out.replace(/import\s+\{\s*Footer\s*\}\s+from\s+(['"][^'"]+['"]);?/g, 'import Footer from $1;');

            // Preferred: if BrowserRouter exists, mount inside it so Links work.
            if (out.includes('<BrowserRouter')) {
                if (needsNavbar) {
                    out = out.replace(/(<BrowserRouter[^>]*>)/m, `$1\n      <Navbar />`);
                }
                if (needsFooter) {
                    out = out.replace(/(<\/BrowserRouter>)/m, `      <Footer />\n    $1`);
                }
                setFile('/App.jsx', out);
                return;
            }

            // Fallback: wrap returned JSX in a fragment and add Navbar/Footer around it.
            const returnMatch = /return\s*\(\s*(<[\s\S]*>)\s*\)/m.exec(out) || /return\s*(<[\s\S]*>);/m.exec(out);
            if (returnMatch) {
                const fullReturn = returnMatch[0];
                const innerContent = returnMatch[1];
                
                let updatedInner = innerContent;
                if (needsNavbar && !updatedInner.includes('<Navbar')) {
                    updatedInner = `<>\n      <Navbar />\n      ${updatedInner}\n    </>`;
                }
                if (needsFooter && !updatedInner.includes('<Footer')) {
                    // If we already added a fragment for Navbar, just append Footer inside it
                    if (updatedInner.startsWith('<>')) {
                        updatedInner = updatedInner.replace(/<\/>$/, `  <Footer />\n    </>`);
                    } else {
                        updatedInner = `<>\n      ${updatedInner}\n      <Footer />\n    </>`;
                    }
                }
                
                out = out.replace(fullReturn, `return (\n    ${updatedInner}\n  );`);
                setFile('/App.jsx', out);
            }
        };

        ensureNavbarFooterInApp();

        // FIX BROWSER ROUTER COMPLETELY - NO MORE "router inside router" ERROR!
        const ensureBrowserRouter = () => {
            // STEP 1: REMOVE BrowserRouter FROM EVERY FILE EXCEPT index.jsx
            Object.keys(next).forEach((path) => {
                if (path === '/index.jsx' || path === '/index.tsx' || path === '/index.js') return;
                
                let code = toSandboxCode(next[path]) || '';
                if (code.includes('BrowserRouter')) {
                    // Remove BrowserRouter tags and import
                    code = code.replace(/<BrowserRouter[^>]*>/g, '');
                    code = code.replace(/<\/BrowserRouter>/g, '');
                    // Remove BrowserRouter import
                    code = code.replace(/^\s*import\s*(?:\{[^}]*BrowserRouter[^}]*\}|BrowserRouter)\s*from\s+['"]react-router-dom['"];?\s*\n?/gm, (match) => {
                        // If import has other things besides BrowserRouter, keep them
                        if (match.includes('{') && match.includes(',')) {
                            const cleaned = match.replace(/BrowserRouter\s*,?\s*/g, '').replace(/,\s*\}/g, '}');
                            if (cleaned.includes('{') && !cleaned.includes('{}')) {
                                return cleaned;
                            }
                        }
                        return '';
                    });
                    setFile(path, code);
                }
            });

            // STEP 2: Check if we actually need routing
            const routerPatterns = ['<Link', '<NavLink', '<Route', '<Routes', 'useNavigate', 'useLocation', 'useParams', 'useSearchParams', '<Navigate'];
            let usesRouter = false;
            Object.entries(next).forEach(([path, content]) => {
                if (path === '/index.jsx' || path === '/index.tsx' || path === '/index.js') return;
                const code = toSandboxCode(content) || '';
                if (routerPatterns.some(p => code.includes(p))) {
                    usesRouter = true;
                }
            });

            if (!usesRouter) return;

            // STEP 3: Ensure ONLY index.jsx has BrowserRouter (if needed)
            const indexPath = hasFile('/index.jsx') ? '/index.jsx' : 
                              hasFile('/index.tsx') ? '/index.tsx' : 
                              hasFile('/index.js') ? '/index.js' : '';
            
            if (!indexPath) return;

            let indexCode = toSandboxCode(next[indexPath]) || '';
            
            // If already has BrowserRouter, make sure it's correctly formatted
            if (indexCode.includes('BrowserRouter')) {
                // Just clean it up and ensure it's wrapping <App /> properly
                return;
            }

            // Add BrowserRouter import if needed
            if (!indexCode.includes('react-router-dom')) {
                const importLine = `import { BrowserRouter } from 'react-router-dom';\n`;
                const lastImport = indexCode.lastIndexOf('import ');
                if (lastImport !== -1) {
                    const endOfLine = indexCode.indexOf('\n', lastImport);
                    if (endOfLine !== -1) {
                        indexCode = indexCode.slice(0, endOfLine + 1) + importLine + indexCode.slice(endOfLine + 1);
                    } else {
                        indexCode = indexCode + '\n' + importLine;
                    }
                } else {
                    indexCode = importLine + indexCode;
                }
            }

            // Wrap <App /> in BrowserRouter - this is the ONLY place BrowserRouter should ever be!
            if (!indexCode.includes('<BrowserRouter')) {
                indexCode = indexCode.replace(/(\s*)<App\s*\/>/m, '$1<BrowserRouter>\n$1  <App />\n$1</BrowserRouter>');
            }

            setFile(indexPath, indexCode);
        };

        ensureBrowserRouter();
        
        // Final sanity check for entry points
        if (!hasFile('/index.html')) {
            setFile('/index.html', Lookup.DEFAULT_FILE['/index.html'].code);
        }
        if (!hasFile('/styles.css')) {
            setFile('/styles.css', `:root { color-scheme: light dark; }\nhtml, body { height: 100%; }\nbody { margin: 0; background: #0b1220; color: #e5e7eb; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }\n`);
        }
        ensurePackageJson();

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
            const processedFiles = preprocessFiles(result?.fileData || {});
            const defaultFiles = preprocessFiles(Lookup.DEFAULT_FILE);
            const mergedFiles = { ...defaultFiles, ...processedFiles };
            const normalizedFiles = normalizeGeneratedFiles(mergedFiles);
            const persistedFiles = result?.fileData && Object.keys(result.fileData).length > 0;
            const persistedAppCode = toSandboxCode(processedFiles['/App.jsx'] || processedFiles['/App.js'] || normalizedFiles['/App.jsx'] || '');
            const hasMeaningfulPersistedFiles = Boolean(persistedFiles) && !isPlaceholderAppCode(persistedAppCode);
            hasPersistedFilesRef.current = hasMeaningfulPersistedFiles;
            if (hasMeaningfulPersistedFiles) {
                skipInitialGenerateRef.current = true;
            }
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
        if (loading || generationInFlightRef.current || !id || !userId) return;
        generationInFlightRef.current = true;
        setLoading(true);
        
        // Count user messages to determine if this is an update
        const userMessages = messages.filter(m => m.role === 'user');
        const userMessagesCount = userMessages.length;
        const isUpdate = userMessagesCount > 1;

        // Detect if the latest message is an error report
        const latestUserMsg = userMessages[userMessagesCount - 1];
        const errorKeywords = ['error', 'fail', 'crash', 'not working', 'issue', 'bug', 'exception', 'stack trace', 'cannot find', 'is not defined'];
        const isErrorReport = latestUserMsg && errorKeywords.some(word => 
            latestUserMsg.content.toLowerCase().includes(word) || 
            (latestUserMsg.technicalContent && latestUserMsg.technicalContent.toLowerCase().includes(word))
        );

        // Clean messages to avoid sending redundant huge code blocks
        const cleanMessages = messages
              .filter(msg => msg.role !== 'command')
              .map((msg, idx) => {
                  const contentToUse = msg.technicalContent || msg.content;
                  if (msg.role === 'ai') {
                    try {
                        const parsed = JSON.parse(msg.content);
                        return {
                            role: 'ai',
                            content: parsed.explanation || "Updated the project based on your request."
                        };
                    } catch (e) {
                        return {
                            role: 'ai',
                            content: typeof msg.content === 'string' ? msg.content.substring(0, 500) : "AI response"
                        };
                    }
                }
                  
                  // For the very first user message, keep it full as it's the core requirement
                  // For subsequent messages, if they are not the latest, truncate them if they are too long
                  const isLatest = idx === messages.length - 1;
                  const isFirstUser = messages.findIndex(m => m.role === 'user') === idx;
                  
                  let finalContent = contentToUse;
                  if (!isLatest && !isFirstUser && finalContent.length > 2000) {
                      finalContent = finalContent.substring(0, 2000) + "... [truncated context]";
                  }

                  if (msg.role === 'user' && msg.selectedElement) {
                      const targetHint = formatSelectedElement(msg.selectedElement);
                      return {
                          role: msg.role,
                          content: [
                              `TARGET ELEMENT: ${targetHint}`,
                              'INSTRUCTION: Only update this element or its nearest relevant section. Do not change other sections, layout, or styling.',
                              `USER REQUEST: ${finalContent}`
                          ].join('\n')
                      };
                  }
                  return {
                      role: msg.role,
                      content: finalContent
                  };
              });

        const compressedMessages = compressMessagesForPrompt(cleanMessages);
        const trimmedMessages = trimMessagesForPrompt(compressedMessages);

        // CRITICAL: Use the most up-to-date files from Sandpack internal state if available
        const currentFiles = sandpackFilesRef.current && Object.keys(sandpackFilesRef.current).length > 0
            ? sandpackFilesRef.current
            : files;
        const stylePreset = !isUpdate ? pickStylePreset() : null;
        
        let currentFilesToSync = preprocessFiles(currentFiles);
        const promptFilesResult = buildPromptFiles(currentFilesToSync, activeEditorFile);
        const cleanFiles = { ...promptFilesResult.files };
        const fileIndex = promptFilesResult.fileIndex || [];

        const promptPayload = {
            files: cleanFiles,
            fileIndex
        };

        let PROMPT = JSON.stringify(trimmedMessages) + "\n\n Current Code Files Structure: " + JSON.stringify(promptPayload) + "\n\n" + Prompt.CODE_GEN_PROMPT;
        
        if (isErrorReport) {
            PROMPT += "\n\n CRITICAL: The user is reporting an ERROR or ISSUE in the code. Your primary goal is to DEBUG and FIX the reported issue. Analyze the provided error logs/description and the current code structure to identify and resolve the root cause.";
        }

        if (!isUpdate && stylePreset) {
            PROMPT += `\n\n DESIGN VARIATION SEED (MANDATORY):
- Theme: ${stylePreset.name}
- Palette: ${stylePreset.palette}
- Font pairing: ${stylePreset.fonts} (include Google Fonts link or @import)
- Hero layout: ${stylePreset.hero}
- Background treatment: ${stylePreset.background}
- Accent details: ${stylePreset.accents}
- Hero media rule: do NOT use circular image masks, giant rings, orbit frames, decorative circles over images, or cramped image collages. Prefer rectangular, editorial, full-bleed, asymmetric, or device/mockup-style media compositions with clear spacing.
\n\n CONTENT DEPTH REQUIREMENT: Home page must include 6-9 meaningful sections with realistic copy, not a tiny demo.
\n\n CONTACT REQUIREMENT: Every site must include a contact form and a visible map. Use /contact for multi-page sites or a full #contact section for single-page sites.
\n\n IMAGE REQUIREMENT: Use several distinct relevant images across hero, gallery/showcase/cards/team/testimonials where appropriate. Use the Pexels search URL pattern with different specific keywords and matching orientation. Do not reuse the same image URL repeatedly.`;
        }
        
        if (promptFilesResult.useCompression) {
            PROMPT += "\n\n NOTE: Some files were truncated or omitted from content. Use fileIndex for awareness and avoid rewriting unrelated files.";
        }

        const latestTargetedMessage = [...messages].reverse().find((msg) => msg.role === 'user' && msg.selectedElement);
        const targetedHint = latestTargetedMessage?.selectedElement
            ? formatSelectedElement(latestTargetedMessage.selectedElement)
            : '';
        
        if (isUpdate) {
            PROMPT += "\n\n 🔴 ABSOLUTELY CRITICAL - YOU MUST MODIFY CODE FILES! 🔴";
            PROMPT += "\n\n - YOU ARE NOT ALLOWED TO ONLY TALK OR CHAT!";
            PROMPT += "\n\n - YOU MUST ACTUALLY UPDATE THE CODE FILES TO MAKE THE USER'S REQUESTED CHANGES!";
            PROMPT += "\n\n - IF THE USER ASKS TO CHANGE A COLOR, YOU MUST UPDATE THE CSS/TAILWIND CLASSES IN THE RELEVANT FILE!";
            PROMPT += "\n\n - IF THE USER ASKS TO ADD A SECTION, YOU MUST INSERT THAT SECTION INTO THE APPROPRIATE COMPONENT FILE!";
            PROMPT += "\n\n - IF THE USER ASKS TO ADD A NEW PAGE, YOU MUST CREATE THE NEW PAGE FILE AND UPDATE THE ROUTING IF NEEDED!";
            PROMPT += "\n\n - IF THE USER ASKS TO REPLACE AN IMAGE, YOU MUST UPDATE THE IMAGE SRC IN THE RELEVANT COMPONENT!";
            PROMPT += "\n\n - RETURN THE FULL CONTENT OF ALL MODIFIED FILES IN THE 'files' ARRAY!";
            PROMPT += "\n\n - DO NOT SKIP OR AVOID MODIFYING THE CODE - THIS IS YOUR PRIMARY JOB!";
            PROMPT += "\n\n CRITICAL: You are UPDATING an existing project. Focus on modifying the relevant files while PRESERVING the existing structure and high-end design. DO NOT reset to a blank project or 'Hello World'. Return the FULL content of all modified files. If the project already has complex components and pages, you MUST keep them and only update the requested parts.";
            PROMPT += "\n\n SURGICAL UPDATE CONTRACT: Treat the latest user message as an edit command. Make exactly that requested change and the minimum supporting code changes needed for it to work. If the user asks for a color/text/image/section/page/navigation/form/content change, update the existing code accordingly. Do not regenerate the whole website, change unrelated sections, replace the theme, or remove existing content unless the user explicitly asks.";
            PROMPT += "\n\n IMPORTANT: Only return the files that actually need changing. Do not send back standard boilerplates unless they need updates. If you rename or delete a file, specify it clearly in your explanation.";
            PROMPT += "\n\n FILE EXTENSIONS: Always use .jsx for React components. If the current project uses .jsx, continue using .jsx. Ensure all imports are correct and relative.";
            PROMPT += "\n\n IMPORT CONFLICTS: Avoid duplicate declarations. For example, if you have a page component named 'Menu', and you also need the 'Menu' icon from lucide-react, you MUST alias one of them (e.g., import { Menu as MenuIcon } from 'lucide-react').";
            PROMPT += "\n\n 🚫 NO UNSUPPORTED LIBRARIES! You can ONLY use these dependencies: react, react-dom, react-router-dom, lucide-react, framer-motion, clsx, tailwind-merge. DO NOT USE ANYTHING ELSE like recharts, chart.js, three.js, d3, canvas, etc. - these are NOT installed!";
            PROMPT += "\n\n 📱 ALWAYS FULLY RESPONSIVE! Whenever you update or create anything, ensure it works perfectly on ALL screen sizes: mobile (sm:), tablet (md:), desktop (lg:, xl:). Use Tailwind responsive classes appropriately. For mobile: stack vertically, smaller padding/fonts, touch-friendly buttons. For desktop: multi-column layouts, proper spacing.";
            if (targetedHint) {
                PROMPT += `\n\n TARGETED UPDATE MODE: The user targeted ${targetedHint}. ONLY update that element or its closest section. Do NOT change other sections, layout, or styling.`;
            }
        }
        
        try {
            const result = await axios.post('/api/gen-ai-code', {
                prompt: PROMPT,
                existingFiles: cleanFiles,
                isUpdate: isUpdate
            }, {
                timeout: 130000 // Give server-side generation + fallback enough time
            });

            if (result.data?.error) {
                throw new Error(result.data.error);
            }
            if (!result.data?.files || typeof result.data.files !== 'object') {
                throw new Error('Generator returned no usable files.');
            }

            const processedAiFiles = preprocessFiles(result.data?.files || {});
            
            // BULLETPROOF MERGING:
            // 1. Start with the current files to preserve everything.
            // 2. Overwrite with AI generated files.
            // 3. Normalize to ensure essentials (Navbar, Footer, index.html) exist.
            const mergedFiles = normalizeGeneratedFiles({ 
                ...currentFilesToSync, 
                ...processedAiFiles 
            });
            
            // SAFETY CHECK: If the AI returned an empty or nearly empty project during an update, 
            // we prevent it from being set as the state.
            if (isUpdate && Object.keys(processedAiFiles).length < 2 && Object.keys(mergedFiles).length > 5) {
                console.warn("AI returned suspiciously small update payload. Merging carefully.");
            }

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
            await UpdateFiles({
                workspaceId: id,
                userId,
                files: mergedFiles,
                title: nextTitle && nextTitle.length > 0 ? nextTitle : undefined
            });
            // ALWAYS remount Sandpack after AI generation so content changes are visible
            // (color changes, new sections, text edits, image swaps all modify existing files
            //  without changing the file list — Sandpack won't pick those up without a remount)
            setSandpackKey(prev => prev + 1);

            // Also sync to the embedded workspace preview iframe for instant update
            try {
                const iframe = previewWrapperRef.current?.querySelector?.('iframe');
                if (iframe?.contentWindow) {
                    iframe.contentWindow.postMessage({ type: 'ELISA_SYNC_FILES', files: mergedFiles }, '*');
                }
            } catch (e) {
                // ignore postMessage errors
            }
        } catch (error) {
            console.error('GenerateAiCode Error:', error);
            const status = error?.response?.status;
            const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
            const errorMsg = error?.response?.data?.error || error?.message || 'Unknown error occurred';
            alert(
                status === 429
                    ? "AI rate limit hit ho gaya hai. 20-40 seconds baad dubara try karo."
                    : isTimeout
                        ? "Generation timed out before the AI returned valid code. Please try a shorter prompt."
                        : "Error generating code: " + errorMsg
            );
        } finally {
            generationInFlightRef.current = false;
            setLoading(false);
        }
    }, [id, messages, files, historyIndex, preprocessFiles, pickActiveEditorFile, normalizeGeneratedFiles, UpdateFiles, userId, activeEditorFile, loading]);

    useEffect(() => {
        if (!filesLoaded) return;
        
        if (messages?.length > 0) {
            const lastIndex = messages.length - 1;

            if (skipInitialGenerateRef.current) {
                skipInitialGenerateRef.current = false;
                lastProcessedIndexRef.current = lastIndex;
                return;
            }

            // ORIGINAL WORKING LOGIC - KEEP IT SIMPLE!
            if (lastProcessedIndexRef.current >= lastIndex) {
                return;
            }

            let userMessageIndex = -1;
            for (let i = lastIndex; i >= 0; i--) {
                if (messages[i].role === 'user') {
                    userMessageIndex = i;
                    break;
                }
                if (messages[i].role === 'command') break;
            }

            if (userMessageIndex > lastProcessedIndexRef.current) {
                const latestUserMsg = messages[userMessageIndex];
                if (latestUserMsg?.fromDb && hasPersistedFilesRef.current) {
                    lastProcessedIndexRef.current = lastIndex;
                    return;
                }

                if (chatOnly) {
                    lastProcessedIndexRef.current = lastIndex;
                    return;
                }

                if (!loading && !generationInFlightRef.current) {
                    // Mark ALL messages up to lastIndex as processed (not just userMessageIndex)
                    // This handles the case where ChatView adds AI response quickly after user message
                    lastProcessedIndexRef.current = lastIndex;
                    GenerateAiCode();
                    return;
                }
            }

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
    }, [messages, history, historyIndex, id, UpdateFiles, chatOnly, GenerateAiCode, userId, filesLoaded, loading])

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

                const fallbackCss = `
/* Elisa preview fallback */
*{box-sizing:border-box}
:root{--background:#050816;--foreground:#f8fafc;--card:#0f172a;--card-foreground:#f8fafc;--popover:#020617;--popover-foreground:#f8fafc;--primary:#84cc16;--primary-foreground:#04130a;--secondary:#162033;--secondary-foreground:#f8fafc;--muted:#0f172a;--muted-foreground:#94a3b8;--accent:#1e293b;--accent-foreground:#f8fafc;--border:rgba(148,163,184,.28);--input:rgba(148,163,184,.22);--ring:rgba(132,204,22,.45);--radius:1rem;--tw-gradient-from:#84cc16;--tw-gradient-via:#22c55e;--tw-gradient-to:#0f172a}
html,body,#root{min-height:100%}
body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:0;background:var(--background);color:var(--foreground)}
a{color:inherit}
button,input,textarea,select{font:inherit;color:inherit}
.bg-transparent{background-color:transparent !important}
.bg-white{background-color:#ffffff !important}
.bg-white\\/5{background-color:rgba(255,255,255,.05) !important}
.bg-white\\/10{background-color:rgba(255,255,255,.10) !important}
.bg-white\\/20{background-color:rgba(255,255,255,.20) !important}
.bg-black\\/20{background-color:rgba(0,0,0,.20) !important}
.bg-black\\/30{background-color:rgba(0,0,0,.30) !important}
.bg-black\\/40{background-color:rgba(0,0,0,.40) !important}
.bg-black\\/50{background-color:rgba(0,0,0,.50) !important}
.bg-black\\/60{background-color:rgba(0,0,0,.60) !important}
.bg-slate-950{background-color:#020617 !important}
.bg-slate-950\\/60{background-color:rgba(2,6,23,.60) !important}
.bg-slate-950\\/70{background-color:rgba(2,6,23,.70) !important}
.bg-slate-950\\/80{background-color:rgba(2,6,23,.80) !important}
.bg-slate-950\\/90{background-color:rgba(2,6,23,.90) !important}
.bg-slate-900{background-color:#0f172a !important}
.bg-slate-900\\/50{background-color:rgba(15,23,42,.50) !important}
.bg-slate-900\\/60{background-color:rgba(15,23,42,.60) !important}
.bg-slate-900\\/70{background-color:rgba(15,23,42,.70) !important}
.bg-slate-900\\/80{background-color:rgba(15,23,42,.80) !important}
.bg-slate-900\\/90{background-color:rgba(15,23,42,.90) !important}
.bg-slate-800{background-color:#1e293b !important}
.bg-background{background-color:var(--background) !important}
.bg-card{background-color:var(--card) !important}
.bg-card\\/40,.bg-card\\/50,.bg-card\\/60,.bg-card\\/70,.bg-card\\/80,.bg-card\\/85,.bg-card\\/95{background-color:rgba(15,23,42,.72) !important}
.bg-primary{background-color:var(--primary) !important}
.bg-primary\\/5{background-color:rgba(132,204,22,.05) !important}
.bg-primary\\/10{background-color:rgba(132,204,22,.10) !important}
.bg-primary\\/20{background-color:rgba(132,204,22,.20) !important}
.bg-primary\\/30{background-color:rgba(132,204,22,.30) !important}
.bg-secondary{background-color:var(--secondary) !important}
.bg-accent{background-color:var(--accent) !important}
.bg-muted{background-color:var(--muted) !important}
.bg-foreground{background-color:var(--foreground) !important}
.bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-from),var(--tw-gradient-via),var(--tw-gradient-to)) !important}
.bg-gradient-to-br{background-image:linear-gradient(to bottom right,var(--tw-gradient-from),var(--tw-gradient-via),var(--tw-gradient-to)) !important}
.from-primary,.from-lime-400,.from-lime-500,.from-green-400,.from-green-500{--tw-gradient-from:#84cc16 !important}
.from-emerald-400,.from-emerald-500{--tw-gradient-from:#34d399 !important}
.from-blue-500,.from-blue-600{--tw-gradient-from:#3b82f6 !important}
.from-indigo-500,.from-indigo-600{--tw-gradient-from:#6366f1 !important}
.from-purple-500,.from-purple-600{--tw-gradient-from:#8b5cf6 !important}
.from-rose-500,.from-pink-500{--tw-gradient-from:#f43f5e !important}
.to-primary,.to-lime-400,.to-lime-500,.to-green-500,.to-green-600{--tw-gradient-to:#65a30d !important}
.to-emerald-500,.to-emerald-600{--tw-gradient-to:#10b981 !important}
.to-blue-500,.to-blue-600{--tw-gradient-to:#2563eb !important}
.to-indigo-500,.to-indigo-600{--tw-gradient-to:#4f46e5 !important}
.to-purple-500,.to-purple-600{--tw-gradient-to:#7c3aed !important}
.to-rose-500,.to-pink-500{--tw-gradient-to:#ec4899 !important}
.via-emerald-500,.via-green-500{--tw-gradient-via:#22c55e !important}
.via-blue-500{--tw-gradient-via:#3b82f6 !important}
.text-white{color:#ffffff !important}
.text-white\\/60{color:rgba(255,255,255,.60) !important}
.text-white\\/70{color:rgba(255,255,255,.70) !important}
.text-white\\/80{color:rgba(255,255,255,.80) !important}
.text-slate-100{color:#f1f5f9 !important}
.text-slate-200{color:#e2e8f0 !important}
.text-slate-300{color:#cbd5e1 !important}
.text-slate-400{color:#94a3b8 !important}
.text-slate-500{color:#64748b !important}
.text-slate-900{color:#0f172a !important}
.text-foreground{color:var(--foreground) !important}
.text-background{color:var(--background) !important}
.text-card-foreground{color:var(--card-foreground) !important}
.text-primary{color:var(--primary) !important}
.text-primary-foreground{color:var(--primary-foreground) !important}
.text-secondary-foreground{color:var(--secondary-foreground) !important}
.text-accent-foreground{color:var(--accent-foreground) !important}
.text-muted-foreground{color:var(--muted-foreground) !important}
.border-white\\/10{border-color:rgba(255,255,255,.10) !important}
.border-white\\/15{border-color:rgba(255,255,255,.15) !important}
.border-white\\/20{border-color:rgba(255,255,255,.20) !important}
.border-slate-700{border-color:#334155 !important}
.border-border,.border-border\\/60,.border-border\\/70{border-color:var(--border) !important}
.border-input{border-color:var(--input) !important}
.border-primary,.border-primary\\/20,.border-primary\\/30,.border-primary\\/40,.border-primary\\/50,.border-primary\\/60{border-color:rgba(132,204,22,.45) !important}
.ring-ring{box-shadow:0 0 0 1px var(--ring) !important}
.shadow-xl{box-shadow:0 20px 45px rgba(15,23,42,.35) !important}
.shadow-2xl{box-shadow:0 25px 60px rgba(15,23,42,.45) !important}
.shadow-primary\\/20{box-shadow:0 18px 40px rgba(132,204,22,.18) !important}
.shadow-black\\/5{box-shadow:0 10px 30px rgba(0,0,0,.18) !important}
.backdrop-blur-sm,.backdrop-blur-md,.backdrop-blur-xl{backdrop-filter:blur(12px) !important}
.rounded-xl{border-radius:.75rem}
.rounded-2xl{border-radius:1rem}
.rounded-3xl{border-radius:1.5rem}
.rounded-full{border-radius:9999px}
.max-w-6xl{max-width:72rem}
.mx-auto{margin-left:auto;margin-right:auto}
.px-6{padding-left:1.5rem;padding-right:1.5rem}
.py-10{padding-top:2.5rem;padding-bottom:2.5rem}
.mt-3{margin-top:0.75rem}
.text-2xl{font-size:1.5rem;line-height:2rem}
.font-black{font-weight:900}
.tracking-tight{letter-spacing:-0.01em}
.text-sm{font-size:0.875rem}
.text-xs{font-size:0.75rem}
button[class],a[class*="bg-"],a[class*="border"],a[class*="rounded"]{transition:all .2s ease}
button[class*="bg-primary"],a[class*="bg-primary"]{background:var(--primary) !important;color:var(--primary-foreground) !important;border:1px solid rgba(132,204,22,.42)}
button[class*="bg-foreground"],a[class*="bg-foreground"]{background:var(--foreground) !important;color:var(--background) !important}
button[class*="border"],a[class*="border"]{border-width:1px;border-style:solid}
input[class],textarea[class],select[class]{background:rgba(15,23,42,.58) !important;border:1px solid var(--input) !important;color:var(--foreground) !important}
input::placeholder,textarea::placeholder{color:rgba(148,163,184,.6)}
.text-transparent.bg-clip-text,.bg-clip-text.text-transparent{color:var(--foreground) !important;-webkit-text-fill-color:currentColor !important;background-clip:border-box !important;-webkit-background-clip:border-box !important}
.bg-clip-text{background-clip:border-box !important;-webkit-background-clip:border-box !important}
`;
                const styleTag = `<style id="elisa-tailwind-fallback">${fallbackCss}</style>`;
                if (out.match(/<\/head>/i)) {
                    out = out.replace(/<\/head>/i, `    ${styleTag}\n  </head>`);
                } else if (out.match(/<head[^>]*>/i)) {
                    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${styleTag}`);
                } else {
                    out = styleTag + '\n' + out;
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

        const syntaxIssues = [];
        Object.entries(validated).forEach(([path, content]) => {
            const issues = getJsxParseIssues(path, toSandboxCode(content));
            if (issues.length > 0) {
                syntaxIssues.push(...issues);
                validated[path] = { code: buildSafeReactFallback(path) };
            }
        });

        if (syntaxIssues.length > 0) {
            console.warn('Preview syntax recovery applied:', syntaxIssues.slice(0, 8));
        }

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
        const entryCandidates = ['/index.jsx', '/index.tsx', '/index.js', '/src/index.jsx', '/src/index.tsx', '/src/index.js'];
        const entryFile = entryCandidates.find(p => Boolean(validated[p]));
        if (entryFile) {
            const baseIndexCode = toSandboxCode(validated[entryFile]);
            const importLine = "import './selector-helper.js';";
            validated[entryFile] = {
                code: baseIndexCode.includes(importLine) ? baseIndexCode : `${importLine}\n${baseIndexCode}`
            };
        }

        return ensureImportedLocalComponentDefaults(ensureLocalImportTargets(validated));

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
            const hasTailwindConfig = out.includes('tailwind.config');
            const hasPrebuiltTailwind = out.includes('tailwind.min.css');
            const hasTailwind = out.includes('cdn.tailwindcss.com');
            const hasTypography = out.includes('@tailwindcss/typography');

            const headInjections = [
                !hasTailwindConfig
                    ? `<script>
      window.tailwind = window.tailwind || {};
      window.tailwind.config = {
        theme: {
          extend: {
            colors: {
              background: "var(--background)",
              foreground: "var(--foreground)",
              card: "var(--card)",
              "card-foreground": "var(--card-foreground)",
              primary: "var(--primary)",
              "primary-foreground": "var(--primary-foreground)",
              secondary: "var(--secondary)",
              "secondary-foreground": "var(--secondary-foreground)",
              muted: "var(--muted)",
              "muted-foreground": "var(--muted-foreground)",
              accent: "var(--accent)",
              "accent-foreground": "var(--accent-foreground)",
              border: "var(--border)",
              input: "var(--input)",
              ring: "var(--ring)"
            }
          }
        }
      };
    </script>`
                    : null,
                !hasPrebuiltTailwind
                    ? '<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />'
                    : null,
                !hasTypography
                    ? '<link rel="stylesheet" href="https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css" />'
                    : null,
                !hasTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : null
            ].filter(Boolean).join('\n    ');

            if (headInjections) {
                if (out.match(/<\/head>/i)) {
                    out = out.replace(/<\/head>/i, `    ${headInjections}\n  </head>`);
                } else if (out.match(/<head[^>]*>/i)) {
                    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${headInjections}`);
                } else {
                    // If no head tag found, create one
                    out = `<!DOCTYPE html>
<html>
<head>
    ${headInjections}
</head>
<body>
${out}
</body>
</html>`;
                }
            }

            if (!out.includes('type="module"')) {
                const bodyCloseMatch = out.match(/<\/body>/i);
                const scriptTag = '    <script type="module" src="/index.jsx"></script>';
                if (bodyCloseMatch) {
                    out = out.replace(/<\/body>/i, `${scriptTag}\n  </body>`);
                } else {
                    out = out + `\n${scriptTag}`;
                }
            }

            const fallbackCss = `
/* Elisa preview rescue */
*{box-sizing:border-box}
:root{--background:#050816;--foreground:#f8fafc;--card:#0f172a;--card-foreground:#f8fafc;--primary:#84cc16;--primary-foreground:#04130a;--secondary:#162033;--secondary-foreground:#f8fafc;--muted:#0f172a;--muted-foreground:#94a3b8;--accent:#1e293b;--accent-foreground:#f8fafc;--border:rgba(148,163,184,.28);--input:rgba(148,163,184,.22);--ring:rgba(132,204,22,.45);--tw-gradient-from:#84cc16;--tw-gradient-via:#22c55e;--tw-gradient-to:#0f172a}
html,body,#root{min-height:100%}
body{margin:0;background:var(--background);color:var(--foreground);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
a{color:inherit;text-decoration:none}
img{max-width:100%;height:auto}
button,input,textarea,select{font:inherit}
.bg-background{background-color:var(--background)!important}.bg-foreground{background-color:var(--foreground)!important}.bg-card{background-color:var(--card)!important}.bg-primary{background-color:var(--primary)!important}.bg-secondary{background-color:var(--secondary)!important}.bg-muted{background-color:var(--muted)!important}.bg-accent{background-color:var(--accent)!important}
.text-background{color:var(--background)!important}.text-foreground{color:var(--foreground)!important}.text-card-foreground{color:var(--card-foreground)!important}.text-primary{color:var(--primary)!important}.text-primary-foreground{color:var(--primary-foreground)!important}.text-secondary-foreground{color:var(--secondary-foreground)!important}.text-muted-foreground{color:var(--muted-foreground)!important}.text-accent-foreground{color:var(--accent-foreground)!important}
.border-border{border-color:var(--border)!important}.border-input{border-color:var(--input)!important}.ring-ring{box-shadow:0 0 0 1px var(--ring)!important}
.bg-gradient-to-r{background-image:linear-gradient(to right,var(--tw-gradient-from),var(--tw-gradient-via),var(--tw-gradient-to))!important}.bg-gradient-to-br{background-image:linear-gradient(to bottom right,var(--tw-gradient-from),var(--tw-gradient-via),var(--tw-gradient-to))!important}
.from-primary{--tw-gradient-from:var(--primary)!important}.via-primary{--tw-gradient-via:var(--primary)!important}.to-primary{--tw-gradient-to:var(--primary)!important}
input[class],textarea[class],select[class]{background:rgba(15,23,42,.58);border:1px solid var(--input);color:var(--foreground)}
.text-transparent.bg-clip-text,.bg-clip-text.text-transparent{color:var(--foreground)!important;-webkit-text-fill-color:currentColor!important;background-clip:border-box!important;-webkit-background-clip:border-box!important}
.bg-clip-text{background-clip:border-box!important;-webkit-background-clip:border-box!important}
`;
            if (!out.includes('elisa-preview-rescue')) {
                const styleTag = `<style id="elisa-preview-rescue">${fallbackCss}</style>`;
                if (out.match(/<\/head>/i)) {
                    out = out.replace(/<\/head>/i, `    ${styleTag}\n  </head>`);
                } else if (out.match(/<head[^>]*>/i)) {
                    out = out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${styleTag}`);
                } else {
                    out = `${styleTag}\n${out}`;
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
                const importLine = "import './selector-helper.js';";
                const withImport = input.includes(importLine) ? input : `${importLine}\n${input}`;
                return withImport
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
                                <div className="h-full w-full flex items-stretch justify-center p-0 bg-[#0b1220] transition-all duration-300 rounded-b-3xl overflow-hidden">
                                    <div 
                                        ref={previewWrapperRef}
                                        className={`bg-[#0b1220] shadow-2xl overflow-hidden transition-all duration-500 h-full relative rounded-b-3xl ${
                                            previewDevice === 'mobile' ? 'w-[375px]' : 
                                            previewDevice === 'tablet' ? 'w-[768px]' : 'w-full'
                                        }`}
                                    >
                                        <div style={{ width: '125%', height: '125%', transform: 'scale(0.8)', transformOrigin: '0 0' }}>
                                            <SandpackPreview 
                                                showNavigator={true}
                                                style={{ height: '100%', width: '100%', border: 'none' }}
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


