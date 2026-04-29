
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_TIMEOUT_MS = 8000;

// Reliable fallback that always returns a random image
const FALLBACK_IMAGE = (w = 800, h = 600) =>
    `https://picsum.photos/${w}/${h}?random=${Math.floor(Math.random() * 10000)}`;

async function fetchPexels(query, orientation, page = 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), PEXELS_TIMEOUT_MS);
    try {
        const response = await fetch(
            `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40&page=${page}&orientation=${orientation}`,
            { headers: { Authorization: PEXELS_API_KEY }, signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Pexels API error: ${response.statusText}`);
        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            const randomIndex = Math.floor(Math.random() * data.photos.length);
            return data.photos[randomIndex].src.large;
        }
        return null;
    } catch (error) {
        clearTimeout(timeoutId);
        if (error?.name === 'AbortError') {
            console.error("Pexels request timed out.");
        } else {
            console.error("Error fetching Pexels image:", error);
        }
        return null;
    }
}

export async function getPexelsImage(query, orientation = 'landscape') {
    if (!PEXELS_API_KEY) {
        console.error("PEXELS_API_KEY is missing!");
        return FALLBACK_IMAGE();
    }

    const randomPage = Math.floor(Math.random() * 5) + 1;

    // First attempt with original query
    let result = await fetchPexels(query, orientation, randomPage);
    if (result) return result;

    // Retry with simplified query (first word only) — improves hit rate
    const simplified = query.replace(/[+%20]/g, ' ').trim().split(/\s+/)[0];
    if (simplified && simplified !== query) {
        result = await fetchPexels(simplified, orientation, 1);
        if (result) return result;
    }

    // Final fallback — always loads
    return FALLBACK_IMAGE();
}
