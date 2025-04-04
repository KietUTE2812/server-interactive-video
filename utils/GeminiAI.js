import dotenv from "dotenv";
// import { OpenAI } from "langchain/llms/openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AssemblyAI } from 'assemblyai';
import fs from 'fs';
import axios from "axios";

dotenv.config();

// console.log("API Key:", process.env.GEMINI_KEY);


const genAI = new GoogleGenerativeAI(process.env.GEMINI_KEY);


async function GeminiAI(prompt) {
    try {
        console.log("API Key:", process.env.GEMINI_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

        // Thử tạo nội dung đơn giản
        const result = await model.generateContent(prompt);

        return result.response.text();
    } catch (error) {
        console.error("Error with gemini-1.5-pro:", error.message);


    }
}



async function OpenAI(
    prompt,
    {
        model = "gpt-4o",
        temperature = 0.7,
        max_tokens = 1024,
        topP = 1,
        presencePenalty = 0,
        frequencyPenalty = 0,
        stopSequences = null
    } = {}

) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        throw new Error('OPENAI_API_KEY not found in environment variables');
    }
    try {
        const response = await axios.post('https://api.openai.com/v1/chat/completions', {
            model,
            messages: [{ role: 'user', content: prompt }],
            temperature,
            max_tokens,
            top_p: topP,
            presence_penalty: presencePenalty,
            frequency_penalty: frequencyPenalty,
            stop: stopSequences
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            }
        });
        return {
            success: true,
            data: response.data,
            text: response.data.choices[0].message.content,
            usage: response.data.usage,
        }
    } catch (error) {
        console.error("Error with OpenAI:", error.message);
        if (error.response) {
            console.error("Response data:", error.response.data);
        }
        return {
            success: false,
            error: error.message,
            response: error.response ? error.response.data : null
        };
    }
}

// OpenAI("update me about the latest news in AI")

export default GeminiAI;



