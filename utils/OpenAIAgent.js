import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

class Agent {
    model = 'deepseek/deepseek-r1-zero:free';
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
                        content: `You are a backend AI assistant. Always return a valid ${return_type || this.return_type}  as the response. Do not include any explanations, reasoning, or additional text.`
                    },
                    { role: "user", content: prompt },
                ],
                max_tokens: max_token,
                temperature: temperature,
                stream: stream
            });
            let out = "";
            for await (const chunk of response) {
                if (chunk.choices?.[0]?.delta?.content) {
                    out += chunk.choices[0].delta.content;
                }
            }
            
            return out;
        }
        catch (error) {
            console.error("Error generating response:", error);
            throw error;
        }
    }
}

export default Agent;