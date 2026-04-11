import { NextResponse } from "next/server";
import { model, CodeGenerationConfig } from '@/configs/AiModel';
import { getPexelsImage } from '@/lib/pexels';

const hasValidPath = (value) => {
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

const toAbsolutePath = (value) => {
    if (typeof value !== 'string') return '/unknown';
    const trimmed = value.trim();
    if (!trimmed) return '/unknown';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const toCodeString = (content) => {
    if (typeof content === 'string') return content;
    if (content && typeof content === 'object') {
        if (typeof content.code === 'string') return content.code;
        if (typeof content.content === 'string') return content.content;
        if (typeof content.text === 'string') return content.text;
        if (content.code == null) return '';
        return JSON.stringify(content, null, 2);
    }
    return '';
};

const fixClassContrast = (code) => {
    const input = typeof code === 'string' ? code : '';
    if (!input) return input;

    const darkBg = /\bbg-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightBg = /\bbg-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50)\b/;
    const darkText = /\btext-(black|slate-9\d\d|gray-9\d\d|neutral-9\d\d|zinc-9\d\d|stone-9\d\d)\b/;
    const lightText = /\btext-(white|slate-50|gray-50|neutral-50|zinc-50|stone-50|gray-100|slate-100)\b/;

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
        return v;
    };

    const rewriteAttr = (attr) => new RegExp(`\\b${attr}\\s*=\\s*"([^"]*)"`, 'g');
    const rewriteAttrS = (attr) => new RegExp(`\\b${attr}\\s*=\\s*'([^']*)'`, 'g');

    let out = input
        .replace(rewriteAttr('className'), (m, v) => m.replace(v, fixClassValue(v)))
        .replace(rewriteAttrS('className'), (m, v) => m.replace(v, fixClassValue(v)))
        .replace(rewriteAttr('class'), (m, v) => m.replace(v, fixClassValue(v)))
        .replace(rewriteAttrS('class'), (m, v) => m.replace(v, fixClassValue(v)));

    return out;
};

const coerceFilesShape = (files) => {
    // We primarily expect: { "/path": { code: "..." }, ... }
    // Some models occasionally return: [{ path: "/path", code: "..." }, ...]
    if (!files) return {};

    if (Array.isArray(files)) {
        const out = {};
        for (const entry of files) {
            if (!entry || typeof entry !== 'object') continue;
            const p = typeof entry.path === 'string'
                ? entry.path
                : typeof entry.filePath === 'string'
                    ? entry.filePath
                    : typeof entry.filename === 'string'
                        ? entry.filename
                        : '';
            if (!p) continue;
            const codeCandidate =
                (typeof entry.code === 'string' && entry.code) ||
                (typeof entry.content === 'string' && entry.content) ||
                (typeof entry.text === 'string' && entry.text) ||
                toCodeString(entry);
            out[p] = { code: codeCandidate };
        }
        return out;
    }

    if (files && typeof files === 'object') {
        // Handle nested shapes like { files: {...} }
        if (files.files && typeof files.files === 'object') return files.files;
        return files;
    }

    return {};
};

const fixUnsafeCode = (input) => {
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
    // Broader fix: remove stray "</n" (NOT "</nav>") that commonly appears in broken JSX strings
    code = code.replace(/<\/n(?=\s|$|<)/g, '');
    // Even broader, but safe: keep only real tags like </nav> and </noscript>
    code = code.replace(/<\/n(?!av\b|oscript\b)/gi, '');

    // Fix common JSX corruption where a block closing tag is accidentally appended inside a <p> text node.
    // Example: <p>... </motion.div>  => <p>...</p>\n</motion.div>
    code = code.replace(/(<p\b[^>]*>[^<]*)(\s*)(<\/(?!p\b)[^>]+>)/g, '$1</p>\n$2$3');

    // Fix new URL(null/undefined, ...) usage
    code = code.replace(/new URL\(\s*(null|undefined)\s*,/g, 'new URL(".",');

    // Best-effort contrast fix for obviously unreadable combinations on the same element.
    code = fixClassContrast(code);

    return code;
};

const stripMarkdownCodeFences = (value) => {
    const input = typeof value === 'string' ? value : '';
    const trimmed = input.trim();
    if (trimmed.startsWith('```')) {
        return trimmed.replace(/^```[a-zA-Z]*\s*/i, '').replace(/```$/i, '').trim();
    }
    return trimmed;
};

const extractFirstCompleteJsonObject = (value) => {
    const input = typeof value === 'string' ? value : '';
    const start = input.indexOf('{');
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
            if (ch === '\\') {
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

        if (ch === '{') {
            depth += 1;
            continue;
        }
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                return input.slice(start, i + 1).trim();
            }
            continue;
        }
    }

    // If the model truncated mid-object, fall back to the remainder (repair may close braces).
    return input.substring(start).trim();
};

