import { NextResponse } from "next/server";
import { model, CodeGenerationConfig, sendMessageWithRetry, fallbackModel } from "@/configs/AiModel";
import { getPexelsImage } from "@/lib/pexels";

const AI_TIMEOUT_MS = 70000;
const REQUIRED_DEPENDENCIES = {
    react: "^19.2.4",
    "react-dom": "^19.2.4",
    "framer-motion": "latest",
    "lucide-react": "latest",
    "react-router-dom": "latest",
    axios: "latest",
    clsx: "latest",
    "tailwind-merge": "latest",
    "tailwindcss-animate": "latest",
};
const DEPENDENCY_ALIASES = {
    clx: "clsx",
};
const DEFAULT_ENTRY_HTML = `<!DOCTYPE html>
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
</html>`;
const DEFAULT_INDEX_JSX = `import React from "react";
import ReactDOM from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`;
const DEFAULT_APP_JSX = `import React from "react";

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-10">
      <div className="max-w-xl w-full text-center">
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Your AI website is ready
        </h1>
        <p className="mt-4 text-slate-500">
          Edit the prompt to generate a new experience.
        </p>
      </div>
    </div>
  );
}`;
const DEFAULT_STYLES = `:root {
  color-scheme: light;
}

html, body, #root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}`;

const SERVER_GENERATION_GUARDRAILS = `
CRITICAL REQUIREMENTS FOR HIGH-QUALITY WEBSITE GENERATION:

1. CODE QUALITY & SYNTAX:
   - Every generated file must be syntactically valid JSX/JS on first response
   - NEVER output code that requires follow-up fixes or corrections
   - All JSX tags MUST close with matching tag names (e.g., <Link></Link>, NOT <Link></div>)
   - All components MUST have proper default exports and consistent naming

2. DESIGN STANDARDS:
   - Create DIVERSE, VISUALLY DISTINCT designs - no cookie-cutter layouts
   - Use modern design principles: white space, typography hierarchy, contrast
   - Implement smooth hover effects and transitions for interactivity
   - Choose appropriate color schemes based on the website theme/purpose
   - Use Tailwind CSS classes that create professional, polished interfaces
   - Include micro-interactions and animations where appropriate

3. CONTENT & STRUCTURE:
   - Generate realistic, meaningful content appropriate to the theme
   - Include at least 3-5 different page sections with varied layouts
   - Structure pages with clear information hierarchy
   - Add engaging headlines, descriptions, and call-to-action buttons
   - Never use placeholder text - generate contextually relevant content

4. COMPONENTS & LAYOUTS:
   - Create reusable, well-structured components
   - Navbar.jsx: responsive navigation with mobile menu support
   - Hero.jsx or similar: compelling hero section with imagery/video
   - Features/Benefits sections with cards, icons, or grids
   - Testimonials/Social proof sections with varied layouts
   - Contact/CTA sections with forms or direct actions
   - Footer.jsx: Create a professional footer that MATCHES the website's color scheme and theme

5. PERFORMANCE & ACCESSIBILITY:
   - Use only approved dependencies: react, react-dom, framer-motion, lucide-react, react-router-dom, axios, clsx, tailwind-merge, tailwindcss-animate
   - NO unknown, typo, or undeclared packages
   - Optimize images and lazy load when appropriate
   - Include semantic HTML and ARIA labels where needed

6. ANIMATIONS & INTERACTIVITY:
   - Use Framer Motion for entrance animations and transitions
   - Add scroll-based animations where contextually appropriate
   - Include interactive elements (buttons, forms, modals)
   - Implement smooth page transitions

7. MOBILE RESPONSIVENESS:
   - Ensure all layouts are fully responsive (mobile, tablet, desktop)
   - Use responsive grid systems and Tailwind breakpoints
   - Test mentally: will this look good on all screen sizes?

8. IMAGES & MEDIA (CRITICAL):
   - ALWAYS use solid color backgrounds as fallback for images
   - For hero sections: Use gradients as background (e.g., bg-gradient-to-br from-blue-600 to-purple-800)
   - For images in cards: Add bg-slate-200, bg-blue-100, or other solid colors
   - Format: <div className="bg-gradient-to-r from-blue-500 to-purple-600"><img src="url" /></div>
   - OR: <img src="url" style={{background: 'linear-gradient(...)'}} />
   - This ensures users see beautiful colors even if images fail to load

9. MAPS ON CONTACT PAGE:
   - Include embedded Google Maps iframe on contact/location pages
   - Make maps responsive: width="100%" height="400"
   - Use standard embed format (find sample on Google Maps embed docs)

FINAL CHECK - Before responding, verify:
- ✓ All files have valid JSX/JS syntax
- ✓ Footer.jsx exists and matches website theme colors
- ✓ All imports are for approved packages only
- ✓ All components are properly exported
- ✓ All tags are properly closed
- ✓ Design is unique and polished (NOT generic)
- ✓ Content is relevant and meaningful
- ✓ Images have solid color backgrounds as fallback
- ✓ Responsive design is implemented
- ✓ Maps included on contact pages
`;

