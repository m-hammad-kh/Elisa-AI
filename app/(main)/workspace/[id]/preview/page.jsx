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
    return { ...normalizedDefaults, ...processed };
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
