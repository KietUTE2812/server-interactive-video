import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import Course from "../models/Course.js";
import Review from "../models/Review.js";
import mongoose from "mongoose";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const server = new McpServer({
    name: "chatbot",
    version: "1.0.0",
    capabilities: {
        resources: {},
        tools: {},
        prompts: {},
    },
});

async function connect() {
    await mongoose.connect('mongodb+srv://21110517:tankiet%402003@tankiet.nsmqp.mongodb.net/codechef?retryWrites=true&w=majority&appName=Tankiet', {
      useUnifiedTopology: true,
    });
}

async function close() {
    await mongoose.connection.close();
}





const popularCourses = async (topN=10, weightRating=0.5, weightEnrollment=0.5) => {
    try {
        // 2. Lấy danh sách tất cả khóa học đã công khai
        const courses = await Course.find({
          status: 'published',
          isApproved: true
        }).populate({
          path: 'instructor',
          select: 'username profile.fullname profile.picture'
        });
        
        if (courses.length === 0) {
          return [];
        }
        
        // 3. Tính điểm phổ biến cho mỗi khóa học
        const scoredCourses = courses.map(course => {
          // Chuẩn hóa điểm đánh giá (từ 0-5 hoặc 0-10)
          const normalizedRating = course.averageRating 
            ? (course.averageRating > 5 ? course.averageRating / 10 : course.averageRating / 5)
            : 0.5; // Điểm mặc định nếu không có đánh giá
          
          // Lấy số lượng đăng ký
          const enrollmentCount = course.enrollmentCount || 0;
          
          // Tìm khóa học có enrollment cao nhất để chuẩn hóa
          const maxEnrollment = Math.max(...courses.map(c => c.enrollmentCount || 0));
          
          // Chuẩn hóa số lượng đăng ký (0-1)
          const normalizedEnrollment = maxEnrollment > 0 ? enrollmentCount / maxEnrollment : 0;
          
          // Tính điểm tổng hợp
          const popularityScore = 
            (normalizedRating * weightRating) + 
            (normalizedEnrollment * weightEnrollment);
          
          return {
            _id: course._id,
            title: course.title,
            description: course.description,
            instructor: course.instructor,
            price: course.price,
            level: course.level,
            photo: course.photo,
            tags: course.tags || [],
            averageRating: course.averageRating || 0,
            enrollmentCount,
            popularityScore: Math.round(popularityScore * 100) / 100
          };
        });
        
        // 4. Sắp xếp theo điểm phổ biến và lấy top N
        const popularCourses = scoredCourses
          .sort((a, b) => b.popularityScore - a.popularityScore)
          .slice(0, topN);
        return popularCourses;
    } catch (error) {
        console.error('Lỗi trong quá trình gợi ý khóa học phổ biến:', error);
        return [];
    }

}

server.tool("get_list_courses", "Get the list of courses", async () => {
    await connect();
    const courses = await Course.find({status: "published", isApproved: true}).select("title description courseId tags");
    await close();
    return {
        courses: courses.map(course => ({
            _id: course._id,
            title: course.title,
            description: course.description,
            courseId: course.courseId,
            tags: course.tags
        })),
    };
});

server.tool("search_course", "Search for courses by title, or tags (Parameter)", {
    query: z.string().describe("The query to search for (title, description, or tags)"),
}, async (args) => {
    await connect();
    const courses = await Course.find({
        $or: [
            { title: { $regex: args.query || "", $options: "i" } },
            { tags: { $in: args.query?.split(",") || [] } }
        ]
    });
    await close();
    return {
        courses: courses.map(course => ({
            _id: course._id,
            title: course.title,
            description: course.description,
        })),
    };
})

server.tool("get_course_details_by_id_or_title", "Get the details of a course by id or title (Parameter)", {
    query: z.string().describe("The query to search for (id or title)"),
}, async (args) => {
    await connect();
    let course;
    if (args?.query.length === 24) {
        course = await Course.findById(args?.query);
    } else {
        course = await Course.findOne({title: args?.query});
    }
    await close();
    return {
        course: course,
    };
});

server.tool("get_course_reviews", "Get the reviews of a course by id (Parameter)", {
    id: z.string().describe("The ID of the course to retrieve"),
}, async (args) => {
    await connect();
    const reviews = await Review.find({ course: args.id });
    await close();
    return {
        reviews: reviews,
    };
});

server.tool("get_popular_courses", "Get the popular courses by rating and enrollment (Parameter)", {
    topN: z.number().optional().default(10).describe("The number of popular courses to retrieve"),
    weightRating: z.number().optional().default(0.5).describe("The weight of the rating"),
    weightEnrollment: z.number().optional().default(0.5).describe("The weight of the enrollment"),
}, async (args) => {
    await connect();
    const courses = await popularCourses(args.topN, args.weightRating, args.weightEnrollment);
    await close();
    return {
        courses: courses,
    };
});

server.tool("search_anything_in_web", "Search anything in the web (Parameter)", {
    query: z.string().describe("The query to search for"),
}, async (args) => {
    const braveSearch = {
        baseUrl: "https://api.search.brave.com/res/v1/web/search",
        apiKey: process.env.BRAVE_API_KEY
    }
    const response = await axios.get(`${braveSearch.baseUrl}`, {
        headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": braveSearch.apiKey,
        },
        params: {
            q: args.query,
            max_results: 10,
            safe_search: "moderate",
            format: "json",
            output: "json",
            count: 10,
            
        }
    });
    return response.data;
})

const connection = async () => {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("Server connected to MCP");
}

connection();
