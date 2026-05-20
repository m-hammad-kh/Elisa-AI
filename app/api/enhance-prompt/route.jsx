import { model, EnhancePromptConfig, sendMessageWithRetry } from "@/configs/AiModel";
import Prompt from "@/data/Prompt";
import { NextResponse } from 'next/server';

const makePromptLike = (value, originalPrompt = "") => {
    const raw = typeof value === "string" ? value.trim() : "";
    const fallback = typeof originalPrompt === "string" && originalPrompt.trim()
        ? originalPrompt.trim()
        : "Create a modern, responsive, polished website with strong visual hierarchy.";
    const text = raw || fallback;

    if (/^(create|build|design|develop|make|generate)\b/i.test(text)) {
        return text;
    }

    const cleaned = text
        .replace(/^(sure|absolutely|certainly|of course)[,!\s-]*/i, "")
        .replace(/\b(i will|i'll|we will|we'll)\b/gi, "Create")
        .replace(/\b(for you|our team)\b/gi, "")
        .trim();

    return `Create a polished website based on this brief:\n\n${cleaned || fallback}`;
};

export async function POST(request) {
    let prompt = "";
    try {
        const body = await request.json();
        prompt = body?.prompt || "";
        
        const chatSession = model.startChat({
            generationConfig: EnhancePromptConfig,
            history: [],
        });

        const fullPrompt = [
            Prompt.ENHANCE_PROMPT_RULES,
            `Original prompt: ${prompt}`
        ];

        const result = await sendMessageWithRetry(chatSession, fullPrompt);
        const text = result.response.text();
        
        // Robust JSON extraction
        let cleanText = text.trim();
        const jsonStartIndex = cleanText.indexOf('{');
        const jsonEndIndex = cleanText.lastIndexOf('}');
        
        if (jsonStartIndex !== -1 && jsonEndIndex !== -1) {
            cleanText = cleanText.substring(jsonStartIndex, jsonEndIndex + 1);
        } else {
             // Fallback
            cleanText = cleanText.replace(/```json\n?|\n?```/g, '').trim();
        }
        
        let jsonResponse;
        try {
            jsonResponse = JSON.parse(cleanText);
            
            // Map new format to the expected keys
            if (!jsonResponse.userFacingPrompt && jsonResponse.enhancedPrompt) {
                jsonResponse.userFacingPrompt = jsonResponse.enhancedPrompt;
            }
            if (!jsonResponse.technicalPrompt && jsonResponse.enhancedPrompt) {
                jsonResponse.technicalPrompt = jsonResponse.enhancedPrompt;
            }
            jsonResponse.userFacingPrompt = makePromptLike(jsonResponse.userFacingPrompt, prompt);
            jsonResponse.technicalPrompt = makePromptLike(jsonResponse.technicalPrompt || jsonResponse.userFacingPrompt, prompt);
            
        } catch (parseError) {
            console.error("Enhance Prompt Parse Error:", parseError);
            console.error("Raw Response:", text);
            console.error("Cleaned Response:", cleanText);
            throw parseError; // Re-throw to be caught by outer catch
        }

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error("Enhance Prompt Error:", error);
        const fallbackPrompt = makePromptLike([
            typeof prompt === "string" && prompt.trim()
                ? prompt.trim()
                : "Create a modern, responsive, polished website with strong visual hierarchy.",
            "",
            "Requirements:",
            "- Build a complete home page with 6-9 meaningful sections.",
            "- Include a premium non-overlapping hero, relevant visuals, strong contrast, and clear CTAs.",
            "- Include a contact experience with form, contact details, and a visible map.",
            "- Use valid JSX, correct imports/exports, and reliable responsive layout."
        ].join("\n"), prompt);

        return NextResponse.json({
            userFacingPrompt: fallbackPrompt,
            technicalPrompt: [
                fallbackPrompt,
                "Build this as a reliable React/Vite website.",
                "Use section-anchor navigation for single-page sites or one BrowserRouter in /index.jsx for multi-page sites.",
                "Avoid circular hero media masks, overlapping text/media, low contrast, invalid JSX, and unsupported dependencies."
            ].join(" "),
            fallbackUsed: true,
            error: error?.message || "Prompt enhancement failed",
            success: false
        });
    }
}
