import { NextResponse } from "next/server";
import { parse as parseBabel } from "@babel/parser";
import { model, CodeGenerationConfig, sendMessageWithRetry, isTransientAiError } from "@/configs/AiModel";
import { getPexelsImage } from "@/lib/pexels";

const AI_TIMEOUT_MS = 115000;
const FALLBACK_AI_TIMEOUT_MS = 55000;
const REPAIR_TIMEOUT_MS = 40000;
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
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" />
    <script>
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
              muted: "var(--muted)",
              "muted-foreground": "var(--muted-foreground)",
              border: "var(--border)",
              input: "var(--input)"
            }
          }
        }
      };
    </script>
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
CRITICAL REQUIREMENTS:
- Return a content-rich, valid Vite React website with correct JSON formatting.
- Valid JSX and working imports matter more than extra sections or effects.
- Use only approved dependencies: react, react-dom, framer-motion, lucide-react, react-router-dom, axios, clsx, tailwind-merge, tailwindcss-animate.
- Use default exports for local components and import them with default imports.
- Do not use gsap, heroicons, react-intersection-observer, react-router-hash-link, node builtins, or unknown packages.
- JSX style props must always be objects like style={{ marginRight: "1rem" }}, never strings like style="margin-right: 1rem".
- Never output null, undefined, or empty-string values for paths, href, src, to, or route path values.
- Footer must be fully valid and theme-matched.
- Footer must not depend on icon components or external social icon packages. Use plain text links or simple inline spans so Footer can never crash from undefined icons.
- Define custom theme tokens before using classes such as bg-background, text-foreground, text-primary, border-border, or text-muted-foreground.
- /styles.css must include readable body defaults, image/form defaults, and any CSS variables used by the generated JSX.
- Respect explicit architecture requests: if the user asks for single-page, build one rich single-page site; if the user asks for multi-page, build multi-page.
- If the user does not specify architecture, choose what fits the site and vary across generations. Simple landing/product prompts may be single-page; corporate, restaurant, portfolio, agency, real estate, event, travel, education, and service-business prompts should often be multi-page.
- Single-page sites must still feel complete with 6-9 substantial home sections.
- Multi-page sites must include a rich home page plus meaningful page content, not empty shells.
- Use plain <a href="#section-id"> links for single-page sites.
- Use react-router-dom only for explicit or intentionally chosen multi-page/routed projects.
- If routing is explicitly required: exactly one BrowserRouter is allowed, and it must be in /index.jsx wrapping <App />. No other file may render BrowserRouter.
- Never use Router, HashRouter, MemoryRouter, unstable_HistoryRouter, RouterProvider, createBrowserRouter, or aliased router components.
- In routed projects, /App.jsx may use Routes, Route, Link, NavLink, Navigate, and Outlet, but must never import or render BrowserRouter.
- Navbar/Footer/components must not render any router provider. They may use Link/NavLink only in routed projects; otherwise use <a> tags.
- Before returning JSON, run a routing self-audit: the generated code must contain either zero router providers or exactly one <BrowserRouter> in /index.jsx.
- Every website must include a Contact experience. In single-page sites, include a full #contact section. In multi-page sites, include a /contact route/page. Contact must include a styled form, email/phone/location details, and a visible map.
- The contact map is mandatory. Use a visible OpenStreetMap iframe with a valid src, or a polished static map-style panel if iframe is risky.
- Home page must include at least 6 and preferably 7-9 meaningful sections such as hero, social proof/stats, features/services, process/how it works, showcase/gallery, testimonials, pricing/menu/team/FAQ depending on the domain, CTA, and contact preview.
- The hero section is the most important part of the website. It must look premium, modern, and intentional in the first viewport.
- Hero layout must use one clear composition: split text/media, full-bleed image with dark overlay, or centered editorial hero. Do not randomly layer cards/images over the headline.
- Hero headline, subheading, image, and CTA must never overlap or cover each other on desktop, tablet, or mobile.
- Hero must have a strong visual hook: a real relevant HTTPS image, dramatic background treatment, product/site-specific visual, or polished media collage with safe spacing.
- Hero CTA buttons must be clearly visible, aligned, clickable, and separated from imagery.
- Avoid giant text crossing over foreground images, tiny CTAs floating inside images, circular image masks, giant rings, orbit frames, cramped collages, and decorative frames that cover readable text.
- Do not place a hero image inside a circle. Prefer rectangular editorial image panels, full-bleed image backgrounds, asymmetric split layouts, or realistic product/device mockups.
- Do not use text-transparent or bg-clip-text for critical readable text such as hero headings unless you also provide a plain visible fallback color class.
- Use many relevant visuals where they help the domain: hero, gallery/showcase, cards, team, testimonials, product/service, venue/location, and CTA sections.
- Keep the implementation compact enough to stay syntactically safe; prefer a smaller valid layout over a larger broken one.
- Before responding, verify that every JSX opening tag is closed, every file parses cleanly, and no file ends mid-element or mid-attribute.
- Every image must have a real HTTPS URL, useful alt text, and stable sizing. Do not leave broken placeholders.
- Prefer the Pexels search placeholder pattern for images so the server can resolve them: https://images.pexels.com/photos/search?query=specific+domain+keyword&orientation=landscape. Use distinct, specific keywords per image and avoid reusing the same image URL.
- Match image orientation to layout: landscape for hero/banners/galleries, portrait for people/team, square for cards/logos/products.
- Never render the raw chat history, JSON prompt, file list, or internal instructions as page copy. Convert the user's request into normal marketing copy.
- Avoid washed-out white-on-white sections, checkerboard backgrounds, invisible text, and ultra-low-contrast cards.
- Design must vary by website type. Choose colors, typography, layout, spacing, imagery, and components based on the domain instead of reusing the same palette or structure.
- Before responding, verify that file paths exist, JSX tags are balanced, and JSON parses cleanly.
`;

const enhancePromptForBetterGeneration = (userPrompt, isUpdate = false) => {
  const basePrompt = (userPrompt && typeof userPrompt === "string" && userPrompt.trim()) 
    ? userPrompt 
    : "Create a modern, responsive, content-rich multi-page website";

  return `${basePrompt}

