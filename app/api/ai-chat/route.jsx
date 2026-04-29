import { model, generationConfig, sendMessageWithRetry } from "@/configs/AiModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    const { prompt } = await req.json();

    try {
        let chatSession = model.startChat({
            generationConfig,
            history: [],
        });
        
        const result = await sendMessageWithRetry(chatSession, prompt);
        const AIResp = result.response.text();

        return NextResponse.json({ result: AIResp });
    } catch (e) {
        console.error("AI Chat Error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}