const escapeJsonControlChars = (value) => {
    const input = typeof value === 'string' ? value : '';
    let out = '';
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
            if (ch === '\\') {
                escaped = true;
                out += ch;
                continue;
            }
            if (ch === '"') {
                inString = false;
                out += ch;
                continue;
            }
            if (ch === '\n') {
                out += '\\n';
                continue;
            }
            if (ch === '\r') {
                out += '\\r';
                continue;
            }
            if (ch === '\t') {
                out += '\\t';
                continue;
            }
            out += ch;
            continue;
        }

        if (ch === '"') {
            inString = true;
            out += ch;
            continue;
        }
        out += ch;
    }
    return out;
};

const tryParseJson = (value) => {
    const input = stripMarkdownCodeFences(value);
    const text = extractFirstCompleteJsonObject(input);
    
    try {
        return JSON.parse(text);
    } catch (parseError) {
        // Robust fixing for common AI JSON errors
        try {
            let fixed = escapeJsonControlChars(text.trim());
            
            // 1. Fix unterminated string
            // Check if we are inside a string (odd number of unescaped quotes)
            const quotesMatch = fixed.match(/(^|[^\\])"/g);
            if (quotesMatch && quotesMatch.length % 2 !== 0) {
                // We're in a string, close it
                fixed += '"';
            }

            // 2. Fix trailing commas before closing braces/brackets
            fixed = fixed.replace(/,\s*([\]}])/g, '$1');

            // 3. Fix invalid escape characters
            fixed = fixed.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");

            // 4. Close any open braces/brackets
            const openBraces = (fixed.match(/\{/g) || []).length;
            const closeBraces = (fixed.match(/\}/g) || []).length;
            if (openBraces > closeBraces) {
                fixed += '}'.repeat(openBraces - closeBraces);
            }
            
            const openBrackets = (fixed.match(/\[/g) || []).length;
            const closeBrackets = (fixed.match(/\]/g) || []).length;
            if (openBrackets > closeBrackets) {
                fixed += ']'.repeat(openBrackets - closeBrackets);
            }

            return JSON.parse(fixed);
        } catch (secondError) {
            throw new Error(`AI returned malformed JSON: ${parseError.message}. Attempted fix also failed.`);
        }
    }
};

