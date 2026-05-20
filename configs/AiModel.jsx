import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_MODEL_NAME = process.env.GEMINI_MODEL || process.env.GEMINI_MODEL_NAME || "gemini-2.5-flash-lite";

if (!GEMINI_API_KEY) {
    throw new Error("Missing Gemini API key. Set GEMINI_API_KEY or NEXT_PUBLIC_GEMINI_API_KEY.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const toMessageContent = (value) => {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) {
        return value
            .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part.text === "string") return part.text;
                if (part && typeof part.content === "string") return part.content;
                return "";
            })
            .filter(Boolean)
            .join("");
    }
    if (value && typeof value === "object") {
        if (typeof value.text === "string") return value.text;
        if (typeof value.content === "string") return value.content;
        if (Array.isArray(value.parts)) return toMessageContent(value.parts);
    }
    return "";
};

const normalizeRole = (role) => {
    if (role === "model" || role === "assistant") return "model";
    return "user";
};

const normalizeHistory = (history = []) => {
    if (!Array.isArray(history)) return [];

    return history
        .map((message) => {
            if (!message || typeof message !== "object") return null;

            const role = normalizeRole(message.role);

            if (typeof message.content === "string" || Array.isArray(message.content)) {
                return { role, parts: [{ text: toMessageContent(message.content) }] };
            }

            if (Array.isArray(message.parts)) {
                return { role, parts: message.parts.map((part) => (typeof part === "string" ? { text: part } : part)).filter(Boolean) };
            }

            if (typeof message.text === "string") {
                return { role, parts: [{ text: message.text }] };
            }

            return null;
        })
        .filter((message) => message && Array.isArray(message.parts) && message.parts.length > 0);
};

const getResponseText = (response) => {
    if (typeof response?.text === "function") return response.text();
    const candidate = response?.candidates?.[0]?.content?.parts;
    if (Array.isArray(candidate)) {
        return candidate
            .map((part) => {
                if (typeof part === "string") return part;
                if (part && typeof part.text === "string") return part.text;
                return "";
            })
            .filter(Boolean)
            .join("");
    }
    return "";
};

const shouldRetry = (error) => {
    const status = error?.status ?? error?.response?.status;
    if ([429, 500, 502, 503, 504].includes(status)) {
        return true;
    }

    const errorMsg = String(error?.message || "");
    return ["429", "503", "Service Unavailable", "high demand", "temporarily unavailable"].some((snippet) => errorMsg.includes(snippet));
};

export const isTransientAiError = (error) => shouldRetry(error);

const buildGenerationConfig = (generationConfig = {}) => {
    const config = {
        temperature: generationConfig.temperature,
        topP: generationConfig.topP,
        topK: generationConfig.topK,
        maxOutputTokens: generationConfig.maxOutputTokens || 2048,
    };

    if (generationConfig.responseMimeType) {
        config.responseMimeType = generationConfig.responseMimeType;
    }

    if (generationConfig.responseSchema) {
        config.responseSchema = generationConfig.responseSchema;
    }

    return config;
};

const createChatSession = ({ generationConfig = {}, history = [] } = {}) => {
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL_NAME,
        generationConfig: buildGenerationConfig(generationConfig),
    });

    const chat = model.startChat({
        history: normalizeHistory(history),
    });

    return {
        async sendMessage(prompt) {
            const result = await chat.sendMessage(toMessageContent(prompt));
            const text = getResponseText(result?.response);

            return {
                response: {
                    text: () => text,
                },
                rawResponse: result?.response,
            };
        },
    };
};

export const model = {
    startChat: createChatSession,
};

/**
 * Helper to call Gemini with retry logic.
 */
export async function sendMessageWithRetry(chatSession, prompt, maxRetries = 5) {
    let delay = 3000;

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await chatSession.sendMessage(prompt);
        } catch (error) {
            if (shouldRetry(error) && i < maxRetries - 1) {
                // Add jitter (0-30% random extra) to avoid thundering herd
                const jitter = Math.floor(delay * Math.random() * 0.3);
                const waitMs = delay + jitter;
                console.warn(`[Gemini] API busy/503 (Attempt ${i + 1}/${maxRetries}). Retrying in ${waitMs}ms...`);
                await new Promise((resolve) => setTimeout(resolve, waitMs));
                delay = Math.min(delay * 2, 30000); // cap at 30s
                continue;
            }
            throw error;
        }
    }
}

const CodeGenerationSchema = {
    type: "object",
    required: ["projectTitle", "explanation", "files", "generatedFiles"],
    properties: {
        projectTitle: { type: "string", description: "Project title" },
        explanation: { type: "string", description: "Short user-facing summary" },
        files: {
            type: "array",
            items: {
                type: "object",
                required: ["path", "code"],
                properties: {
                    path: { type: "string", description: "Absolute file path like /index.html" },
                    code: { type: "string", description: "Full file contents" }
                }
            }
        },
        generatedFiles: {
            type: "array",
            items: { type: "string" }
        }
    }
};

const EnhancePromptSchema = {
    type: "object",
    required: ["userFacingPrompt", "technicalPrompt"],
    properties: {
        userFacingPrompt: { type: "string" },
        technicalPrompt: { type: "string" }
    }
};

export const generationConfig = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 16384,
    responseMimeType: "text/plain",
};

export const CodeGenerationConfig = {
    temperature: 0.1,
    topP: 0.7,
    topK: 40,
    maxOutputTokens: 24576,
    responseMimeType: "application/json",
    responseSchema: CodeGenerationSchema,
};

export const EnhancePromptConfig = {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 16384,
    responseMimeType: "application/json",
    responseSchema: EnhancePromptSchema,
};
