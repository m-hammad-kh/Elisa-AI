import { model, generationConfig, sendMessageWithRetry, fallbackModel } from "@/configs/AiModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    const { prompt } = await req.json();

    try {
        let chatSession = model.startChat({
            generationConfig,
            history: [],
        });
        
        let result;
        try {
            result = await sendMessageWithRetry(chatSession, prompt);
        } catch (retryError) {
            // If primary model fails after retries, try fallback model
            console.error("Primary model failed, trying fallback...", retryError.message);
            chatSession = fallbackModel.startChat({
                generationConfig,
                history: [],
            });
            result = await sendMessageWithRetry(chatSession, prompt, 2);
        }

        const AIResp = result.response.text();

        return NextResponse.json({ result: AIResp });
    } catch (e) {
        console.error("AI Chat Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}