import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();
const client = new OpenAI({
    baseURL: "https://api-inference.huggingface.co/v1/",
    apiKey: "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"
})
let out = "";
async function generateRoadmap(prompt) {
    try {
        const stream = await client.chat.completions.create({
            model: "Qwen/Qwen2.5-Coder-32B-Instruct",
            messages: [
                { role: "user", content: prompt },
            ],
            temperature: 0.5,
            max_tokens: 2048,
            top_p: 0.7,
            stream: true,
        });

        for await (const chunk of stream) {
            if (chunk.choices && chunk.choices.length > 0) {
                const newContent = chunk.choices[0].delta.content;
                out += newContent;
            }
        }

        return extractJSONFromString(out)
    } catch (error) {
        console.error("Error generating roadmap:", error);
        throw error; // Bắt và xử lý lỗi nếu có
    }
}
function extractJSONFromString(text) {
    try {
        // Tìm vị trí bắt đầu và kết thúc của JSON
        const jsonStart = text.indexOf('```json\n') + '```json\n'.length;
        const jsonEnd = text.indexOf('\n```', jsonStart);

        if (jsonStart === -1 || jsonEnd === -1) {
            throw new Error('Không tìm thấy JSON hợp lệ trong chuỗi');
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
        console.error('Lỗi khi xử lý JSON:', error);
        return {
            success: false,
            message: error.message,
            error: error
        };
    }
}

export default generateRoadmap;
