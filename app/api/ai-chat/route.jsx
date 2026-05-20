import { model, generationConfig, sendMessageWithRetry } from "@/configs/AiModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    let prompt = "";
    try {
        const body = await req.json();
        prompt = body?.prompt || "";
        let chatSession = model.startChat({
            generationConfig,
            history: [],
        });
        
        const result = await sendMessageWithRetry(chatSession, prompt, 5);
        const AIResp = result.response.text();

        return NextResponse.json({ result: AIResp });
    } catch (e) {
        console.error("AI Chat Error:", e);
        const extractLatestUserRequest = () => {
            const input = typeof prompt === "string" ? prompt : "";
            const start = input.indexOf("[");
            const end = input.indexOf("]");
            if (start !== -1 && end > start) {
                try {
                    const parsed = JSON.parse(input.slice(start, end + 1));
                    const latest = [...parsed].reverse().find((item) => item?.role === "user" && typeof item?.content === "string");
                    if (latest?.content?.trim()) return latest.content.trim();
                } catch {
                    return "";
                }
            }
            return "";
        };
        const latestRequest = extractLatestUserRequest();
        return NextResponse.json({
            result: latestRequest
                ? `I am working on "${latestRequest.slice(0, 120)}" and keeping the website update focused on your request.`
                : "I am working on your latest website request and keeping the preview stable.",
            fallbackUsed: true,
            error: e?.message || "AI chat failed"
        });
    }
}
