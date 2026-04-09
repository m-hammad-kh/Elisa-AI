import { model, EnhancePromptConfig } from "@/configs/AiModel";
import Prompt from "@/data/Prompt";
import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { prompt } = await request.json();
        
        const chatSession = model.startChat({
            generationConfig: EnhancePromptConfig,
            history: [],
        });

        const result = await chatSession.sendMessage([
            Prompt.ENHANCE_PROMPT_RULES,
            `Original prompt: ${prompt}`
        ]);
        
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
            
        } catch (parseError) {
            console.error("Enhance Prompt Parse Error:", parseError);
            console.error("Raw Response:", text);
            console.error("Cleaned Response:", cleanText);
            throw parseError; // Re-throw to be caught by outer catch
        }

        return NextResponse.json(jsonResponse);
    } catch (error) {
        console.error("Enhance Prompt Error:", error);
        return NextResponse.json({ 
            error: error.message,
            success: false 
        }, { status: 500 });
    }
} 