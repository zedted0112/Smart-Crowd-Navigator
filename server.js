require('dotenv').config();
const express = require('express');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("CRITICAL: GEMINI_API_KEY is missing from environment!");
} else {
    console.log("Gemini API Key detected. Initializing AI...");
}

const genAI = new GoogleGenerativeAI(apiKey || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// AI Intent Parsing Endpoint
app.post('/api/chat/parse', async (req, res) => {
    const { text } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Missing API Key", fallback: true });
    }

    const prompt = `
        You are an intent parser for a Smart Venue Navigator.
        Given a user query, return ONLY a valid JSON object with the intent.
        
        Intents:
        - FIND_FACILITY (types: washroom, food)
        - FIND_FRIEND
        - NAVIGATE_TO (types: seat)
        - UNKNOWN

        Examples:
        "I need to pee" -> {"intent": "FIND_FACILITY", "type": "washroom"}
        "im hungry" -> {"intent": "FIND_FACILITY", "type": "food"}
        "show me my friend" -> {"intent": "FIND_FRIEND"}
        "take me to my seat" -> {"intent": "NAVIGATE_TO", "type": "seat"}

        Query: "${text}"
    `;

    try {
        // Try flash first
        let result;
        try {
            result = await model.generateContent(prompt);
        } catch (e) {
            console.warn("Flash failed, falling back to gemini-pro...");
            const backupModel = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });
            result = await backupModel.generateContent(prompt);
        }

        const responseText = result.response.text().trim();
        const jsonMatch = responseText.match(/\{.*\}/s);
        const intentJson = jsonMatch ? JSON.parse(jsonMatch[0]) : { intent: "UNKNOWN" };
        res.json(intentJson);
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI Failed", fallback: true });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
