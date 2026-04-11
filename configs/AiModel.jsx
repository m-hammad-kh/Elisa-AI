import {
    GoogleGenerativeAI,
} from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Model name changed to stable version
export const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});

const CodeGenerationSchema = {
    type: "object",
    required: ["projectTitle", "explanation", "files", "generatedFiles"],
    properties: {
        projectTitle: { type: "string", description: "Project title" },
        explanation: { type: "string", description: "Short user-facing summary" },
        files: {
            // IMPORTANT: Schema-based generation does not support dynamic object keys reliably.
            // Use an array instead and convert to a map server-side.
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
    maxOutputTokens: 8192, // Maximum allowed output tokens
    responseMimeType: "text/plain",
};

export const CodeGenerationConfig = {
    temperature: 0.5, // Reduced for more focused/reliable long generation
    topP: 0.9,
    topK: 40,
    maxOutputTokens: 8192, // Maximum generation limit for Gemini 2.0 Flash
    responseMimeType: "application/json",
    responseSchema: CodeGenerationSchema,
};

export const EnhancePromptConfig = {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192, // Increased for longer enhanced specs
    responseMimeType: "application/json",
    responseSchema: EnhancePromptSchema,
};
