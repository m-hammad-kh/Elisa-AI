"use client"
import React, { useMemo, useState, useEffect } from 'react';
import { parse as parseBabel } from '@babel/parser';
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
        &copy; {new Date().getFullYear()} Elisa AI. All rights reserved.
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

const fixUnsafeSandboxCode = (input) => {
  let code = typeof input === 'string' ? input : '';
  code = code.replace(/\r\n/g, '\n');
  code = normalizeRelativeComponentImports(code);
  code = fixStringStyleProps(code);
  code = sanitizeUnsupportedLibraries(code);
  
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

    if (new RegExp(`\\b(function|const|class|let|var)\\s+${componentName}\\b`).test(code)) {
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
    files: ensureImportedLocalComponentDefaults(ensureLocalImportTargets(next)),
    issues: parseIssues,
  };
};

const ensurePreviewBrowserRouter = (fileMap) => {
  const next = { ...(fileMap || {}) };
  const indexPath = next['/index.jsx']
    ? '/index.jsx'
    : next['/index.tsx']
      ? '/index.tsx'
      : next['/index.js']
        ? '/index.js'
        : '';
  if (!indexPath) return next;

  const routerPatterns = ['<Link', '<NavLink', '<Route', '<Routes', 'useNavigate', 'useLocation', 'useParams', 'useSearchParams', '<Navigate'];
  const usesRouter = Object.entries(next).some(([path, content]) => {
    if (path === indexPath) return false;
    const code = toSandboxCode(content);
    return routerPatterns.some((pattern) => code.includes(pattern));
  });
  if (!usesRouter) return next;

  let indexCode = toSandboxCode(next[indexPath]);
  if (!indexCode.includes('BrowserRouter')) {
    if (!/from\s+['"]react-router-dom['"]/.test(indexCode)) {
      indexCode = indexCode.replace(/^(?:import[^\n]*\n)+/m, (imports) => `${imports}import { BrowserRouter } from 'react-router-dom';\n`);
      if (!indexCode.includes("from 'react-router-dom'") && !indexCode.includes('from "react-router-dom"')) {
        indexCode = `import { BrowserRouter } from 'react-router-dom';\n${indexCode}`;
      }
    }
    indexCode = indexCode.replace(/(\s*)<App\s*\/>/m, '$1<BrowserRouter>\n$1  <App />\n$1</BrowserRouter>');
    next[indexPath] = { code: indexCode };
  }

  const appPath = next['/App.jsx'] ? '/App.jsx' : next['/App.js'] ? '/App.js' : '';
  if (appPath) {
    let appCode = toSandboxCode(next[appPath]);
    if (appCode.includes('<BrowserRouter')) {
      appCode = appCode
        .replace(/<BrowserRouter[^>]*>/g, '')
        .replace(/<\/BrowserRouter>/g, '')
        .replace(/^\s*import\s+\{\s*BrowserRouter\s*\}\s+from\s+['"]react-router-dom['"];?\s*\n?/m, '');
      next[appPath] = { code: appCode };
    }
  }

  return next;
};

export default function WorkspacePreviewPage() {
  const { id } = useParams();
  const { user, isLoaded } = useUser();
  const userId = user?.id;
  const workspace = useQuery(
    api.workspace.GetWorkspace,
    id && isLoaded && userId ? { workspaceId: id, userId } : "skip"
  );
  const files = useMemo(() => {
    const processed = {};
    Object.entries(workspace?.fileData || {}).forEach(([path, content]) => {
      if (!isValidSandboxPath(path)) return;
      const cleanPath = toSandboxPath(path);
      processed[cleanPath] = { code: hardenFooterSource(cleanPath, fixUnsafeSandboxCode(toSandboxCode(content))) };
    });
    const normalizedDefaults = {};
    Object.entries(Lookup.DEFAULT_FILE || {}).forEach(([path, content]) => {
      if (!isValidSandboxPath(path)) return;
      const cleanPath = toSandboxPath(path);
      normalizedDefaults[cleanPath] = { code: hardenFooterSource(cleanPath, fixUnsafeSandboxCode(toSandboxCode(content))) };
    });
    const sanitized = sanitizePreviewFiles({
      ...normalizedDefaults,
      ...processed
    });
    if (sanitized.issues.length > 0) {
      console.warn('Preview page syntax recovery applied:', sanitized.issues.slice(0, 8));
    }
    return ensurePreviewBrowserRouter(sanitized.files);
  }, [workspace?.fileData]);

  const template = 'react';
  const previewDependencies = { ...(Lookup.DEPENDENCIES || {}) };
  const pkgJson = files['/package.json'] || files['/src/package.json'];
  if (pkgJson) {
    try {
      const parsed = JSON.parse(toSandboxCode(pkgJson));
      if (parsed.dependencies && typeof parsed.dependencies === 'object') {
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
    
    if (headInjections && out.match(/<\/head>/i)) {
      out = out.replace(/<\/head>/i, `    ${headInjections}\n  </head>`);
    } else if (headInjections && out.match(/<head[^>]*>/i)) {
      out = out.replace(/<head[^>]*>/i, (m) => `${m}\n    ${headInjections}`);
    } else if (headInjections && !out.includes('<head')) {
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

  const stripViteModuleScripts = (html) => {
    const input = typeof html === 'string' ? html : '';
    return input.replace(/<script[^>]*type=["']module["'][\s\S]*?<\/script>/gi, '');
  };

  const sandpackConfig = useMemo(() => {
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

    return { sandpackFiles, entry };
  }, [files]);

  const [liveFiles, setLiveFiles] = useState(sandpackConfig.sandpackFiles);
  const sourceFilesHash = useMemo(
    () => JSON.stringify(sandpackConfig.sandpackFiles || {}),
    [sandpackConfig.sandpackFiles]
  );
  const liveFilesHash = useMemo(
    () => JSON.stringify(liveFiles || {}),
    [liveFiles]
  );

  // Keep liveFiles in sync with DB-driven files when workspace data changes
  useEffect(() => {
    if (sourceFilesHash === liveFilesHash) return;
    setLiveFiles(sandpackConfig.sandpackFiles);
  }, [sourceFilesHash, liveFilesHash, sandpackConfig.sandpackFiles]);

  // Listen for editor sync messages from parent to apply live updates
  useEffect(() => {
    const normalizeIncomingPath = (rawPath, currentFiles) => {
      const key = rawPath && typeof rawPath === 'string'
        ? (rawPath.startsWith('/') ? rawPath : `/${rawPath}`)
        : `/${String(rawPath)}`;
      if (currentFiles?.[key]) return key;
      if (key === '/index.html' && currentFiles?.['/public/index.html']) return '/public/index.html';
      if (!key.startsWith('/src/') && currentFiles?.[`/src${key}`]) return `/src${key}`;
      return key;
    };

    const handle = (event) => {
      try {
        const data = event.data || {};
        if (data && data.type === 'ELISA_SYNC_FILES' && data.files && typeof data.files === 'object') {
          setLiveFiles((prev) => {
            const next = { ...(prev || {}) };
            Object.entries(data.files || {}).forEach(([path, content]) => {
              const key = normalizeIncomingPath(path, next);
              if (content && typeof content === 'object' && typeof content.code === 'string') {
                next[key] = { code: content.code };
              } else if (typeof content === 'string') {
                next[key] = { code: content };
              }
            });
            try {
              if (JSON.stringify(prev || {}) === JSON.stringify(next)) {
                return prev;
              }
            } catch (e) {}
            return next;
          });
        }
      } catch (e) {}
    };
    window.addEventListener('message', handle);
    return () => window.removeEventListener('message', handle);
  }, [setLiveFiles]);
  return (
    <div className="h-screen w-screen overflow-hidden bg-white">
      <SandpackProvider
        key={id || 'preview'}
        files={liveFiles}
        template={template}
        theme="dark"
        customSetup={{
          dependencies: {
            ...previewDependencies
          },
          entry: sandpackConfig.entry
        }}
        options={{
          externalResources: [
            'https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css',
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