GENERATION PRIORITIES:
- Valid JSX and correct imports matter more than visual complexity.
- Generate a rich website, not a tiny demo. Home page must have 6-9 meaningful sections.
- Respect explicit single-page or multi-page requests. If unspecified, choose the architecture that best fits the domain and vary architecture across generations.
- Always include contact with form and map. For routed projects, create a /contact page. For single-page projects, create a substantial #contact section.
- For multi-page projects, use one routing provider only: BrowserRouter in /index.jsx, never in /App.jsx or components.
- Make the hero section exceptional: bold readable headline, clear CTA, strong relevant visual, and no overlapping text/media.
- Use a safe hero structure such as a two-column grid with text on one side and media on the other, or a full-bleed background image with a dark overlay and centered text.
- Do not use circular hero image masks, giant rings, orbit frames, or decorative circles over hero media.
- Use distinct relevant images and varied visual direction for this specific domain.
- Use only the approved dependencies.
- ${isUpdate ? "Modify only the necessary files and preserve the existing design/system." : "Deliver a polished result with enough content depth to feel complete."}`;
};

const buildFastFallbackPrompt = (userPrompt, isUpdate = false) => {
    const basePrompt = (userPrompt && typeof userPrompt === "string" && userPrompt.trim())
        ? userPrompt.trim()
        : "Create a modern responsive website";

    return `${basePrompt}