const enhancePromptForBetterGeneration = (userPrompt) => {
  const basePrompt = (userPrompt && typeof userPrompt === "string" && userPrompt.trim()) 
    ? userPrompt 
    : "Create a modern, responsive, content-rich multi-page website";

  const designEnhancements = [
    "Use a unique, modern color palette appropriate for the content",
    "Implement sophisticated typography with clear hierarchy",
    "Add smooth animations and transitions throughout",
    "Create distinctive sections with varied layouts (not repetitive)",
    "Include professional imagery and icons from lucide-react",
  ];

  const structureEnhancements = [
    "Structure the site with: Home/Hero → Features/Benefits → Testimonials/Social Proof → CTA → Contact",
    "Create reusable, well-organized React components",
    "Make every section visually distinct and engaging",
    "Include meaningful, contextual content (not generic placeholder text)",
  ];

  const randomDesign = designEnhancements[Math.floor(Math.random() * designEnhancements.length)];
  const randomStructure = structureEnhancements[Math.floor(Math.random() * structureEnhancements.length)];

  return `${basePrompt}

DESIGN FOCUS: ${randomDesign}
STRUCTURE: ${randomStructure}

MUST INCLUDE:
- Responsive design that works on mobile, tablet, and desktop
- Modern Tailwind CSS styling (NOT generic, make it visually distinctive)
- Smooth Framer Motion animations and transitions
- At least 4-5 different page sections
- Navigation bar with responsive mobile menu
- Hero section with compelling imagery/content
- Features or benefits section with cards or grid
- Testimonials or social proof section
- Call-to-action section
- Footer.jsx: Professional footer that MATCHES the website's color scheme (use primary colors from hero/branding)
- Real, contextual content (not Lorem Ipsum)

CRITICAL - FOOTER DESIGN:
- Create a UNIQUE footer for each website based on its theme and colors
- DO NOT always use dark backgrounds - match the website's palette
- Examples: Tech sites → dark/modern; Creative sites → bold/colorful; Corporate → clean/minimal
- Include: brand info, navigation links, social media, copyright
- Make each footer VISUALLY DISTINCT from previous generations

CRITICAL - IMAGES & BACKGROUNDS:
- ALWAYS add solid color backgrounds or gradients behind images
- Every image must have a beautiful fallback color in case it fails to load
- Use Tailwind: bg-slate-200, bg-blue-100, or gradient classes
- Images should be wrapped in divs with background colors: <div className="bg-gradient-to-r from-blue-500 to-purple-600"><img src="..." /></div>
- Use images from pexels.com or picsum.photos

CRITICAL - MAPS:
- If creating a Contact or Location page, include an embedded Google Maps iframe
- Make maps responsive with width="100%" and reasonable height
- Keep map styling consistent with website theme

REMEMBER: Each generation should look DIFFERENT and UNIQUE - vary the design, layouts, colors, footers, and content structure.`;
};

const hasValidPath = (value) => {
    if (typeof value !== "string") return false;
    const normalized = value.trim().toLowerCase();
    return (
        normalized.length > 0 &&
        normalized !== "null" &&
        normalized !== "undefined" &&
        normalized !== "/null" &&
        normalized !== "/undefined" &&
        normalized !== "unknown" &&
        normalized !== "/unknown" &&
        normalized !== "[object object]"
    );
};

const toAbsolutePath = (value) => {
    if (typeof value !== "string") return "/unknown";
    const trimmed = value.trim().replace(/\\/g, "/");
    if (!trimmed) return "/unknown";
    return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
};