const buildReadme = (projectTitle) => {
    const title = typeof projectTitle === 'string' && projectTitle.trim().length > 0
        ? projectTitle.trim()
        : 'Elisa AI Project';
    return [
        `# ${title}`,
        '',
        '## Run Locally',
        '1. Install dependencies:',
        '   npm install',
        '2. Start the dev server:',
        '   npm run dev',
        '',
        '## Build For Production',
        '1. Create a production build:',
        '   npm run build',
        '2. Preview the build locally:',
        '   npm run preview',
        '',
        '## Environment Variables',
        '- If a `.env.local` file is included, copy the values into your hosting provider environment settings.',
        '- Never commit real secrets to a public repo.',
        '',
        '## Deploy (Quick Steps)',
        '### Vercel',
        '1. Import the repo',
        '2. Build command: `npm run build`',
        '3. Output directory: `dist`',
        '4. Add environment variables from `.env.local` if present',
        '',
        '### Netlify',
        '1. New site from Git',
        '2. Build command: `npm run build`',
        '3. Publish directory: `dist`',
        '',
        '### Other Hosts',
        '- Build locally with `npm run build` and upload the `dist` folder.',
        ''
    ].join('\n');
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

const AI_TIMEOUT_MS = 110000;
const JSON_REPAIR_TIMEOUT_MS = 40000;
const MAX_REPAIR_INPUT_CHARS = 120000;

const normalizeFilesMap = (rawFiles) => {
    const coerced = coerceFilesShape(rawFiles);
    const normalizedFiles = {};

    Object.entries(coerced || {}).forEach(([rawPath, rawContent]) => {
        // Some models may emit empty keys but include the real path in the value object
        let candidatePath = rawPath;
        if ((!candidatePath || !String(candidatePath).trim()) && rawContent && typeof rawContent === 'object') {
            candidatePath =
                (typeof rawContent.path === 'string' && rawContent.path) ||
                (typeof rawContent.filePath === 'string' && rawContent.filePath) ||
                (typeof rawContent.filename === 'string' && rawContent.filename) ||
                '';
        }

        const absolutePath = toAbsolutePath(candidatePath);
        if (!hasValidPath(absolutePath)) return;
        const code = fixUnsafeCode(toCodeString(rawContent));
        if (!code || !code.trim()) return;
        normalizedFiles[absolutePath] = { code };
    });

    return normalizedFiles;
};

const parseJsonWithRepair = async (rawText) => {
    try {
        return tryParseJson(rawText);
    } catch (parseError) {
        const input = typeof rawText === 'string' ? rawText.trim() : '';
        if (!input || input.length > MAX_REPAIR_INPUT_CHARS) {
            throw parseError;
        }

        const repairSession = model.startChat({
            generationConfig: CodeGenerationConfig,
            history: [],
        });
        const repairPrompt = [
            "You are a JSON repair tool.",
            "Return ONLY valid JSON. Do not add markdown or commentary.",
            "Preserve all file paths and code exactly; only fix escaping and structural JSON issues.",
            "Input JSON (possibly invalid):",
            input
        ].join("\n\n");

        const repairResult = await withTimeout(
            repairSession.sendMessage(repairPrompt),
            JSON_REPAIR_TIMEOUT_MS,
            "Repair"
        );
        const repairedText = repairResult.response.text();
        return tryParseJson(repairedText);
    }
};

export async function POST(req) {
    const body = await req.json();
    const prompt = body?.prompt;
    const safePrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt ?? '');
    const effectivePrompt = safePrompt.trim().length > 0
        ? safePrompt
        : 'Create a modern, responsive, content-rich multi-page website with a premium design.';
    console.log("PROMPT RECEIVED (Length):", effectivePrompt.length);
    try {
        const runGenerationOnce = async (promptText, label) => {
            const session = model.startChat({
                generationConfig: CodeGenerationConfig,
                history: [],
            });
            const result = await withTimeout(
                session.sendMessage(promptText),
                AI_TIMEOUT_MS,
                label
            );
            return result.response.text();
        };

        const retryPrompt = [
            effectivePrompt,
            '',
            'RETRY (CRITICAL): Your previous response was malformed JSON or had invalid/missing file paths.',
            'Return ONLY valid JSON that matches the schema.',
            'The `files` field MUST be an ARRAY of objects: { "path": "/index.html", "code": "..." }.',
            'Each `path` MUST be a valid non-empty absolute path like `/index.html`, `/index.jsx`, `/App.jsx`, `/pages/Home.jsx`.',
            'Never use `null`, `undefined`, empty strings, or `/unknown` for any path.',
            'Escape all newlines inside code strings as `\\n` and quotes as `\\\"`.',
            'Include at least: `/index.html`, `/index.jsx`, `/App.jsx`, `/pages/Home.jsx`, `/pages/Contact.jsx`, `/components/Navbar.jsx`, `/components/Footer.jsx`, `/package.json`.'
        ].join('\n');

        let usedRetry = false;
        const respInitial = await runGenerationOnce(effectivePrompt, 'Generation');
        let jsonResponse;
        try {
            jsonResponse = await parseJsonWithRepair(respInitial);
        } catch (e) {
            usedRetry = true;
            const respRetry = await runGenerationOnce(retryPrompt, 'Generation Retry');
            jsonResponse = await parseJsonWithRepair(respRetry);
        }
        
        if (!jsonResponse || typeof jsonResponse !== 'object') {
            throw new Error("AI returned an invalid response format.");
        }

        if (!jsonResponse.files) {
            throw new Error("AI response is missing the 'files' data.");
        }
        
        let normalizedFiles = normalizeFilesMap(jsonResponse.files);

        // Retry once if the model returned unusable paths/shape
        if (Object.keys(normalizedFiles).length === 0 && !usedRetry) {
            usedRetry = true;
            const respRetry = await runGenerationOnce(retryPrompt, 'Generation Retry');
            jsonResponse = await parseJsonWithRepair(respRetry);
            normalizedFiles = normalizeFilesMap(jsonResponse?.files);
        }

        if (Object.keys(normalizedFiles).length === 0) {
            // Include a tiny hint for debugging without leaking large payloads
            const hint = typeof respInitial === 'string'
                ? respInitial.slice(0, 400)
                : '';
            throw new Error(`AI returned files, but all file paths were invalid. (hint: ${hint})`);
        }

        jsonResponse.files = normalizedFiles;
        const allFiles = jsonResponse.files;
        const filePaths = Object.keys(allFiles);
        const usedImagesGlobal = new Set();

        for (const filePath of filePaths) {
            let code = toCodeString(allFiles[filePath]);
            
            // Lucide icons logic
            const commonLucideIcons = ['Menu', 'X', 'MapPin', 'Phone', 'Mail', 'Clock', 'ChevronRight', 'ChevronLeft', 'Star', 'User', 'ShoppingCart', 'Search', 'Bell', 'Settings', 'LogOut', 'Trash', 'Edit', 'Plus', 'Check', 'AlertCircle', 'Info', 'ExternalLink', 'Github', 'Twitter', 'Facebook', 'Instagram', 'Linkedin', 'ArrowRight', 'ArrowLeft', 'Play', 'Pause', 'Heart', 'Share2', 'Globe', 'Download', 'Cloud', 'Lock', 'Unlock', 'Eye', 'EyeOff', 'Calendar', 'Filter', 'Layout', 'Grid', 'List', 'Zap', 'Award', 'Target', 'Activity', 'BarChart', 'PieChart', 'FileText', 'Image', 'Video', 'Music', 'Camera', 'Mic', 'Monitor', 'Smartphone', 'Tablet', 'Laptop', 'Server', 'Database', 'Cpu', 'Terminal', 'Code', 'Layers', 'Boxes', 'Box', 'Package', 'Truck', 'Gift', 'CreditCard', 'DollarSign', 'Briefcase', 'BookOpen', 'GraduationCap', 'Coffee', 'Utensils', 'Pizza', 'GlassWater', 'Plane', 'Map', 'Navigation', 'Compass', 'Sun', 'Moon', 'CloudRain', 'Wind', 'Thermometer', 'Droplets', 'Umbrella', 'HelpCircle', 'MessageSquare', 'Send', 'ThumbsUp', 'ThumbsDown', 'UserPlus', 'UserMinus', 'Users', 'UserCheck', 'UserX', 'Shield', 'ShieldCheck', 'ShieldAlert', 'ShieldOff', 'Flag', 'Tag', 'Bookmark', 'Heart', 'Flame', 'Sparkles', 'Ghost', 'Smile', 'Frown', 'Meh', 'Angry', 'Laugh', 'Wink', 'Dizzy', 'Hand', 'Fingerprint', 'Wifi', 'Bluetooth', 'Battery', 'Cast', 'Tv', 'Speaker', 'Headphones', 'Mic2', 'Radio', 'Volume2', 'VolumeX', 'Maximize2', 'Minimize2', 'Crop', 'RotateCw', 'RotateCcw', 'RefreshCw', 'RefreshCcw', 'Hash', 'AtSign', 'Percent', 'Divide', 'Equal', 'PlusCircle', 'MinusCircle', 'XCircle', 'CheckCircle', 'AlertTriangle', 'Loader2'];
            
            const iconsToImport = commonLucideIcons.filter(icon => {
                const isUsed = new RegExp(`<${icon}\\b`).test(code);
                const isAlreadyImported = new RegExp(`\\b${icon}\\b`).test(code.split('\n').filter(line => line.trim().startsWith('import')).join('\n'));
                return isUsed && !isAlreadyImported;
            });

            if (iconsToImport.length > 0) {
                const importStatement = `import { ${iconsToImport.join(', ')} } from 'lucide-react';\n`;
                if (code.includes("'use client'") || code.includes('"use client"')) {
                    code = code.replace(/('|")use client('|");?/, (match) => `${match}\n${importStatement}`);
                } else {
                    code = importStatement + code;
                }
            }

            const pexelsRegex = /https:\/\/images\.pexels\.com\/photos\/search\?query=([a-zA-Z0-9%+\-_.]+)(&orientation=(landscape|portrait|square))?/g;
            const matches = [...code.matchAll(pexelsRegex)];
            if (matches.length > 0) {
                const usedImagesInFile = new Set();
                for (const match of matches) {
                    const fullUrl = match[0];
                    const query = match[1];
                    const orientation = match[3] || 'landscape';

                    let imageUrl = null;
                    let attempts = 0;

                    // Try to find a unique image from the pool
                    while (attempts < 6) {
                        imageUrl = await getPexelsImage(query, orientation);
                        if (!usedImagesGlobal.has(imageUrl)) break;
                        attempts++;
                    }

                    usedImagesInFile.add(imageUrl);
                    usedImagesGlobal.add(imageUrl);
                    // Use a function in replace to avoid $ special character interpretation
                    code = code.split(fullUrl).join(imageUrl);
                }
            }
            allFiles[filePath] = { code: fixUnsafeCode(code) };
        }

        if (!allFiles['/README.md']) {
            allFiles['/README.md'] = { code: buildReadme(jsonResponse.projectTitle) };
        }
        if (Array.isArray(jsonResponse.generatedFiles)) {
            if (!jsonResponse.generatedFiles.includes('/README.md')) {
                jsonResponse.generatedFiles.push('/README.md');
            }
        } else {
            jsonResponse.generatedFiles = Object.keys(allFiles);
        }

        return NextResponse.json(jsonResponse);
    } catch (e) {
        console.error("Code Generation API Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