FAST FALLBACK MODE:
- Respond faster by keeping the project compact and reliable.
- Generate only essential files for a valid Vite React website.
- Generate a single-page anchored website unless the user explicitly asked for multiple pages, but still include 6 meaningful sections.
- Include a visible contact form and map section even in fallback mode.
- Do not use react-router-dom in fallback mode unless explicit multi-page routing is required.
- Prioritize valid JSX, correct imports, and clean rendering over visual complexity.
- Still make the hero polished and readable: no overlapping text/image layers, visible CTA, strong contrast, and one relevant visual.
- ${isUpdate ? "Modify only the smallest necessary surface area of the existing project." : "Keep the file count minimal and the structure simple."}`;
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

const REACT_HOOK_NAMES = [
    "useState",
    "useEffect",
    "useMemo",
    "useCallback",
    "useRef",
    "useContext",
    "useReducer",
    "useLayoutEffect",
    "useImperativeHandle",
    "useTransition",
    "useDeferredValue",
    "useId"
];

const ensureReactImports = (input) => {
    let code = typeof input === "string" ? input : "";
    if (!code.trim()) return code;

    const hookMatches = REACT_HOOK_NAMES.filter((hook) => new RegExp(`\\b${hook}\\s*\\(`).test(code));
    if (hookMatches.length === 0) {
        return code;
    }

    const reactImportMatch = code.match(/^import\s+(.+?)\s+from\s+['"]react['"];?\s*$/m);
    if (!reactImportMatch) {
        const importStatement = `import React, { ${hookMatches.join(", ")} } from "react";`;
        const useClientMatch = code.match(/^(['"])use client\1;?\s*/);
        if (useClientMatch) {
            return `${useClientMatch[0]}${importStatement}\n${code.slice(useClientMatch[0].length)}`;
        }
        return `${importStatement}\n${code}`;
    }

    const existingClause = reactImportMatch[1].trim();
    const defaultImportMatch = existingClause.match(/^([A-Za-z_$][\w$]*)\s*(?:,|$)/);
    const defaultImport = defaultImportMatch?.[1] || "React";
    const namedImportsMatch = existingClause.match(/\{([^}]+)\}/);
    const existingNamedImports = namedImportsMatch
        ? namedImportsMatch[1].split(",").map((part) => part.trim()).filter(Boolean)
        : [];

    const mergedNamedImports = [...new Set([...existingNamedImports, ...hookMatches])].sort();
    const nextClause = mergedNamedImports.length > 0
        ? `${defaultImport}, { ${mergedNamedImports.join(", ")} }`
        : defaultImport;

    return code.replace(reactImportMatch[0], `import ${nextClause} from "react";\n`);
};

const normalizeRelativeComponentImports = (input) => {
    let code = typeof input === "string" ? input : "";
    code = code.replace(
        /^\s*import\s+\{\s*([A-Z][A-Za-z0-9_$]*)\s*\}\s+from\s+(['"])(\.[^'"]+)\2\s*;?\s*$/gm,
        'import $1 from $2$3$2;'
    );
    return code;
};

const cssPropertyToJsxKey = (property) => {
    const trimmed = String(property || "").trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("--")) return JSON.stringify(trimmed);
    return trimmed.replace(/-([a-z])/g, (_, char) => char.toUpperCase());
};

const cssTextToJsxStyleObject = (styleText) => {
    const entries = String(styleText || "")
        .split(";")
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
            const colonIndex = part.indexOf(":");
            if (colonIndex === -1) return null;
            const key = cssPropertyToJsxKey(part.slice(0, colonIndex));
            const value = part.slice(colonIndex + 1).trim().replace(/\s*!important\s*$/i, "");
            if (!key || !value) return null;
            return `${key}: ${JSON.stringify(value)}`;
        })
        .filter(Boolean);
    return entries.length > 0 ? `{ ${entries.join(", ")} }` : "{}";
};

const fixStringStyleProps = (input) => {
    let code = typeof input === "string" ? input : "";
    return code.replace(/\bstyle\s*=\s*(["'])([^"'\n{}]*)\1/g, (_, quote, styleText) => {
        const styleObject = cssTextToJsxStyleObject(styleText);
        return `style={${styleObject}}`;
    });
};

const hardenFooterSource = (path, input) => {
    const filePath = typeof path === "string" ? path : "";
    let code = typeof input === "string" ? input : "";
    if (!/\/Footer\.(jsx|tsx|js|ts)$/i.test(filePath)) {
        return code;
    }

    code = code.replace(
        /^\s*import\s+\{\s*([^}]+)\}\s+from\s+['"]react-router-dom['"]\s*;?\s*$/gm,
        (_, imports) => {
            const kept = String(imports)
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean)
                .filter((name) => name !== "Link");
            return kept.length > 0 ? `import { ${kept.join(", ")} } from "react-router-dom";` : "";
        }
    );
    code = code.replace(/<Link\b/g, "<a");
    code = code.replace(/\bto=/g, "href=");
    code = code.replace(/<\/Link>/g, "</a>");
    code = code.replace(/^\s*import\s+.*\s+from\s+['"](@heroicons\/[^'"]+|react-icons\/[^'"]+|lucide-react)['"];?\s*$/gm, "");
    const footerIconFallback = '<span aria-hidden="true" className="inline-block h-4 w-4 shrink-0 rounded-full bg-current opacity-70" />';
    code = code.replace(/<([A-Z][A-Za-z0-9_$]*)\b[^>]*\/>/g, (match, name) => {
        if (name === "Footer") return match;
        return footerIconFallback;
    });
    code = code.replace(/<([A-Z][A-Za-z0-9_$]*)\b[^>]*>\s*<\/\1>/g, (match, name) => {
        if (name === "Footer") return match;
        return footerIconFallback;
    });
    return code;
};

const isLikelyReactSourceFile = (path) => typeof path === "string" && /\.(jsx|tsx|js|ts)$/i.test(path);

const getJsxParseIssues = (path, input) => {
    const code = typeof input === "string" ? input : "";
    if (!isLikelyReactSourceFile(path) || !code.trim()) return [];

    const plugins = ["jsx", "topLevelAwait", "importMeta"];
    if (/\.(ts|tsx)$/i.test(path)) {
        plugins.push("typescript");
    }

    try {
        parseBabel(code, {
            sourceType: "module",
            plugins,
        });
        return [];
    } catch (error) {
        const message = String(error?.message || error || "Unknown JSX parse error").split("\n")[0];
        return [`Syntax error: ${message}`];
    }
};

const collectGeneratedFileIssues = (path, input) => {
    const code = typeof input === "string" ? input : "";
    const issues = [];

    if (!code.trim()) {
        issues.push("File is empty.");
        return issues;
    }

    if (isLikelyReactSourceFile(path)) {
        const missingHooks = REACT_HOOK_NAMES.filter((hook) => {
            const usesHook = new RegExp(`\\b${hook}\\s*\\(`).test(code);
            const importsHook = new RegExp(`import[\\s\\S]{0,200}\\b${hook}\\b[\\s\\S]{0,200}from\\s+['"]react['"]`, "m").test(code);
            return usesHook && !importsHook;
        });

        if (missingHooks.length > 0) {
            issues.push(`Missing React hook imports: ${missingHooks.join(", ")}.`);
        }

        if (/<[A-Za-z][^>\n]*\n\s*<\/?[A-Za-z]/.test(code)) {
            issues.push("Found a JSX opening tag that appears to be missing its closing `>` before the next tag.");
        }

        if (/<[A-Za-z][^>]*\sclassName="[^"]*"\s*$/.test(code)) {
            issues.push("Found a JSX tag line that ends before the opening tag is closed.");
        }

        if (/:\s*"[^"\n]*"[A-Za-z][^"\n]*"/.test(code)) {
            issues.push("Found a JavaScript string literal with an unescaped double quote inside it.");
        }

        const openTags = (code.match(/<([A-Za-z][\w.:]*)\b(?![^>]*\/>)/g) || []).length;
        const closeTags = (code.match(/<\/([A-Za-z][\w.:]*)>/g) || []).length;
        if (Math.abs(openTags - closeTags) >= 3) {
            issues.push("JSX tag counts look unbalanced, which usually means a mismatched or missing closing tag.");
        }

        issues.push(...getJsxParseIssues(path, code));
    }

    return issues;
};

const collectProblemFiles = (files) => {
    const problems = [];
    Object.entries(files || {}).forEach(([path, content]) => {
        const code = toCodeString(content);
        const issues = collectGeneratedFileIssues(path, code);
        if (issues.length > 0) {
            problems.push({ path, code, issues });
        }
    });
    return problems;
};

