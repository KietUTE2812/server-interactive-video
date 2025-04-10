import OpenAI from "openai";
import dotenv from "dotenv";
import Agent from "./OpenAIAgent.js";
dotenv.config();

const apiKey = process.env.OPENAI_KEY;
const url = "https://openrouter.ai/api/v1";
const model = "qwen/qwen-2.5-coder-32b-instruct:free";

const agent = new Agent(); // Tạo một instance của Agent để sử dụng AI API
agent.config(null, url, apiKey);

async function generateRoadmap(prompt) {
    console.log("Generating roadmap");
    try {
        const response = await agent.generate(prompt, 2048, 1, false, "JSON");
        const jsonData = JSON.parse(response);
        return {
            success: true,
            data: jsonData
        }
    } catch (error) {
        console.error("Error generating roadmap:", error);
        return {
            success: false,
            error: error.message || "Unknown error"
        };
    }
}
    
function extractJSONFromString(text) {
    try {
        // Tìm vị trí bắt đầu và kết thúc của JSON
        const jsonStart = text.indexOf('```json\n') + '```json\n'.length;
        const jsonEnd = text.indexOf('\n```', jsonStart);

        if (jsonStart === -1 || jsonEnd === -1) {
            return null;
        }

        // Trích xuất chuỗi JSON
        const jsonString = text.substring(jsonStart, jsonEnd);

        // Parse JSON
        const jsonData = JSON.parse(jsonString);

        return {
            success: true,
            data: jsonData
        };

    } catch (error) {
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
}

const generateChartCode = async (prompt) =>
{
    try {
        const response = await agent.generate(prompt, 2048, 0.7, true, "Mermaid Chart Code");
        return {
            success: true,
            data: response
        }
    } catch (error) {
        console.error("Error generating roadmap:", error);
        return {
            success: false,
            error: error.message || "Unknown error"
        };
    }
}

const extractMermaidChart = (text) => {
    const mermaidStart = text.indexOf('---\n') + '---\n'.length;
    const mermaidEnd = text.indexOf('\n---', mermaidStart);
    if (mermaidStart === -1 || mermaidEnd === -1) {
        return null;
    }
    return {
        success: true,
        data: text.substring(mermaidStart, mermaidEnd)
    };
}


export default { generateRoadmap, generateChartCode };