const toCodeString = (content) => {
    if (typeof content === "string") return content;
    if (content && typeof content === "object") {
        if (typeof content.code === "string") return content.code;
        if (typeof content.content === "string") return content.content;
        if (typeof content.text === "string") return content.text;
        if (content.code == null) return "";
        return JSON.stringify(content, null, 2);
    }
    return "";
};

const fixClassContrast = (code) => {
    const input = typeof code === "string" ? code : "";
    if (!input) return input;

    const darkBg = /\bbg-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightBg = /\bbg-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50)\b/;
    const darkText = /\btext-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightText = /\btext-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50|gray-100|slate-100)\b/;

    const fixClassValue = (value) => {
        let next = value;
        const hasAnyTextClass = /\btext-[^\s]+\b/.test(next);
        if (darkBg.test(next) && !hasAnyTextClass) {
            next = `${next} text-slate-100`;
        }
        if (darkBg.test(next) && darkText.test(next)) {
            next = next.replace(/\btext-black\b/g, "text-white");
            next = next.replace(/\btext-(slate|gray|neutral|zinc|stone)-9\d\d\b/g, "text-slate-100");
        }
        if (lightBg.test(next) && !hasAnyTextClass) {
            next = `${next} text-slate-900`;
        }
        if (lightBg.test(next) && lightText.test(next)) {
            next = next.replace(/\btext-white\b/g, "text-slate-900");
            next = next.replace(/\btext-(slate|gray|neutral|zinc|stone)-50\b/g, "text-slate-900");
            next = next.replace(/\btext-(gray|slate)-100\b/g, "text-slate-900");
        }
        return next;
    };

    const rewriteAttr = (attr) => new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, "g");
    const rewriteAttrS = (attr) => new RegExp(`\\b${attr}\\s*=\\s*'([^']*)'`, "g");

    return input
        .replace(rewriteAttr("className"), (match, value) => match.replace(value, fixClassValue(value)))
        .replace(rewriteAttrS("className"), (match, value) => match.replace(value, fixClassValue(value)))
        .replace(rewriteAttr("class"), (match, value) => match.replace(value, fixClassValue(value)))
        .replace(rewriteAttrS("class"), (match, value) => match.replace(value, fixClassValue(value)));
};

const repairMismatchedJsxTags = (input) => {
    const code = typeof input === "string" ? input : "";
    const stack = [];
    const voidTags = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

    return code.replace(/<\/?([A-Za-z][\w.:]*)\b[^>]*>/g, (tag) => {
        const isClosing = tag.startsWith("</");
        const match = tag.match(/^<\/?([A-Za-z][\w.:]*)/);
        const tagName = match?.[1];
        const isHtmlVoidTag = typeof tagName === "string" && tagName === tagName.toLowerCase() && voidTags.has(tagName);
        const isSelfClosing = /\/>$/.test(tag) || isHtmlVoidTag;

        if (!tagName || isSelfClosing) return tag;

        if (!isClosing) {
            stack.push(tagName);
            return tag;
        }

        if (stack.length === 0) return "";
        const expected = stack.pop();
        if (!expected) return "";
        if (expected === tagName) return tag;
        return tag.replace(tagName, expected);
    });
};

