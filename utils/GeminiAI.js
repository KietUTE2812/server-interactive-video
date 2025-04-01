import dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AssemblyAI } from 'assemblyai';
import fs from 'fs';

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

GeminiAI("What is the capital of France?")

export default GeminiAI;



