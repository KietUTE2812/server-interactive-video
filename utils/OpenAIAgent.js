import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

class Agent {
    model = 'qwen/qwen-2.5-coder-32b-instruct:free';
    url = 'https://openrouter.ai/api/v1'
    apiKey = process.env.OPENAI_KEY;
    client = new OpenAI({
        baseURL: this.url,
        apiKey: this.apiKey,
    });

    config = (model, url, apiKey) => {
        this.model = model ? model : this.model;
        this.url = url ? url : this.url;
        this.apiKey = apiKey ? apiKey : this.apiKey;
        this.client = new OpenAI({
            baseURL: this.url,
            apiKey: this.apiKey,
        });
    }

    generate = async (prompt, max_token = 1024, temperature = 1, stream = true, return_type) => {
        try {
            const response = await this.client.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: `You are a backend AI assistant. Return a compact ${return_type || 'JSON'} with no unnecessary whitespace or newlines.
                        `
                    },
                    { role: "user", content: prompt },
                ],
                max_tokens: max_token,
                temperature: temperature,
                stream: stream
            });
            let out = "";

            if (stream && response[Symbol.asyncIterator]) {
                for await (const chunk of response) {
                    if (chunk.choices?.[0]?.delta?.content) {
                        out += chunk.choices[0].delta.content;
                    }
                }
            } else {
                out = response?.choices?.[0]?.message?.content || "";
            }
            return out;
        }
        catch (error) {
            console.error("Error generating response:", error);
            throw error;
        }
    }
    extractJSONFromString(text) {
        try {
            const jsonMatch = text.match(/\{[\s\S]*\}/); // Tìm JSON trong chuỗi
            if (!jsonMatch) {
                throw new Error("Không tìm thấy JSON hợp lệ trong phản hồi.");
            }
    
            return {
                success: true,
                data: JSON.parse(jsonMatch[0]) // Parse JSON từ kết quả tìm được
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
                error: error
            };
        }
    }
    
}

export default Agent;