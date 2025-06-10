import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import readline from "readline";
import dotenv from "dotenv";
import { GoogleGenAI, mcpToTool, Type, FunctionCallingConfigMode } from "@google/genai";
import ChatHistory from "../models/ChatHistory.js";
import Course from "../models/Course.js";

dotenv.config();
const genAI = new GoogleGenAI({
    apiKey: process.env.GEMINI_KEY,
});

class MCPClient {
    constructor() {
        this.mcp = new Client({
            name: "chatbot",
            version: "1.0.0",
            capabilities: {
                resources: {},
                tools: {},
                prompts: {},
            },
        });
        this.transport = null;
        this.tools = [];
        this.genAI = genAI;
        this.toolMemory = [];
    }
    async connectToServer(serverScriptPath) {
        try {
            const isJs = serverScriptPath.endsWith(".js");
            const isPy = serverScriptPath.endsWith(".py");
            if (!isJs && !isPy) {
              throw new Error("Server script must be a .js or .py file");
            }
            const command = isPy
              ? process.platform === "win32"
                ? "python"
                : "python3"
              : process.execPath;
        
            this.transport = new StdioClientTransport({
              command,
              args: [serverScriptPath],
            });
            this.mcp.connect(this.transport);
        
            const toolsResult = await this.mcp.listTools();
            this.tools = toolsResult.tools.map((tool) => {
              return {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema,
              };
            });
          } catch (e) {
            console.log("Failed to connect to MCP server: ", e);
            throw e;
          }
    }
    async processQuery(query, userId) {
      console.log("query", query, userId);
        try {
          const history = await this.getChatHistory(userId);
          // Lưu lại câu hỏi của user
          await this.saveChatHistory(userId, {role: "user", content: query});
          const promptWithHistory = history.messages.length > 0 ? history.messages.map(h => `${h.role}: ${h.content}`).join('\n') + `\nuser: ${query}` : `user: ${query}`;
          const response = await this.genAI.models.generateContent({
            model: "gemini-2.0-flash",
            contents: promptWithHistory,
            config: {
              tools: [mcpToTool(this.mcp)],
              systemInstruction: "You are a helpful assistant that can use tools to answer questions. You can also use the following tools to answer questions: " + this.tools.map(t => t.name).join(", ") + "."+ "Here is the tool memory of the previous conversation: " + this.toolMemory.toLocaleString() 
              + "Note: Don't use the tool 'search_anything_in_web' if you don't have to. Don't rename the course name. Here is the list of all courses for your reference: " + this.getAllCourses()
              + "Response in the same language as the user's question. Understand all courses in the list of all courses for your reference. If you response the recommend course for user, please wrap the correct cours id in <course> tags. Example: <course>682bf39d74c417c7ac69058b</course> or <course>67642b54d0b28b42614df87e</course>",
            },
          });
          await this.saveChatHistory(userId, {role: "bot", content: response.text});
          if (response.automaticFunctionCallingHistory.length > 0){
            const toolCalls = response.automaticFunctionCallingHistory.map(m => m.parts.map(p => p.functionResponse)[0]);
            this.toolMemory.push(toolCalls.filter(t => t !== undefined)[0]);
            console.dir(this.toolMemory, {depth: null});
          }
          return response.text
        } catch (e) {
            console.log("Error: ", e);
            return "Error: " + e;
        }
    }

    async saveChatHistory(userId, message) {
        const chatHistory = await ChatHistory.findOne({userId: userId});
        if (chatHistory) {
            chatHistory.messages.push({role: message.role, content: message.content});
            await chatHistory.save();
        } else {
            await ChatHistory.create({userId: userId, messages: [{role: message.role, content: message.content}]});
        }
        return chatHistory;
    }

    async getAllCourses() {
      const courses = await Course.find({status: "published", isApproved: true}).select("title description averageRating enrollmentCount tags level price");
      console.log(courses);
      return courses.toLocaleString();
    }

    async getChatHistory(userId) {
      // Lấy lịch sử chat gần nhất (30 lượt)
        const chatHistory = await ChatHistory.findOne({userId: userId});
        if (chatHistory) {
            return {
              ...chatHistory,
              messages: chatHistory.messages.slice(-30)
            };
        } else {
            await ChatHistory.create({userId: userId, messages: []});
            return {messages: []};
        }
    }
    

    async chatLoop() {
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout,
        });
        const questionAsync = (prompt) => {
            return new Promise((resolve) => {
              rl.question(prompt, resolve);
            });
        };
        try {
          console.log("\nMCP Client Started!");
          console.log("Type your queries or 'quit' to exit.");
      
          while (true) {
            const message = await questionAsync("\nQuery: ");
            if (message.toLowerCase() === "quit") {
              break;
            }
            const response = await this.processQuery(message);
            console.log("\n" + response);
          }
        } finally {
          rl.close();
        }
      }
      
    async cleanup() {
    await this.mcp.close();
    }
      
}
async function main() {
    if (process.argv.length < 3) {
      console.log("Usage: node index.ts <path_to_server_script>", process.argv);
      return;
    }
    const mcpClient = new MCPClient();
    try {
      await mcpClient.connectToServer(process.argv[2]);
      await mcpClient.chatLoop();
    } finally {
      await mcpClient.cleanup();
      process.exit(0);
    }
  }

const mcpClient = new MCPClient();


export default mcpClient;