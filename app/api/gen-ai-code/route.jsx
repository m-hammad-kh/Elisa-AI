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

const isLikelyTruncatedJson = (value) => {
    const text = typeof value === 'string' ? value : '';
    if (text.length < 5000) return false;
    const openBraces = (text.match(/\{/g) || []).length;
    const closeBraces = (text.match(/\}/g) || []).length;
    if (closeBraces < openBraces) return true;
    return text.length > 25000;
};

const buildFallbackPackageJson = (projectTitle, dependencies) => {
    const safeName = typeof projectTitle === 'string' && projectTitle.trim()
        ? projectTitle.trim().toLowerCase().replace(/[^a-z0-9-_]+/g, '-').replace(/^-+|-+$/g, '')
        : 'generated-project';
    const pkg = {
        name: safeName.slice(0, 100) || 'generated-project',
        version: '1.0.0',
        private: true,
        type: 'module',
        scripts: {
            dev: 'vite',
            build: 'vite build',
            preview: 'vite preview'
        },
        dependencies: {
            react: '^19.2.4',
            'react-dom': '^19.2.4',
            ...(dependencies && typeof dependencies === 'object' ? dependencies : {})
        },
        devDependencies: {
            vite: 'latest',
            '@vitejs/plugin-react': 'latest'
        }
    };
    return JSON.stringify(pkg, null, 2);
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

const AI_TIMEOUT_MS = 90000;

const generateChunkedProject = async (prompt, model) => {
    const promptTail = typeof prompt === 'string' ? prompt.slice(-15000) : '';
    const manifestChat = model.startChat({
        generationConfig: {
            temperature: 0.4,
            topP: 0.9,
            topK: 40,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json'
        },
        history: []
    });

    const manifestResp = await withTimeout(
        manifestChat.sendMessage(
        [
            'Return ONLY valid JSON.',
            'Schema:',
            '{ "projectTitle": "", "explanation": "", "files": [ { "path": "", "type": "", "description": "" } ], "dependencies": {} }',
            'Rules:',
            '- No code in this step.',
            '- Include /index.html, /index.jsx, /App.jsx, /styles.css at minimum.',
            '- Keep file count <= 18.',
            '- All paths start with /. Use .jsx for React components.',
            '',
            'User request/context:',
            promptTail
        ].join('\n')
        ),
        AI_TIMEOUT_MS,
        'Manifest generation'
    );

    const manifestText = manifestResp?.response?.text?.() || '';
    const manifest = tryParseJson(manifestText);

    const fileList = Array.isArray(manifest?.files) ? manifest.files : [];
    const filePaths = fileList
        .map((f) => (f && typeof f === 'object' ? f.path : null))
        .filter((p) => typeof p === 'string' && p.trim().length > 0)
        .map((p) => toAbsolutePath(p));

    const uniquePaths = Array.from(new Set(filePaths));
    const dependencies = manifest?.dependencies && typeof manifest.dependencies === 'object' ? manifest.dependencies : {};
    const projectTitle = typeof manifest?.projectTitle === 'string' ? manifest.projectTitle : 'AI Website';
    const explanation = typeof manifest?.explanation === 'string' ? manifest.explanation : '';

    const files = {};
    const fileChatConfig = {
        temperature: 0.45,
        topP: 0.9,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: 'text/plain'
    };

    const allPathsText = uniquePaths.join('\n');
    for (const targetPath of uniquePaths) {
        const fileChat = model.startChat({ generationConfig: fileChatConfig, history: [] });
        const fileResp = await withTimeout(
            fileChat.sendMessage(
            [
                `Generate ONLY the content for this file: ${targetPath}`,
                'Return raw file content only. No JSON. No markdown fences.',
                '',
                `Project title: ${projectTitle}`,
                explanation ? `Project notes: ${explanation}` : '',
                '',
                'Available files (you MUST only import from these):',
                allPathsText,
                '',
                'User request/context (tail):',
                promptTail
            ].filter(Boolean).join('\n')
            ),
            AI_TIMEOUT_MS,
            `File generation ${targetPath}`
        );
        const code = stripMarkdownCodeFences(fileResp?.response?.text?.() || '');
        files[targetPath] = { code: fixUnsafeCode(code) };
    }

    if (!files['/package.json']) {
        files['/package.json'] = { code: buildFallbackPackageJson(projectTitle, dependencies) };
    }

    return {
        projectTitle,
        explanation,
        files,
        generatedFiles: Object.keys(files)
    };
};

export async function POST(req) {
    const body = await req.json();
    const prompt = body?.prompt;
    const existingFiles = body?.existingFiles;
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
        
        let jsonResponse;
        try {
            jsonResponse = tryParseJson(resp);
        } catch (parseError) {
            if (isLikelyTruncatedJson(resp)) {
                console.log("JSON likely truncated, falling back to chunked generation...");
                jsonResponse = await generateChunkedProject(effectivePrompt, model);
            } else {
                throw parseError;
            }
        }
        
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
        const createdFiles = new Set(Object.keys(allFiles).map(p => p.startsWith('/') ? p : `/${p}`));
        if (existingFiles && typeof existingFiles === 'object') {
            Object.keys(existingFiles).forEach(p => {
                const absolute = p.startsWith('/') ? p : `/${p}`;
                createdFiles.add(absolute);
            });
        }
        
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
                    const cacheKey = `${query}_${orientation}`;

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

            const importRegex = /import\s+?(?:(?:(?:[a-zA-Z0-9_$]+)|(?:\{[a-zA-Z0-9_$,\s]+\}))\s+from\s+)?['"](\.\.?\/[^'"]+|(?:\/[^'"]+))['"]/g;
            const importMatches = [...code.matchAll(importRegex)];
            for (const impMatch of importMatches) {
                let relativePath = impMatch[1];
                if (!relativePath || typeof relativePath !== 'string') continue;
                
                let absolutePath = null;
                const currentDir = filePath.substring(0, filePath.lastIndexOf('/')) || '/';
                if (relativePath.startsWith('./')) {
                    absolutePath = currentDir + (currentDir === '/' ? '' : '/') + relativePath.slice(2);
                } else if (relativePath.startsWith('../')) {
                    const parentDir = currentDir.substring(0, currentDir.lastIndexOf('/')) || '/';
                    absolutePath = parentDir + (parentDir === '/' ? '' : '/') + relativePath.slice(3);
                } else if (relativePath.startsWith('/')) {
                    absolutePath = relativePath;
                }

                if (!absolutePath) continue;
                absolutePath = absolutePath.replace(/\/\//g, '/');
                if (!absolutePath.startsWith('/')) absolutePath = '/' + absolutePath;

                const isImageAsset = /\.(png|jpe?g|gif|svg|webp|ico|bmp)$/i.test(absolutePath);
                if (!absolutePath.includes('.') && !isImageAsset) absolutePath += '.jsx';
                
                if (!createdFiles.has(absolutePath)) {
                    if (isImageAsset) {
                        allFiles[absolutePath] = { code: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA6ie6hQAAAABJRU5ErkJggg==" };
                        createdFiles.add(absolutePath);
                        continue;
                    }
                    const componentName = absolutePath.split('/').pop().replace(/\.(jsx?|tsx?)$/i, '');
                    let stubCode = `import React from 'react';\n\nconst ${componentName} = () => {\n  return <div className="p-4 border border-dashed border-gray-400 rounded text-center">Missing Component: ${componentName}</div>;\n};\n\nexport default ${componentName};`;
                    if (componentName.toLowerCase().includes('footer')) {
                        stubCode = `import React from 'react';\n\nconst Footer = () => {\n  return <footer className="bg-gray-100 p-8 text-center text-gray-600 border-t mt-12">© ${new Date().getFullYear()} ${jsonResponse.projectTitle || 'Website'}. All rights reserved.</footer>;\n};\n\nexport default Footer;`;
                    } else if (componentName.toLowerCase().includes('navbar')) {
                        stubCode = `import React from 'react';\n\nconst Navbar = () => {\n  return <nav className="p-4 bg-white shadow-sm flex justify-between items-center px-8 border-b"> <div className="font-bold text-xl">${jsonResponse.projectTitle || 'Logo'}</div> <div className="flex gap-4"><span>Home</span><span>About</span><span>Contact</span></div> </nav>;\n};\n\nexport default Navbar;`;
                    }
                    allFiles[absolutePath] = { code: fixUnsafeCode(stubCode) };
                    createdFiles.add(absolutePath);
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