const repairProblemFiles = async (files) => {
    const problems = collectProblemFiles(files).slice(0, 6);
    if (problems.length === 0) {
        return files;
    }

    const session = model.startChat({
        generationConfig: CodeGenerationConfig,
        history: [],
    });

    const repairPrompt = [
        "You are repairing invalid React/Vite files that were just generated.",
        "Return ONLY a JSON object that matches the schema.",
        "Do not redesign the project. Do not add new features. Do not change unaffected files.",
        "Fix only the listed files so they become syntactically valid and keep the same intent/content.",
        "Important: preserve existing imports unless they are wrong, import missing React hooks from react, close every JSX tag correctly, and escape quotes inside JavaScript strings.",
        "",
        "FILES TO REPAIR:",
        ...problems.map((problem, index) => [
            `${index + 1}. Path: ${problem.path}`,
            `Issues: ${problem.issues.join(" ")}`,
            `Code: ${JSON.stringify(problem.code)}`
        ].join("\n")),
        "",
        "Return only the repaired files in the `files` array. Use absolute file paths."
    ].join("\n");

    try {
        const result = await withTimeout(
            sendMessageWithRetry(session, repairPrompt, 2),
            REPAIR_TIMEOUT_MS,
            "Repair generation"
        );

        const repairResponse = tryParseJson(result.response.text());
        const repairedFiles = normalizeFilesMap(repairResponse?.files);
        if (Object.keys(repairedFiles).length === 0) {
            return files;
        }

        return {
            ...files,
            ...repairedFiles
        };
    } catch (error) {
        console.warn("Repair generation skipped:", error?.message || error);
        return files;
    }
};

const requestGeneratedProject = async (promptText, timeoutMs, label, maxRetries = 1) => {
    const session = model.startChat({
        generationConfig: CodeGenerationConfig,
        history: [],
    });

    return withTimeout(
        sendMessageWithRetry(session, promptText, maxRetries),
        timeoutMs,
        label
    );
};

