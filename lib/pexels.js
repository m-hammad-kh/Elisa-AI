
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;
const PEXELS_TIMEOUT_MS = 8000;

export async function getPexelsImage(query, orientation = 'landscape') {
    if (!PEXELS_API_KEY) {
        console.error("PEXELS_API_KEY is missing!");
        return "https://archive.org/download/placeholder-image/placeholder.png"; // Fallback
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PEXELS_TIMEOUT_MS);
        const randomPage = Math.floor(Math.random() * 5) + 1;
        const response = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=40&page=${randomPage}&orientation=${orientation}`, {
            headers: {
                Authorization: PEXELS_API_KEY,
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`Pexels API error: ${response.statusText}`);
        }

        const data = await response.json();
        if (data.photos && data.photos.length > 0) {
            // Pick a random photo from the results to prevent duplication
            const randomIndex = Math.floor(Math.random() * data.photos.length);
            return data.photos[randomIndex].src.large;
        } else {
            return "https://archive.org/download/placeholder-image/placeholder.png"; // Fallback if no photo found
        }
    } catch (error) {
        if (error?.name === 'AbortError') {
            console.error("Pexels request timed out.");
        } else {
            console.error("Error fetching Pexels image:", error);
        }
        return "https://archive.org/download/placeholder-image/placeholder.png"; // Fallback
    }
}