const ensureLibraryImports = (input) => {
    let code = typeof input === "string" ? input : "";
    const prependImport = (statement) => {
        if (code.includes(statement.trim())) return;
        const useClientMatch = code.match(/^(['"])use client\1;?\s*/);
        if (useClientMatch) {
            code = `${useClientMatch[0]}${statement}\n${code.slice(useClientMatch[0].length)}`;
            return;
        }
        code = `${statement}\n${code}`;
    };

    const framerSymbols = ["motion", "AnimatePresence"];
    const usedFramerSymbols = framerSymbols.filter((symbol) => {
        if (symbol === "motion") return /\bmotion\./.test(code);
        return new RegExp(`\\b${symbol}\\b|<${symbol}\\b`).test(code);
    });
    if (usedFramerSymbols.length > 0 && !/from\s+['"]framer-motion['"]/.test(code)) {
        prependImport(`import { ${usedFramerSymbols.join(", ")} } from 'framer-motion';`);
    }

    const routerSymbols = ["BrowserRouter", "Routes", "Route", "Link", "NavLink", "Navigate", "Outlet", "useNavigate", "useLocation", "useParams", "useSearchParams"];
    const usedRouterSymbols = routerSymbols.filter((symbol) => {
        if (symbol.startsWith("use")) return new RegExp(`\\b${symbol}\\b`).test(code);
        return new RegExp(`<${symbol}\\b|\\b${symbol}\\b`).test(code);
    });
    if (usedRouterSymbols.length > 0 && !/from\s+['"]react-router-dom['"]/.test(code)) {
        prependImport(`import { ${usedRouterSymbols.join(", ")} } from 'react-router-dom';`);
    }

    return code;
};

const injectSafetyStubs = (input) => {
    let code = typeof input === "string" ? input : "";

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
        code = code.replace(/^\s*import\s+\{?\s*useInView\s*\}?\s+from\s+['"]react-intersection-observer['"];?\s*$/gm, "");
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
    const knownGlobals = new Set(["React", "Fragment", "Suspense", "StrictMode", "BrowserRouter", "Routes", "Route", "Link", "NavLink", "Navigate", "Outlet"]);

    for (const match of code.matchAll(/import\s+([A-Z][A-Za-z0-9_$]*)\s+from\b/g)) {
        definedNames.add(match[1]);
    }
    for (const match of code.matchAll(/import\s+\{([^}]+)\}\s+from\b/g)) {
        const names = match[1].split(",").map((part) => part.trim().split(/\s+as\s+/i).pop()).filter(Boolean);
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
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`import[\\s\\S]{0,240}\\b${escaped}\\b[\\s\\S]{0,240}from\\s+['"]`, "m").test(code);
    };

    const unresolved = [...usedComponentNames].filter((name) => (
        !definedNames.has(name) &&
        !knownGlobals.has(name) &&
        !isImportedSomewhere(name)
    ));
    if (unresolved.length > 0) {
        const stubBlock = unresolved.map((name) => `const ${name} = () => null;`).join("\n");
        prependBlock(stubBlock);
    }

    return code;
};

const addImageBackgroundFallbacks = (code) => {
    let result = typeof code === "string" ? code : "";
    
    // Add background colors to img tags that don't have a parent with background
    // Pattern 1: <img src="..." without a background wrapper
    result = result.replace(
        /(<div[^>]*?)>(\s*<img[^>]*src="[^"]*"[^>]*\/>)/g,
        (match, divTag, img) => {
            // Check if div already has a bg- class
            if (/\bclass=["'].*?\bbg-/.test(divTag) || /\bclassName=["'].*?\bbg-/.test(divTag)) {
                return match; // Already has background
            }
            // Add gradient background to the div
            const gradients = [
                "bg-gradient-to-br from-blue-500 to-purple-600",
                "bg-gradient-to-r from-slate-400 to-slate-600",
                "bg-gradient-to-r from-green-500 to-teal-600",
                "bg-gradient-to-br from-orange-500 to-red-600",
                "bg-gradient-to-r from-indigo-500 to-purple-600",
                "bg-slate-300"
            ];
            const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
            return divTag.replace(/class=["']([^"]*)["']/, (m, classes) => `class="${classes} ${randomGradient}"`)
                   || divTag.replace(/className=["']([^"]*)["']/, (m, classes) => `className="${classes} ${randomGradient}"`)
                   || divTag.replace(/>/, ` className="${randomGradient}">`) + img;
        }
    );

    // Pattern 2: Standalone <img tags
    result = result.replace(
        /<img([^>]*?)src="([^"]*)"([^>]*?)\/>/g,
        (match, before, src, after) => {
            const hasBgClass = /\bbg-/.test(match);
            if (hasBgClass) return match;
            
            const gradients = [
                "bg-gradient-to-br from-blue-500 to-purple-600",
                "bg-gradient-to-r from-slate-400 to-slate-600",
                "bg-gradient-to-r from-green-500 to-teal-600",
            ];
            const randomGradient = gradients[Math.floor(Math.random() * gradients.length)];
            return `<div className="${randomGradient} overflow-hidden rounded-lg"><img${before}src="${src}"${after}/></div>`;
        }
    );

    return result;
};

const fixUnsafeCode = (input) => {
    let code = typeof input === "string" ? input : "";
    code = code.replace(/\r\n/g, "\n");

    code = code
        .split("\n")
        .filter((line) => {
            const isUnsafeImport = /^\s*import\s+.*from\s+['"](null|undefined|)['"]\s*;?\s*$/.test(line);
            const isUnsafeRequire = /require\(\s*(null|undefined|['"]['"])\s*\)/.test(line);
            const isNodeBuiltinImport = /^\s*import\s+.*from\s+['"](path|fs|os|child_process|crypto|stream|http|https|zlib)['"]\s*;?\s*$/.test(line);
            return !isUnsafeImport && !isUnsafeRequire && !isNodeBuiltinImport;
        })
        .map((line) => line.replace(/require\(\s*(null|undefined)\s*\)/g, "({})"))
        .join("\n");

    code = code.replace(/\bpath\s*:\s*(null|undefined)\b/g, 'path: "/"');
    code = code.replace(/\bpath\s*=\s*\{\s*(null|undefined)\s*\}/g, 'path="/"');
    code = code.replace(/\bpath\s*=\s*['"](null|undefined|)['"]/g, 'path="/"');
    code = code.replace(/\bpath\s*:\s*['"]\s*['"]/g, 'path: "/"');
    code = code.replace(/\bpath\s*=\s*\{\s*['"]\s*['"]\s*\}/g, 'path="/"');
    code = code.replace(/(src|href|to|action|poster)\s*=\s*\{\s*(null|undefined|['"]['"])\s*\}/g, '$1="/"');
    code = code.replace(/(src|href|to|action|poster)\s*=\s*['"](null|undefined|)['"]/g, '$1="/"');
    code = code.replace(/\b(path|to|href|src|action|poster)\s*=\s*\{\s*(null|undefined)\s*\}/g, '$1="/"');
    code = code.replace(/\b(path|to|href|src|action|poster)\s*=\s*\{\s*['"]\s*['"]\s*\}/g, '$1="/"');
    code = code.replace(/\b(path|to|href|src|action|poster)\s*=\s*['"](null|undefined|)['"]/g, '$1="/"');
    code = code.replace(/<\/n\s*(?=\n\s*<\/)/g, "");
    code = code.replace(/<\/n\s*>/g, "");
    code = code.replace(/<\/n(?!av\b|oscript\b)/gi, "");
    code = code.replace(/(<p\b[^>]*>[^<]*)(\s*)(<\/(?!p\b)[^>]+>)/g, "$1</p>\n$2$3");
    code = code.replace(/new URL\(\s*(null|undefined)\s*,/g, 'new URL(".",');
    code = repairMismatchedJsxTags(code);
    code = ensureLibraryImports(code);
    code = injectSafetyStubs(code);
    code = fixClassContrast(code);
    code = addImageBackgroundFallbacks(code); // Add solid backgrounds to images

    return code;
};

const stripMarkdownCodeFences = (value) => {
    const input = typeof value === "string" ? value : "";
    const trimmed = input.trim();
    if (!trimmed.startsWith("```")) return trimmed;
    return trimmed.replace(/^```[a-zA-Z]*\s*/i, "").replace(/```$/i, "").trim();
};

const extractFirstCompleteJsonObject = (value) => {
    const input = typeof value === "string" ? value : "";
    const start = input.indexOf("{");
    if (start === -1) return input.trim();

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = start; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                continue;
            }
            if (ch === '"') {
                inString = false;
            }
            continue;
        }

        if (ch === '"') {
            inString = true;
            continue;
        }
        if (ch === "{") {
            depth += 1;
            continue;
        }
        if (ch === "}") {
            depth -= 1;
            if (depth === 0) {
                return input.slice(start, i + 1).trim();
            }
        }
    }

    return input.substring(start).trim();
};

const escapeJsonControlChars = (value) => {
    const input = typeof value === "string" ? value : "";
    let out = "";
    let inString = false;
    let escaped = false;

    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (inString) {
            if (escaped) {
                escaped = false;
                out += ch;
                continue;
            }
            if (ch === "\\") {
                escaped = true;
                out += ch;
                continue;
            }
            if (ch === '"') {
                inString = false;
                out += ch;
                continue;
            }
            if (ch === "\n") {
                out += "\\n";
                continue;
            }
            if (ch === "\r") {
                out += "\\r";
                continue;
            }
            if (ch === "\t") {
                out += "\\t";
                continue;
            }
        } else if (ch === '"') {
            inString = true;
        }
        out += ch;
    }

    return out;
};

const tryParseJson = (value) => {
    const text = extractFirstCompleteJsonObject(stripMarkdownCodeFences(value));

    try {
        return JSON.parse(text);
    } catch (parseError) {
        let fixed = escapeJsonControlChars(text.trim());
        const quotesMatch = fixed.match(/(^|[^\\])"/g);
        if (quotesMatch && quotesMatch.length % 2 !== 0) {
            fixed += '"';
        }
        fixed = fixed.replace(/,\s*([\]}])/g, "$1");
        fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

        const openBraces = (fixed.match(/\{/g) || []).length;
        const closeBraces = (fixed.match(/\}/g) || []).length;
        if (openBraces > closeBraces) {
            fixed += "}".repeat(openBraces - closeBraces);
        }

        const openBrackets = (fixed.match(/\[/g) || []).length;
        const closeBrackets = (fixed.match(/\]/g) || []).length;
        if (openBrackets > closeBrackets) {
            fixed += "]".repeat(openBrackets - closeBrackets);
        }

        return JSON.parse(fixed);
    }
};

const coerceFilesShape = (files) => {
    if (!files) return {};

    if (Array.isArray(files)) {
        const next = {};
        for (const entry of files) {
            if (!entry || typeof entry !== "object") continue;
            const path =
                typeof entry.path === "string" ? entry.path :
                typeof entry.filePath === "string" ? entry.filePath :
                typeof entry.filename === "string" ? entry.filename :
                "";
            if (!path) continue;
            next[path] = {
                code:
                    (typeof entry.code === "string" && entry.code) ||
                    (typeof entry.content === "string" && entry.content) ||
                    (typeof entry.text === "string" && entry.text) ||
                    toCodeString(entry)
            };
        }
        return next;
    }

    if (typeof files === "object") {
        if (files.files && typeof files.files === "object") return files.files;
        return files;
    }

    return {};
};

const normalizeFilesMap = (rawFiles) => {
    const coerced = coerceFilesShape(rawFiles);
    const normalizedFiles = {};

    Object.entries(coerced || {}).forEach(([rawPath, rawContent]) => {
        let candidatePath = rawPath;
        if ((!candidatePath || !String(candidatePath).trim()) && rawContent && typeof rawContent === "object") {
            candidatePath =
                (typeof rawContent.path === "string" && rawContent.path) ||
                (typeof rawContent.filePath === "string" && rawContent.filePath) ||
                (typeof rawContent.filename === "string" && rawContent.filename) ||
                "";
        }

        const absolutePath = toAbsolutePath(candidatePath);
        if (!hasValidPath(absolutePath)) return;

        const code = fixUnsafeCode(toCodeString(rawContent));
        if (!code.trim()) return;
        normalizedFiles[absolutePath] = { code };
    });

    return normalizedFiles;
};

const buildReadme = (projectTitle) => {
    const title = typeof projectTitle === "string" && projectTitle.trim()
        ? projectTitle.trim()
        : "Elisa AI Project";

    return [
        `# ${title}`,
        "",
        "## Run Locally",
        "1. Install dependencies:",
        "   npm install",
        "2. Start the dev server:",
        "   npm run dev",
        "",
        "## Build For Production",
        "1. Create a production build:",
        "   npm run build",
        "2. Preview the build locally:",
        "   npm run preview",
        ""
    ].join("\n");
};

const withTimeout = async (promise, ms, label) => {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
        timer = setTimeout(() => {
            reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
        }, ms);
    });

    try {
        return await Promise.race([promise, timeoutPromise]);
    } finally {
        clearTimeout(timer);
    }
};

const ensureFile = (files, path, code) => {
    if (!files[path] || !toCodeString(files[path]).trim()) {
        files[path] = { code };
    }
};

const normalizePackageJson = (files) => {
    const fallbackPackageJson = {
        name: "generated-project",
        private: true,
        version: "1.0.0",
        type: "module",
        scripts: {
            dev: "vite",
            build: "vite build",
            preview: "vite preview"
        },
        dependencies: REQUIRED_DEPENDENCIES,
        devDependencies: {
            vite: "latest",
            "@vitejs/plugin-react": "latest"
        }
    };

    const rawPackage = toCodeString(files["/package.json"]);
    if (!rawPackage.trim()) {
        files["/package.json"] = { code: JSON.stringify(fallbackPackageJson, null, 2) };
        return;
    }

    try {
        const parsed = JSON.parse(rawPackage);
        const rawDependencies = parsed?.dependencies && typeof parsed.dependencies === "object"
            ? parsed.dependencies
            : {};
        const sanitizedDependencies = {};

        Object.entries(rawDependencies).forEach(([name, version]) => {
            const normalizedName = DEPENDENCY_ALIASES[name] || name;
            if (!Object.prototype.hasOwnProperty.call(REQUIRED_DEPENDENCIES, normalizedName)) {
                return;
            }
            sanitizedDependencies[normalizedName] = version;
        });

        const normalized = {
            ...parsed,
            private: true,
            version: parsed?.version || "1.0.0",
            type: parsed?.type || "module",
            scripts: {
                dev: "vite",
                build: "vite build",
                preview: "vite preview",
                ...(parsed?.scripts || {})
            },
            dependencies: {
                ...REQUIRED_DEPENDENCIES,
                ...sanitizedDependencies
            },
            devDependencies: {
                vite: "latest",
                "@vitejs/plugin-react": "latest",
            }
        };
        files["/package.json"] = { code: JSON.stringify(normalized, null, 2) };
    } catch {
        files["/package.json"] = { code: JSON.stringify(fallbackPackageJson, null, 2) };
    }
};

export async function POST(req) {
    const body = await req.json();
    const prompt = body?.prompt;
    const safePrompt = typeof prompt === "string" ? prompt : JSON.stringify(prompt ?? "");
    
    // Use enhanced prompt generation for better quality
    const effectivePrompt = enhancePromptForBetterGeneration(safePrompt);

    try {
        let session = model.startChat({
            generationConfig: CodeGenerationConfig,
            history: [],
        });

        const finalPrompt = `${effectivePrompt}\n\n${SERVER_GENERATION_GUARDRAILS}`;

        let result;
        try {
            result = await withTimeout(
                sendMessageWithRetry(session, finalPrompt),
                AI_TIMEOUT_MS,
                "Generation"
            );
        } catch (retryError) {
            console.error("Primary model failed in gen-ai-code, trying fallback...", retryError.message);
            // Re-initialize session with fallback model
            session = fallbackModel.startChat({
                generationConfig: CodeGenerationConfig,
                history: [],
            });
            result = await withTimeout(
                sendMessageWithRetry(session, finalPrompt, 2),
                AI_TIMEOUT_MS,
                "Fallback Generation"
            );
        }

        const jsonResponse = tryParseJson(result.response.text());
        if (!jsonResponse || typeof jsonResponse !== "object") {
            throw new Error("AI returned an invalid response format.");
        }
        if (!jsonResponse.files) {
            throw new Error("AI response is missing the 'files' data.");
        }

        const allFiles = normalizeFilesMap(jsonResponse.files);
        if (Object.keys(allFiles).length === 0) {
            throw new Error("AI returned files, but all file paths were invalid.");
        }

        const commonLucideIcons = ["Menu", "X", "MapPin", "Phone", "Mail", "Clock", "ChevronRight", "ChevronLeft", "Star", "User", "ShoppingCart", "Search", "Bell", "Settings", "LogOut", "Trash", "Edit", "Plus", "Check", "AlertCircle", "Info", "ExternalLink", "Github", "Twitter", "Facebook", "Instagram", "Linkedin", "ArrowRight", "ArrowLeft", "Play", "Pause", "Heart", "Share2", "Globe", "Download", "Cloud", "Lock", "Unlock", "Eye", "EyeOff", "Calendar", "Filter", "Layout", "Grid", "List", "Zap", "Award", "Target", "Activity", "BarChart", "PieChart", "FileText", "Image", "Video", "Music", "Camera", "Mic", "Monitor", "Smartphone", "Tablet", "Laptop", "Server", "Database", "Cpu", "Terminal", "Code", "Layers", "Boxes", "Box", "Package", "Truck", "Gift", "CreditCard", "DollarSign", "Briefcase", "BookOpen", "GraduationCap", "Coffee", "Utensils", "Pizza", "GlassWater", "Plane", "Map", "Navigation", "Compass", "Sun", "Moon", "CloudRain", "Wind", "Thermometer", "Droplets", "Umbrella", "HelpCircle", "MessageSquare", "Send", "ThumbsUp", "ThumbsDown", "UserPlus", "UserMinus", "Users", "UserCheck", "UserX", "Shield", "ShieldCheck", "ShieldAlert", "ShieldOff", "Flag", "Tag", "Bookmark", "Flame", "Sparkles", "Ghost", "Smile", "Frown", "Meh", "Angry", "Laugh", "Wink", "Dizzy", "Hand", "Fingerprint", "Wifi", "Bluetooth", "Battery", "Cast", "Tv", "Speaker", "Headphones", "Mic2", "Radio", "Volume2", "VolumeX", "Maximize2", "Minimize2", "Crop", "RotateCw", "RotateCcw", "RefreshCw", "RefreshCcw", "Hash", "AtSign", "Percent", "Divide", "Equal", "PlusCircle", "MinusCircle", "XCircle", "CheckCircle", "AlertTriangle", "Loader2"];

        for (const filePath of Object.keys(allFiles)) {
            let code = toCodeString(allFiles[filePath]);
            const iconsToImport = commonLucideIcons.filter((icon) => {
                const isUsed = new RegExp(`<${icon}\\b`).test(code);
                const importsBlock = code.split("\n").filter((line) => line.trim().startsWith("import")).join("\n");
                const isAlreadyImported = new RegExp(`\\b${icon}\\b`).test(importsBlock);
                return isUsed && !isAlreadyImported;
            });

            if (iconsToImport.length > 0) {
                const importStatement = `import { ${iconsToImport.join(", ")} } from 'lucide-react';\n`;
                if (code.includes("'use client'") || code.includes('"use client"')) {
                    code = code.replace(/('|")use client('|");?/, (match) => `${match}\n${importStatement}`);
                } else {
                    code = importStatement + code;
                }
            }

            const pexelsRegex = /https:\/\/images\.pexels\.com\/photos\/search\?query=([a-zA-Z0-9%+\-_.]+)(&orientation=(landscape|portrait|square))?/g;
            const matches = [...code.matchAll(pexelsRegex)];
            if (matches.length > 0) {
                const replacements = await Promise.all(matches.map(async (match) => {
                    const fullUrl = match[0];
                    const query = match[1];
                    const orientation = match[3] || "landscape";
                    const imageUrl = await getPexelsImage(query, orientation);
                    return { fullUrl, imageUrl };
                }));

                replacements.forEach(({ fullUrl, imageUrl }) => {
                    if (!imageUrl) return;
                    code = code.split(fullUrl).join(imageUrl);
                });
            }

            code = code.replace(/https?:\/\/via\.placeholder\.com\/(\d+)x?(\d+)?[^"'\s)}\]`]*/g, (_, w, h) => `https://picsum.photos/${w || 800}/${h || w || 600}?random=${Math.floor(Math.random() * 10000)}`);
            code = code.replace(/https?:\/\/placehold\.co\/(\d+)x?(\d+)?[^"'\s)}\]`]*/g, (_, w, h) => `https://picsum.photos/${w || 800}/${h || w || 600}?random=${Math.floor(Math.random() * 10000)}`);
            code = code.replace(/https?:\/\/placeholder\.com\/(\d+)x?(\d+)?[^"'\s)}\]`]*/g, (_, w, h) => `https://picsum.photos/${w || 800}/${h || w || 600}?random=${Math.floor(Math.random() * 10000)}`);

            allFiles[filePath] = { code: fixUnsafeCode(code) };
        }

        ensureFile(allFiles, "/index.html", DEFAULT_ENTRY_HTML);
        ensureFile(allFiles, "/index.jsx", DEFAULT_INDEX_JSX);
        ensureFile(allFiles, "/App.jsx", DEFAULT_APP_JSX);
        ensureFile(allFiles, "/styles.css", DEFAULT_STYLES);
        
        normalizePackageJson(allFiles);

        if (!allFiles["/README.md"]) {
            allFiles["/README.md"] = { code: buildReadme(jsonResponse.projectTitle) };
        }

        return NextResponse.json({
            projectTitle: typeof jsonResponse.projectTitle === "string" && jsonResponse.projectTitle.trim()
                ? jsonResponse.projectTitle.trim()
                : "AI Website",
            explanation: typeof jsonResponse.explanation === "string" && jsonResponse.explanation.trim()
                ? jsonResponse.explanation.trim()
                : "Generated a complete website project.",
            files: allFiles,
            generatedFiles: Object.keys(allFiles)
        });
    } catch (error) {
        console.error("Code Generation API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
