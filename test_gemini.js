require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');

async function testGemini() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.error("No API key found in .env");
        return;
    }
    console.log("Testing Gemini with key:", apiKey.substring(0, 10) + "...");
    
    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent("Hello, are you working?");
        console.log("Response:", result.response.text());
    } catch (error) {
        console.error("Gemini failed:", error);
    }
}

testGemini();
