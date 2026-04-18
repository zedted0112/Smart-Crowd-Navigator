require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function verify() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }
    
    console.log("Checking API key validity...");
    const genAI = new GoogleGenerativeAI(apiKey);

    try {
        // Try a simple prompt with a more standard model name if flash fails
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Say 'API Key is working!'");
        const response = await result.response;
        console.log("Success! Response:", response.text());
    } catch (error) {
        console.error("Gemini Flash failed, trying Gemini Pro...");
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const result = await model.generateContent("Say 'API Key is working with Gemini Pro!'");
            const response = await result.response;
            console.log("Success with Pro! Response:", response.text());
        } catch (proError) {
            console.error("All attempts failed.");
            console.error("Error Details:", proError.message);
            if (proError.status === 403) {
                console.error("Auth error: API key might be invalid or not enabled for Generative Language API.");
            } else if (proError.status === 404) {
                console.error("Model not found. This might be a Vertex AI key being used with the AI Studio library.");
            }
        }
    }
}

verify();
