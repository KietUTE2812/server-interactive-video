import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getCourseDetails, getAllCourses, searchCourse, getCourseReviews, getPopularCourses } from "./toolFunction.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
  } from '@modelcontextprotocol/sdk/types.js';

const tools = [
    {
        name: "get_course_details",
        description: "Get the details of a course by id",
        inputSchema: {
            type: 'object',
            properties: {
                id: {
                    type: 'string',
                    description: 'The id of the course to get details of',
                },
            },
            required: ['id'],
        },
        callback: getCourseDetails,
    },
    {
        name: "get_all_courses",
        description: "Get all courses",
        inputSchema: {
            type: 'object',
        },
        callback: getAllCourses,
    },
    {
        name: "search_course",
        description: "Search for a course by title, description, or tags",
        inputSchema: {
            type: 'object',
            properties: {
                query: {
                    type: 'string',
                    description: 'The query to search for (title, description, or tags)',
                },
            },
            required: ['query'],
        },
        callback: searchCourse,
    }
]

class CodeChefServer {
    constructor() {
        this.server = new Server({
            name: "CodeChefServer",
            version: "1.0.0",
        });
    }
    setupToolHandler = () => {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: tools.map(t => ({
                    name: t.name,
                    description: t.description,
                    inputSchema: t.inputSchema,
                })),
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const tool = tools.find(t => t.name === request.toolName);
            if (!tool) {
                throw new McpError(ErrorCode.ToolNotFound, `Tool ${request.toolName} not found`);
            }
            return tool.callback(request.args);
        });
    };
    async start() {
        const transport = new StdioServerTransport();
        await this.server.start(transport);
        console.log("Server started");
    }
}

const server = new CodeChefServer();
server.setupToolHandler();
server.start().catch(console.error);
