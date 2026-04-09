import {
    GoogleGenerativeAI,
} from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

// Model name changed to stable version
export const model = genAI.getGenerativeModel({
    model: "gemini-2.0-flash",
});

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
};

export const EnhancePromptConfig = {
    temperature: 0.7,
    topP: 0.8,
    topK: 40,
    maxOutputTokens: 8192, // Increased for longer enhanced specs
    responseMimeType: "application/json",
};
