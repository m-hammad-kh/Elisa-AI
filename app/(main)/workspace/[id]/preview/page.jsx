"use client"
import React, { useMemo } from 'react';
import { SandpackProvider, SandpackPreview } from "@codesandbox/sandpack-react";
import { useQuery } from 'convex/react';
import { useParams } from 'next/navigation';
import Lookup from '@/data/Lookup';
import { api } from '@/convex/_generated/api';
import { useUser } from "@clerk/clerk-react";

const isValidSandboxPath = (value) => {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && normalized !== 'null' && normalized !== 'undefined' && normalized !== '[object object]';
};

const toSandboxPath = (value) => {
  if (typeof value !== 'string') return '/unknown';
  const trimmed = value.trim();
  if (!trimmed) return '/unknown';
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
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
        © {new Date().getFullYear()} Elisa AI. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;
`;

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
    const stubBlock = unresolved.map((name) => `const ${name} = () => null;`).join('\n');
    prependBlock(stubBlock);
  }

  return code;
};

const fixUnsafeSandboxCode = (input) => {
  let code = typeof input === 'string' ? input : '';
  code = code.replace(/\r\n/g, '\n');
  
  // Fix common AI errors: importing from null/undefined or empty strings
  code = code
    .split('\n')
    .filter(line => {
      // Remove lines that import from null, undefined, or empty strings
      const isUnsafeImport = /^\s*import\s+.*from\s+['"](null|undefined|)['"]\s*;?\s*$/.test(line);
      const isUnsafeRequire = /require\(\s*(null|undefined|['"]['"])\s*\)/.test(line);
      return !isUnsafeImport && !isUnsafeRequire;
    })
    .map(line => {
      // Replace any require(null/undefined) with empty object
      return line.replace(/require\(\s*(null|undefined)\s*\)/g, '({})');
    })
    .join('\n');

  // Fix path module usage with null/undefined (very common cause of "Path must be a string")
  code = code.replace(/\bpath\.(resolve|join|normalize|dirname|basename|extname|relative|isAbsolute|parse)\(([^)]*)\)/g, (_, method, args) => {
    const safeArgs = String(args).replace(/\b(null|undefined)\b/g, '"."');
    return `path.${method}(${safeArgs})`;
  });

  // Fix other common null/undefined property accesses
  code = code.replace(/\bpath\s*:\s*(null|undefined)\b/g, 'path: "/"');
  code = code.replace(/\bpath\s*=\s*\{\s*(null|undefined)\s*\}/g, 'path="/"');
  code = code.replace(/\bpath\s*=\s*['"](null|undefined|)['"]/g, 'path="/"');
  code = code.replace(/\bpath\s*:\s*['"]\s*['"]/g, 'path: "/"');
  code = code.replace(/\bpath\s*=\s*\{\s*['"]\s*['"]\s*\}/g, 'path="/"');
  
  // Fix image sources or hrefs that might be null
  code = code.replace(/(src|href|to|action|poster)\s*=\s*\{\s*(null|undefined|['"]['"])\s*\}/g, '$1="/"');
  code = code.replace(/(src|href|to|action|poster)\s*=\s*['"](null|undefined|)['"]/g, '$1="/"');

  // Fix new URL(null/undefined, ...) usage
  code = code.replace(/new URL\(\s*(null|undefined)\s*,/g, 'new URL(".",');
  code = repairMismatchedJsxTags(code);
  code = ensureLibraryImports(code);
  code = injectSafetyStubs(code);
  
  return code;
};

export default function WorkspacePreviewPage() {
  const { id } = useParams();
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const workspace = useQuery(
    api.workspace.GetWorkspace,
    id && isLoaded && userId ? { workspaceId: id, userId } : "skip"
  );
  const sandpackKey = useMemo(() => {
    if (!workspace?.fileData) return 'preview-empty';
    try {
      const data = workspace.fileData;
      const keys = typeof data === 'object' && data !== null ? Object.keys(data) : [];
      const json = JSON.stringify(data);
      return `preview-${json.length}-${keys.length}`;
    } catch (e) {
      return 'preview-error';
    }
  }, [workspace?.fileData]);

  const files = useMemo(() => {
    const processed = {};
    Object.entries(workspace?.fileData || {}).forEach(([path, content]) => {
      if (!isValidSandboxPath(path)) return;
      const cleanPath = toSandboxPath(path);
      processed[cleanPath] = { code: fixUnsafeSandboxCode(toSandboxCode(content)) };
    });
    const normalizedDefaults = {};
    Object.entries(Lookup.DEFAULT_FILE || {}).forEach(([path, content]) => {
      if (!isValidSandboxPath(path)) return;
      const cleanPath = toSandboxPath(path);
      normalizedDefaults[cleanPath] = { code: fixUnsafeSandboxCode(toSandboxCode(content)) };
    });
    return {
      ...normalizedDefaults,
      ...processed,
      '/components/Footer.jsx': { code: SAFE_FOOTER_CODE }
    };
  }, [workspace?.fileData]);

  const template = 'react';
  const previewDependencies = { ...(Lookup.DEPENDENCIES || {}) };
  delete previewDependencies.vite;
  delete previewDependencies['@vitejs/plugin-react'];
  delete previewDependencies['esbuild-wasm'];

  const ensureExternalStylesInHtml = (html) => {
    const input = typeof html === 'string' ? html : '';
    if (!input.trim()) return input;
    let out = input;
    const needsTailwind = !out.includes('cdn.tailwindcss.com');
    const needsTypography = !out.includes('@tailwindcss/typography');
    if (!needsTailwind && !needsTypography) return out;
    const injections = [
      needsTypography
        ? '<link rel="stylesheet" href="https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css" />'
        : null,
      needsTailwind ? '<script src="https://cdn.tailwindcss.com"></script>' : null
    ].filter(Boolean).join('\n    ');
    if (out.match(/<\/head>/i)) {
      return out.replace(/<\/head>/i, `    ${injections}\n  </head>`);
    }
    if (out.match(/<head[^>]*>/i)) {
      return out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${injections}`);
    }
    return `${injections}\n${out}`;
  };

  const stripViteModuleScripts = (html) => {
    const input = typeof html === 'string' ? html : '';
    return input.replace(/<script[^>]*type=["']module["'][\s\S]*?<\/script>/gi, '');
  };

  const isViteLike = Boolean(
    files['/index.html'] &&
      (files['/index.jsx'] ||
        files['/index.tsx'] ||
        files['/src/main.jsx'] ||
        files['/src/main.tsx'] ||
        files['/vite.config.js'])
  );

  let sandpackFiles = files;
  let entry;

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
    const rawHtml = toSandboxCode(files['/index.html'] || '').trim();
    nextFiles['/public/index.html'] = { code: ensureExternalStylesInHtml(stripViteModuleScripts(rawHtml || fallbackHtml)) };

    Object.entries(files).forEach(([path, content]) => {
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
    entry = entryCandidates.find((path) => Boolean(files[path])) || Object.keys(files)[0] || '/index.js';
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <SandpackProvider
        key={sandpackKey}
        files={sandpackFiles}
        template={template}
        theme="dark"
        customSetup={{
          dependencies: {
            ...previewDependencies
          },
          entry
        }}
        options={{
          externalResources: [
            'https://cdn.tailwindcss.com',
            'https://unpkg.com/@tailwindcss/typography@0.5.10/dist/typography.min.css'
          ],
          bundlerTimeoutSecs: 120,
          initMode: 'immediate',
          autorun: true,
        }}
      >
        <SandpackPreview
          showNavigator={false}
          style={{ height: '100vh' }}
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          showRestartButton={false}
          actionsChildren={<div style={{ display: 'none' }} />}
        />
      </SandpackProvider>
    </div>
  );
}
