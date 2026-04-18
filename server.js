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
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });

app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// AI Assistant Endpoint
app.post('/api/chat/parse', async (req, res) => {
    const { text, context } = req.body;
    
    if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "Missing API Key", fallback: true });
    }

    const systemPrompt = `
        You are a highly precise intent parser for a Smart Venue.
        
        RETURN ONLY VALID JSON. NO PREAMBLE. NO MARKDOWN. NO CODE BLOCKS.
        
        SUPPORTED INTENTS:
        - FIND_WASHROOM
        - FIND_FOOD
        - FIND_FRIEND
        - NAVIGATE_TO (type: seat)
        - UNKNOWN

        EXAMPLES:
        "i need a toilet" -> {"intent":"FIND_WASHROOM"}
        "find food" -> {"intent":"FIND_FOOD"}
        "where is my friend" -> {"intent":"FIND_FRIEND"}
        "take me to my chair" -> {"intent":"NAVIGATE_TO", "type":"seat"}

        VENUE CONTEXT (Use for specific recommendations if appropriate):
        Scenario: ${context?.scenario || 'Normal'}
        Facilities Status: ${JSON.stringify(context?.facilities || [])}

        NOW PARSE:
        "${text}"
    `;

    try {
        const result = await model.generateContent(systemPrompt);
        const rawResponse = result.response.text().trim();
        console.log("[AI Raw Response]:", rawResponse);
        
        // Safe JSON extraction
        let cleanJson = rawResponse;
        if (rawResponse.includes('{')) {
            cleanJson = rawResponse.substring(rawResponse.indexOf('{'), rawResponse.lastIndexOf('}') + 1);
        }
        
        const jsonRes = JSON.parse(cleanJson);
        console.log("[AI Parsed Intent]:", jsonRes.intent);
        
        res.json(jsonRes);
    } catch (error) {
        console.error("Gemini Error:", error);
        res.status(500).json({ error: "AI Failed", fallback: true });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
