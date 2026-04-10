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
        if (content.code == null) return '';
        return JSON.stringify(content, null, 2);
    }
    return '';
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

    // Fix new URL(null/undefined, ...) usage
    code = code.replace(/new URL\(\s*(null|undefined)\s*,/g, 'new URL(".",');

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

const extractFirstJsonObject = (value) => {
    const input = typeof value === 'string' ? value : '';
    const start = input.indexOf('{');
    if (start === -1) return input.trim();
    
    // Try to find the last }
    const end = input.lastIndexOf('}');
    if (end !== -1 && end > start) {
        return input.substring(start, end + 1);
    }
    
    // If no closing brace, return from start onwards
    return input.substring(start).trim();
};

const tryParseJson = (value) => {
    const input = stripMarkdownCodeFences(value);
    const text = extractFirstJsonObject(input);
    
    try {
        return JSON.parse(text);
    } catch (parseError) {
        // Robust fixing for common AI JSON errors
        try {
            let fixed = text.trim();
            
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

const AI_TIMEOUT_MS = 70000;

export async function POST(req) {
    const body = await req.json();
    const prompt = body?.prompt;
    const safePrompt = typeof prompt === 'string' ? prompt : JSON.stringify(prompt ?? '');
    const effectivePrompt = safePrompt.trim().length > 0
        ? safePrompt
        : 'Create a modern, responsive, content-rich multi-page website with a premium design.';
    console.log("PROMPT RECEIVED (Length):", effectivePrompt.length);
    try {
        const GenAiCode = model.startChat({
            generationConfig: CodeGenerationConfig,
            history: [],
        });

        const result = await withTimeout(
            GenAiCode.sendMessage(effectivePrompt),
            AI_TIMEOUT_MS,
            'Generation'
        );
        const resp = result.response.text();
        
        const jsonResponse = tryParseJson(resp);
        
        if (!jsonResponse || typeof jsonResponse !== 'object') {
            throw new Error("AI returned an invalid response format.");
        }

        if (!jsonResponse.files) {
            throw new Error("AI response is missing the 'files' data.");
        }
        
        const normalizedFiles = {};
        Object.entries(jsonResponse.files).forEach(([rawPath, rawContent]) => {
            const absolutePath = toAbsolutePath(rawPath);
            if (!hasValidPath(absolutePath)) return;
            const code = fixUnsafeCode(toCodeString(rawContent));
            normalizedFiles[absolutePath] = { code };
        });

        if (Object.keys(normalizedFiles).length === 0) {
            throw new Error("AI returned files, but all file paths were invalid.");
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