const fixClassContrast = (code) => {
    const input = typeof code === "string" ? code : "";
    if (!input) return input;

    const darkBg = /\bbg-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightBg = /\bbg-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50)\b/;
    const darkText = /\btext-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightText = /\btext-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50|gray-100|slate-100)\b/;
    const paleTextOnLight = /\btext-(slate|gray|neutral|zinc|stone)-(200|300|400|500)\b/;

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
        if (lightBg.test(next) && paleTextOnLight.test(next)) {
            next = next.replace(/\btext-(slate|gray|neutral|zinc|stone)-200\b/g, "text-slate-700");
            next = next.replace(/\btext-(slate|gray|neutral|zinc|stone)-300\b/g, "text-slate-700");
            next = next.replace(/\btext-(slate|gray|neutral|zinc|stone)-400\b/g, "text-slate-700");
            next = next.replace(/\btext-(slate|gray|neutral|zinc|stone)-500\b/g, "text-slate-700");
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

const sanitizeUnsupportedLibraries = (input) => {
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

    if (/from\s+['"]react-router-hash-link['"]/.test(code)) {
        code = code.replace(/^[ \t]*import[^\n]*from\s+['"]react-router-hash-link['"];?[ \t]*$/gm, "");
        code = code.replace(/\s+smooth(?=[\s>])/g, "");
        code = code.replace(/\s+scroll\s*=\s*\{[^}]*\}/g, "");
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
        const stubBlock = unresolved.map((name) => buildVisibleComponentStub(name)).join("\n\n");
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
    code = ensureReactImports(code);
    code = normalizeRelativeComponentImports(code);
    code = fixStringStyleProps(code);
    code = sanitizeUnsupportedLibraries(code);
    code = repairMismatchedJsxTags(code);

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

    code = fixClassContrast(code);
    code = addImageBackgroundFallbacks(code); // Add solid backgrounds to images

    return code;
};

const inferProjectTitleFromPrompt = (prompt) => {
    const input = typeof prompt === "string" ? prompt.trim() : "";
    if (!input) return "AI Website";
    const cleaned = input
        .replace(/[^a-zA-Z0-9\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    const words = cleaned.split(" ").filter(Boolean).slice(0, 4);
    return words.length > 0 ? words.join(" ") : "AI Website";
};

const buildEmergencyFallbackProject = (prompt) => {
    const lead = extractReadablePromptSummary(prompt);
    const projectTitle = inferProjectTitleFromPrompt(lead);

    const files = {
        "/index.html": { code: DEFAULT_ENTRY_HTML },
        "/index.jsx": { code: DEFAULT_INDEX_JSX },
        "/styles.css": { code: `:root {
  color-scheme: dark;
}
* {
  box-sizing: border-box;
}

html, body, #root {
  min-height: 100%;
}

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  background:
    radial-gradient(circle at top, rgba(132, 204, 22, 0.22), transparent 35%),
    linear-gradient(180deg, #04070f 0%, #071120 100%);
  color: #f8fafc;
}

a {
  color: inherit;
  text-decoration: none;
}
` },
        "/components/Navbar.jsx": { code: `import React from "react";

const navItems = ["Features", "Solutions", "Contact"];

function Navbar() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="text-xl font-black tracking-tight text-white">${projectTitle}</div>
        <nav className="hidden gap-6 text-sm text-slate-300 md:flex">
          {navItems.map((item) => (
            <a key={item} href={\`#\${item.toLowerCase()}\`} className="transition-colors hover:text-lime-400">
              {item}
            </a>
          ))}
        </nav>
        <a href="#contact" className="rounded-full bg-lime-400 px-4 py-2 text-sm font-bold text-slate-950 transition-transform hover:-translate-y-0.5">
          Get Started
        </a>
      </div>
    </header>
  );
}

export default Navbar;` },
        "/components/Footer.jsx": { code: `import React from "react";

const footerLinks = ["Privacy", "Terms", "Support"];

function Footer() {
  return (
    <footer className="border-t border-white/10 bg-slate-950">
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 md:grid-cols-3">
        <div>
          <h3 className="text-lg font-black text-white">${projectTitle}</h3>
          <p className="mt-3 text-sm leading-6 text-slate-400">
            Reliable fallback website generated to keep preview and delivery stable.
          </p>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Links</p>
          <div className="mt-4 flex flex-col gap-2 text-sm text-slate-300">
            {footerLinks.map((item) => (
              <a key={item} href="/" className="transition-colors hover:text-lime-400">{item}</a>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-500">Contact</p>
          <p className="mt-4 text-sm text-slate-300">hello@example.com</p>
          <p className="mt-2 text-sm text-slate-400">Built to avoid generation dead-ends and keep your flow moving.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;` },
        "/App.jsx": { code: `import React from "react";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";

const highlights = [
  {
    title: "Strategy First",
    description: "A clear visual direction, strong messaging, and sections that help visitors understand the offer fast."
  },
  {
    title: "Polished Preview",
    description: "The layout is built with preview-safe markup, strong contrast, and responsive spacing."
  },
  {
    title: "Conversion Ready",
    description: "Calls to action, contact details, and proof sections are included so the site feels complete."
  }
];

const stats = [
  { value: "6+", label: "rich sections" },
  { value: "100%", label: "responsive layout" },
  { value: "24h", label: "iteration ready" }
];

const process = ["Discover", "Design", "Launch"];

const gallery = [
  "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=900&q=80",
  "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=900&q=80"
];

export default function App() {
  return (
    <div className="min-h-screen bg-transparent text-white">
      <Navbar />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-24 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">Preview Ready</p>
            <h1 className="mt-6 text-5xl font-black tracking-tight text-white md:text-7xl">
              ${projectTitle}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
              {${JSON.stringify(lead)}}
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a href="#features" className="rounded-full bg-lime-400 px-6 py-3 font-bold text-slate-950">Explore Features</a>
              <a href="#contact" className="rounded-full border border-white/15 px-6 py-3 font-bold text-white">Contact Team</a>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-white/10 bg-slate-900/70 p-3 shadow-2xl">
            <img
              src="https://images.unsplash.com/photo-1556761175-4b46a572b786?auto=format&fit=crop&w=1100&q=80"
              alt="Modern team collaborating on a website launch"
              className="h-[420px] w-full rounded-[1.5rem] object-cover"
            />
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-8">
          <div className="grid gap-4 rounded-[2rem] border border-white/10 bg-white/5 p-6 md:grid-cols-3">
            {stats.map((item) => (
              <div key={item.label} className="text-center">
                <p className="text-4xl font-black text-lime-400">{item.value}</p>
                <p className="mt-2 text-sm uppercase tracking-[0.25em] text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8 max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">Core Value</p>
            <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">A stronger starting point, even during peak demand.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {highlights.map((item) => (
              <article key={item.title} className="rounded-3xl border border-white/10 bg-slate-900/70 p-8">
                <h2 className="text-2xl font-black text-white">{item.title}</h2>
                <p className="mt-4 text-sm leading-7 text-slate-300">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="process" className="mx-auto max-w-6xl px-6 py-16">
          <div className="grid gap-6 md:grid-cols-3">
            {process.map((item, index) => (
              <article key={item} className="rounded-3xl border border-white/10 bg-white/5 p-8">
                <p className="text-sm font-black text-lime-400">0{index + 1}</p>
                <h2 className="mt-4 text-2xl font-black text-white">{item}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  A focused step that keeps the experience clear, visual, and ready to refine.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section id="showcase" className="mx-auto max-w-6xl px-6 py-16">
          <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">Showcase</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">Visual depth built in.</h2>
            </div>
            <p className="max-w-xl text-slate-300">Relevant imagery, spacious cards, and reusable sections make the fallback useful while the main AI service recovers.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {gallery.map((src, index) => (
              <img key={src} src={src} alt={\`Website showcase visual \${index + 1}\`} className="h-64 w-full rounded-3xl object-cover shadow-2xl" />
            ))}
          </div>
        </section>

        <section id="testimonials" className="mx-auto max-w-6xl px-6 py-16">
          <div className="rounded-[2rem] border border-white/10 bg-slate-900/80 p-8 md:p-12">
            <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">Client Signal</p>
            <blockquote className="mt-5 max-w-4xl text-3xl font-black leading-tight text-white md:text-5xl">
              "The site feels complete from the first preview, with enough structure to present and enough flexibility to keep improving."
            </blockquote>
            <p className="mt-6 text-slate-400">Elisa AI Preview System</p>
          </div>
        </section>

        <section id="contact" className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-slate-900/70 p-8 md:grid-cols-2 md:p-12">
            <div>
              <p className="text-sm font-black uppercase tracking-[0.35em] text-lime-400">Contact</p>
              <h2 className="mt-3 text-3xl font-black text-white md:text-5xl">Ready to keep building?</h2>
              <p className="mt-4 text-slate-300">Use this contact section as a stable base with form fields, location detail, and a visible map.</p>
              <div className="mt-6 space-y-2 text-sm text-slate-300">
                <p>Email: hello@example.com</p>
                <p>Phone: +1 (555) 010-2026</p>
                <p>Location: San Francisco, CA</p>
              </div>
              <form className="mt-8 grid gap-4">
                <input className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-500" placeholder="Your name" />
                <input className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-500" placeholder="Email address" />
                <textarea className="min-h-28 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-white placeholder:text-slate-500" placeholder="Tell us what you want to build" />
                <button className="rounded-full bg-lime-400 px-6 py-3 font-bold text-slate-950">Send Message</button>
              </form>
            </div>
            <iframe
              title="San Francisco map"
              src="https://www.openstreetmap.org/export/embed.html?bbox=-122.5149%2C37.7081%2C-122.3570%2C37.8324&layer=mapnik"
              className="min-h-[420px] w-full rounded-3xl border border-white/10"
            />
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}` },
        "/package.json": { code: JSON.stringify({
            name: "generated-project",
            private: true,
            version: "1.0.0",
            type: "module",
            scripts: { dev: "vite", build: "vite build", preview: "vite preview" },
            dependencies: REQUIRED_DEPENDENCIES,
            devDependencies: { vite: "latest", "@vitejs/plugin-react": "latest" }
        }, null, 2) }
    };

    return {
        projectTitle,
        explanation: "The AI model was unavailable, so a reliable fallback website was generated to avoid blocking preview.",
        files,
        generatedFiles: Object.keys(files)
    };
};

const DEFAULT_APP_MARKERS = [
    "Your AI website is ready",
    "Welcome to Your AI Website",
    "Your generated code will appear here."
];

const isPlaceholderAppCode = (code) => {
    const input = typeof code === "string" ? code : "";
    return DEFAULT_APP_MARKERS.some((marker) => input.includes(marker));
};

const pickPrimaryGeneratedPage = (files, excludedPaths = new Set()) => {
    const entries = Object.keys(files || {}).filter((path) => {
        if (excludedPaths.has(path)) return false;
        return /^\/pages\/.+\.(jsx|tsx|js|ts)$/i.test(path);
    });

    const preferred = [
        "/pages/HomePage.jsx",
        "/pages/Home.jsx",
        "/pages/LandingPage.jsx",
        "/pages/Index.jsx"
    ];
    for (const path of preferred) {
        if (entries.includes(path)) return path;
    }
    return entries[0] || "";
};

const buildAppShellFromPage = (pagePath, options = {}) => {
    const normalizedPath = typeof pagePath === "string" ? pagePath : "";
    if (!normalizedPath) return "";

    const includeNavbar = options.includeNavbar !== false;
    const includeFooter = options.includeFooter !== false;
    const importPath = normalizedPath.replace(/^\//, "./");

    return `import React from "react";
${includeNavbar ? 'import Navbar from "./components/Navbar.jsx";\n' : ''}${includeFooter ? 'import Footer from "./components/Footer.jsx";\n' : ''}import GeneratedPage from "${importPath}";

export default function App() {
  return (
    <>
      ${includeNavbar ? "<Navbar />" : ""}
      <GeneratedPage />
      ${includeFooter ? "<Footer />" : ""}
    </>
  );
}`;
};

const salvagePreviewableFiles = (files, prompt) => {
    const next = { ...(files || {}) };
    const problems = collectProblemFiles(next);
    const problemPaths = new Set(problems.map((item) => item.path));

    const pagePath = pickPrimaryGeneratedPage(next, problemPaths);
    const hasNavbar = Boolean(next["/components/Navbar.jsx"]);
    const hasFooter = Boolean(next["/components/Footer.jsx"]);

    if (pagePath) {
        next["/App.jsx"] = {
            code: hardenFooterSource(
                "/App.jsx",
                fixUnsafeCode(buildAppShellFromPage(pagePath, { includeNavbar: hasNavbar, includeFooter: hasFooter }))
            )
        };
    } else if (!next["/App.jsx"] || isPlaceholderAppCode(toCodeString(next["/App.jsx"]))) {
        const fallback = buildEmergencyFallbackProject(prompt);
        next["/App.jsx"] = fallback.files["/App.jsx"];
        if (!next["/components/Navbar.jsx"]) next["/components/Navbar.jsx"] = fallback.files["/components/Navbar.jsx"];
        if (!next["/components/Footer.jsx"]) next["/components/Footer.jsx"] = fallback.files["/components/Footer.jsx"];
    }

    return next;
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

        const code = hardenFooterSource(absolutePath, fixUnsafeCode(toCodeString(rawContent)));
        if (!code.trim()) return;
        normalizedFiles[absolutePath] = { code };
    });

    return normalizedFiles;
};

const resolveRelativeImportPath = (fromPath, importPath) => {
        const fromSegments = toAbsolutePath(fromPath).split('/').filter(Boolean);
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

const buildLocalImportStub = (path) => {
        const normalizedPath = toAbsolutePath(path);
        if (/\.css$/i.test(normalizedPath)) {
                return `:root {
    color-scheme: light dark;
}

html, body, #root {
    min-height: 100%;
}

body {
    margin: 0;
}
`;
        }

        const baseName = normalizedPath.split('/').pop() || 'FallbackComponent';
        const componentName = baseName.replace(/\.(jsx|tsx|js|ts)$/i, '').replace(/[^A-Za-z0-9_$]/g, '') || 'FallbackComponent';

        return `import React from "react";

export default function ${componentName}() {
    return (
        <div className="flex min-h-[240px] items-center justify-center rounded-3xl border border-border bg-card px-6 py-10 text-center text-card-foreground shadow-xl">
            <div className="max-w-md">
                <p className="text-xs font-black uppercase tracking-[0.35em] text-primary">Recovered Module</p>
                <h2 className="mt-3 text-2xl font-black tracking-tight">${componentName}</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    This file was synthesized automatically because a generated relative import had no matching file.
                </p>
            </div>
        </div>
    );
}`;
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
    const existingPaths = new Set(Object.keys(next).map((path) => toAbsolutePath(path)));

    const resolveTargetPath = (fromPath, importPath) => {
        const fromSegments = toAbsolutePath(fromPath).split('/').filter(Boolean);
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
        return candidates.find((candidate) => existingPaths.has(toAbsolutePath(candidate))) || candidates[0];
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
        const code = toCodeString(content);
        if (!code.trim()) return;

        for (const match of code.matchAll(/import\s+([\s\S]*?)\s+from\s+['"](\.[^'"]+)['"]/g)) {
            const importClause = match[1] || '';
            const importPath = match[2];
            const targetPath = resolveTargetPath(path, importPath);
            const targetCode = toCodeString(next[targetPath]);
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
        const existingPaths = new Set(Object.keys(next).map((path) => toAbsolutePath(path)));
        const createdPaths = new Set();

        const addStub = (candidatePath) => {
                const normalized = toAbsolutePath(candidatePath);
                if (!hasValidPath(normalized) || existingPaths.has(normalized) || createdPaths.has(normalized)) return;
                next[normalized] = { code: buildLocalImportStub(normalized) };
                createdPaths.add(normalized);
                existingPaths.add(normalized);
        };

        Object.entries(next).forEach(([path, content]) => {
                const code = toCodeString(content);
                if (!code.trim()) return;

                for (const match of code.matchAll(/import\s+[\s\S]*?from\s+['"](\.[^'"]+)['"]/g)) {
                        const importPath = match[1];
                        const resolvedPath = resolveRelativeImportPath(path, importPath);
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

                        const existing = candidates.find((candidate) => existingPaths.has(toAbsolutePath(candidate)));
                        if (existing) continue;

                        addStub(candidates[0]);
                }
        });

        return next;
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

const ensureGeneratedBrowserRouter = (files) => {
    const next = files || {};
    
    // STEP 1: REMOVE BrowserRouter FROM EVERY FILE EXCEPT index.jsx/index.tsx/index.js
    Object.keys(next).forEach((path) => {
        if (path === '/index.jsx' || path === '/index.tsx' || path === '/index.js') return;
        
        let code = toCodeString(next[path]) || '';
        if (code.includes('BrowserRouter')) {
            // Remove BrowserRouter tags
            code = code.replace(/<BrowserRouter[^>]*>/g, '');
            code = code.replace(/<\/BrowserRouter>/g, '');
            // Remove BrowserRouter import
            code = code.replace(/^\s*import\s*(?:\{[^}]*BrowserRouter[^}]*\}|BrowserRouter)\s*from\s+['"]react-router-dom['"];?\s*\n?/gm, (match) => {
                if (match.includes('{') && match.includes(',')) {
                    const cleaned = match.replace(/BrowserRouter\s*,?\s*/g, '').replace(/,\s*\}/g, '}');
                    if (cleaned.includes('{') && !cleaned.includes('{}')) {
                        return cleaned;
                    }
                }
                return '';
            });
            next[path] = { code: fixUnsafeCode(code) };
        }
    });

    // STEP 2: Check if we actually need routing
    const routerPatterns = ["<Link", "<NavLink", "<Route", "<Routes", "useNavigate", "useLocation", "useParams", "useSearchParams", "<Navigate"];
    let usesRouter = false;
    Object.entries(next).forEach(([path, content]) => {
        if (path === '/index.jsx' || path === '/index.tsx' || path === '/index.js') return;
        const code = toCodeString(content);
        if (routerPatterns.some((pattern) => code.includes(pattern))) {
            usesRouter = true;
        }
    });

    if (!usesRouter) return next;

    // STEP 3: Add BrowserRouter ONLY to index file if needed
    const indexPath = next["/index.jsx"]
        ? "/index.jsx"
        : next["/index.tsx"]
            ? "/index.tsx"
            : next["/index.js"]
                ? "/index.js"
                : "";
    if (!indexPath) return next;

    let indexCode = toCodeString(next[indexPath]);
    
    if (indexCode.includes("BrowserRouter")) {
        return next; // Already has it, we're good
    }

    // Add BrowserRouter import
    if (!/from\s+['"]react-router-dom['"]/.test(indexCode)) {
        const importLine = "import { BrowserRouter } from 'react-router-dom';\n";
        if (/^(?:import[^\n]*\n)+/m.test(indexCode)) {
            indexCode = indexCode.replace(/^(?:import[^\n]*\n)+/m, (imports) => `${imports}${importLine}`);
        } else {
            indexCode = `${importLine}${indexCode}`;
        }
    }

    // Wrap <App /> in BrowserRouter
    indexCode = indexCode.replace(/(\s*)<App\s*\/>/m, "$1<BrowserRouter>\n$1  <App />\n$1</BrowserRouter>");
    next[indexPath] = { code: fixUnsafeCode(indexCode) };

    return next;
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

const sanitizeViteConfig = (files) => {
        if (!files) return;
        const key = "/vite.config.js";
        const raw = toCodeString(files[key] || "");
        if (!raw.trim()) return;

        const unsafePatterns = [
                /module\.exports\b/, // CommonJS export
                /exports\./, // CommonJS exports
                /require\(\s*['"]path['"]\s*\)/, // require('path') usage
                /__dirname\b/, // __dirname usage
                /require\(/, // any require calls
        ];

        const isUnsafe = unsafePatterns.some((rx) => rx.test(raw));
        if (isUnsafe) {
                const safe = `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    plugins: [
        react({
            include: "**/*.{js,jsx,ts,tsx}"
        })
    ]
});
`;
                files[key] = { code: safe };
        }
};

const extractReadablePromptSummary = (prompt) => {
    const input = typeof prompt === "string" ? prompt.trim() : "";
    if (!input) return "A polished responsive website generated in fallback mode.";

    const jsonStart = input.indexOf("[");
    const jsonEnd = input.indexOf("]");
    if (jsonStart !== -1 && jsonEnd > jsonStart) {
        try {
            const parsed = JSON.parse(input.slice(jsonStart, jsonEnd + 1));
            const lastUser = [...parsed].reverse().find((item) => item?.role === "user" && typeof item?.content === "string");
            if (lastUser?.content?.trim()) {
                return lastUser.content.trim().slice(0, 180);
            }
        } catch {
            // Fall through to plain text cleanup.
        }
    }

    return input
        .replace(/Current Code Files Structure:[\s\S]*/i, "")
        .replace(/CODE_GEN_PROMPT:[\s\S]*/i, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 180) || "A polished responsive website generated in fallback mode.";
};

export async function POST(req) {
    let safePrompt = "";
    try {
        const body = await req.json();
        const prompt = body?.prompt;
        const isUpdate = body?.isUpdate || false;
        safePrompt = typeof prompt === "string" ? prompt : JSON.stringify(prompt ?? "");

        // Use enhanced prompt generation for better quality
        const effectivePrompt = enhancePromptForBetterGeneration(safePrompt, isUpdate);
        const finalPrompt = `${effectivePrompt}\n\n${SERVER_GENERATION_GUARDRAILS}`;
        let result;
        try {
            result = await requestGeneratedProject(finalPrompt, AI_TIMEOUT_MS, "Generation", 3);
        } catch (error) {
            const isTimeout = /timed out/i.test(error?.message || "");
            const isBusyError = isTransientAiError(error);
            if (!isTimeout && !isBusyError) throw error;

            const fastPrompt = `${buildFastFallbackPrompt(safePrompt, isUpdate)}\n\n${SERVER_GENERATION_GUARDRAILS}`;
            result = await requestGeneratedProject(fastPrompt, FALLBACK_AI_TIMEOUT_MS, "Fallback generation", 2);
        }

        const jsonResponse = tryParseJson(result.response.text());
        if (!jsonResponse || typeof jsonResponse !== "object") {
            throw new Error("AI returned an invalid response format.");
        }
        if (!jsonResponse.files) {
            throw new Error("AI response is missing the 'files' data.");
        }

        let allFiles = normalizeFilesMap(jsonResponse.files);
        if (Object.keys(allFiles).length === 0) {
            throw new Error("AI returned files, but all file paths were invalid.");
        }

        allFiles = await repairProblemFiles(allFiles);

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

            allFiles[filePath] = { code: hardenFooterSource(filePath, fixUnsafeCode(code)) };
        }

        allFiles = ensureImportedLocalComponentDefaults(ensureLocalImportTargets(allFiles));

        allFiles = await repairProblemFiles(allFiles);

        ensureFile(allFiles, "/index.html", DEFAULT_ENTRY_HTML);
        ensureFile(allFiles, "/index.jsx", DEFAULT_INDEX_JSX);
        const pageCandidate = pickPrimaryGeneratedPage(allFiles);
        if (!allFiles["/App.jsx"] || isPlaceholderAppCode(toCodeString(allFiles["/App.jsx"]))) {
            if (pageCandidate) {
                const hasNavbar = Boolean(allFiles["/components/Navbar.jsx"]);
                const hasFooter = Boolean(allFiles["/components/Footer.jsx"]);
                allFiles["/App.jsx"] = {
                    code: hardenFooterSource(
                        "/App.jsx",
                        fixUnsafeCode(buildAppShellFromPage(pageCandidate, { includeNavbar: hasNavbar, includeFooter: hasFooter }))
                    )
                };
            } else {
                ensureFile(allFiles, "/App.jsx", DEFAULT_APP_JSX);
            }
        }
        ensureFile(allFiles, "/styles.css", DEFAULT_STYLES);
        allFiles = ensureGeneratedBrowserRouter(allFiles);
        
        normalizePackageJson(allFiles);

        if (!allFiles["/README.md"]) {
            allFiles["/README.md"] = { code: buildReadme(jsonResponse.projectTitle) };
        }

        const remainingProblems = collectProblemFiles(allFiles).slice(0, 4);
        if (remainingProblems.length > 0 || isPlaceholderAppCode(toCodeString(allFiles["/App.jsx"]))) {
            allFiles = salvagePreviewableFiles(allFiles, safePrompt);
        }

        const finalProblems = collectProblemFiles(allFiles).slice(0, 4);
        if (finalProblems.length > 0) {
            const fallbackProject = buildEmergencyFallbackProject(safePrompt);
            return NextResponse.json({
                ...fallbackProject,
                fallbackUsed: true,
                generatorWarning: finalProblems.map((problem) => `${problem.path}: ${problem.issues[0]}`).join(" | ")
            });
        }

        if (!allFiles["/App.jsx"] || !toCodeString(allFiles["/App.jsx"]).trim()) {
            ensureFile(allFiles, "/App.jsx", DEFAULT_APP_JSX);
        }

        return NextResponse.json({
            projectTitle: typeof jsonResponse.projectTitle === "string" && jsonResponse.projectTitle.trim()
                ? jsonResponse.projectTitle.trim()
                : "AI Website",
            explanation: typeof jsonResponse.explanation === "string" && jsonResponse.explanation.trim()
                ? jsonResponse.explanation.trim()
                : "Generated a complete website project.",
            files: allFiles,
            generatedFiles: Object.keys(allFiles),
            generatorWarning: remainingProblems.length > 0
                ? remainingProblems.map((problem) => `${problem.path}: ${problem.issues[0]}`).join(" | ")
                : undefined
        });
    } catch (error) {
        console.error("Code Generation API Error:", error);
        const fallbackProject = buildEmergencyFallbackProject(safePrompt);
        return NextResponse.json({
            ...fallbackProject,
            fallbackUsed: true,
            generatorError: error?.message || "Unknown generation error"
        });
    }
}
