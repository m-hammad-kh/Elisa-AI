import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Using gemini-2.0-flash as a more stable alternative if 2.5-flash-lite is busy
const PRIMARY_MODEL = "gemini-2.5-flash-lite";
const FALLBACK_MODEL = "gemini-2.0-flash";

export const model = genAI.getGenerativeModel({
    model: PRIMARY_MODEL,
});

export const fallbackModel = genAI.getGenerativeModel({
    model: FALLBACK_MODEL,
});

/**
 * Helper to call Gemini with retry logic and model fallback
 */
export async function sendMessageWithRetry(chatSession, prompt, maxRetries = 3) {
    let delay = 2000; // Start with 2s delay

    for (let i = 0; i < maxRetries; i++) {
        try {
            return await chatSession.sendMessage(prompt);
        } catch (error) {
            const errorMsg = error.message || "";
            const isRetryable = errorMsg.includes("503") || errorMsg.includes("429") || errorMsg.includes("Service Unavailable") || errorMsg.includes("high demand");

            if (isRetryable && i < maxRetries - 1) {
                console.warn(`Gemini API busy (Attempt ${i + 1}/${maxRetries}). Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
                continue;
            }
            
            // If it's a 503 and we've exhausted retries, or if it's a specific model error, 
            // we could potentially try a different model here, but chatSession is bound to a model.
            // So we handle model fallback at the route level if needed.
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
