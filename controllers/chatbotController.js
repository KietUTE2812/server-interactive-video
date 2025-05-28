import Course from '../models/Course.js';
import Review from '../models/Review.js';
import User from '../models/User.js';
import Agent from '../utils/OpenAIAgent.js';
import ChatHistory from '../models/ChatHistory.js';
import asyncHandler from '../middlewares/asyncHandler.js';

const agent = new Agent();

// Hàm xác định intent đơn giản (rule-based)
function detectIntent(message) {
  const msg = message.toLowerCase();
  if (msg.includes('review') || msg.includes('đánh giá')) return 'review';
  if (msg.includes('học viên') || msg.includes('bao nhiêu người') || msg.includes('enroll')) return 'enrollment';
  if (msg.includes('khóa học phù hợp') || msg.includes('gợi ý') || msg.includes('recommend')) return 'recommend';
  if (msg.includes('khóa học') || msg.includes('course')) return 'course_info';
  return 'unknown';
}

// Xử lý chatbot
export const handleChat = asyncHandler(async (req, res) => {
  const { message } = req.body;
  const userId = req.user.id;
  if (!message) return res.status(400).json({ success: false, message: 'Missing message' });

  // 1. Lấy lịch sử chat gần nhất (30 lượt)
  let chatHistory = [];
  if (userId) {
    const historyDoc = await ChatHistory.findOne({ userId }).select('messages').lean();
    if (historyDoc && historyDoc.messages) {
      chatHistory = historyDoc.messages.slice(-30);
    }
  }

  // 2. Ghép lịch sử chat vào prompt cho AI
  const historyPrompt = chatHistory.map(msg =>
    `${msg.role === 'user' ? 'Người dùng' : 'Bot'}: ${msg.content}`
  ).join('\n');

  // 3. Phân tích intent đơn giản (có thể dùng AI hoặc rule-based)
  let intent = 'general';
  const msg = message.toLowerCase();
  if (msg.includes('review') || msg.includes('đánh giá')) intent = 'review';
  else if (msg.includes('khóa học') || msg.includes('course')) intent = 'course';
  else if (msg.includes('học viên') || msg.includes('enroll')) intent = 'enrollment';

  // 4. Lấy dữ liệu thật từ DB
  let data = {};
  try {
    if (intent === 'review') {
      data.reviews = await Review.find().sort({ createdAt: -1 }).limit(5).populate('course', 'title').populate('user', 'profile');
      data.courses = await Course.find({ status: 'published', isApproved: true }).sort({ averageRating: -1 }).limit(5).select('title description averageRating courseId photo');
    } else if (intent === 'course') {
      data.courses = await Course.find({ status: 'published', isApproved: true }).sort({ averageRating: -1 }).limit(10).select('title description averageRating courseId photo');
    } else if (intent === 'enrollment') {
      data.courses = await Course.find({ status: 'published', isApproved: true }).sort({ enrollmentCount: -1 }).limit(5).select('title enrollmentCount courseId photo');
    }

    // 5. Gửi prompt + dữ liệu thật + lịch sử chat lên AI
    const prompt = `
Bạn là trợ lý hỗ trợ khách hàng cho nền tảng học trực tuyến.
Dưới đây là lịch sử hội thoại gần nhất:
${historyPrompt}

Dưới đây là dữ liệu thực tế của hệ thống (JSON):
${JSON.stringify(data)}

Câu hỏi mới của người dùng: "${message}"

Hãy trả lời người dùng bằng ngôn ngữ tự nhiên, thân thiện, dễ hiểu. Nếu có danh sách khóa học phù hợp, hãy trả về một object JSON với hai trường:
- answer: phần trả lời tự nhiên cho người dùng (dạng text, có thể liệt kê, giải thích, v.v.)
- courses: mảng các courseId hoặc title của các khóa học liên quan (nếu có)
Nếu không có khóa học phù hợp, chỉ cần trả về trường answer.
Ví dụ:
{
  "answer": "Dưới đây là các khóa học phù hợp với bạn...",
  "courses": ["java_fundametal", "py_beginner"]
}
Nếu chỉ trả lời thông tin, không có khóa học, chỉ trả về:
{
  "answer": "Hiện tại chúng tôi chưa có khóa học phù hợp..."
}
`;

    const aiResponse = await agent.generate(prompt, 1024, 0.7, false, "JSON");

    // 6. Trích xuất danh sách khóa học từ phản hồi AI
    let courseIds = [];
    let courseTitles = [];
    let answerText = aiResponse;
    let aiData = null;
    try {
      aiData = JSON.parse(aiResponse);
      // Lấy phần trả lời tự nhiên
      if (typeof aiData.answer === 'string') {
        answerText = aiData.answer;
      }
      // Ưu tiên lấy courseId nếu có, nếu không lấy title
      if (Array.isArray(aiData.courses)) {
        // Nếu phần tử là object có courseId
        if (typeof aiData.courses[0] === 'object' && aiData.courses[0] !== null) {
          courseIds = aiData.courses.map(c => c.courseId).filter(Boolean);
          courseTitles = aiData.courses.map(c => c.title).filter(Boolean);
        } else {
          // Nếu phần tử là string (courseId hoặc title)
          courseIds = aiData.courses.filter(id => typeof id === 'string');
        }
      }
    } catch (e) {
      // Nếu không phải JSON, có thể dùng regex hoặc bỏ qua
    }

    // 7. Truy vấn lại DB lấy đủ thông tin các khóa học
    let courses = [];
    if (courseIds.length > 0) {
      courses = await Course.find({ courseId: { $in: courseIds } });
    } else if (courseTitles.length > 0) {
      courses = await Course.find({ title: { $in: courseTitles } });
    }

    // 8. Lưu lịch sử chat
    if (userId) {
      await ChatHistory.findOneAndUpdate(
        { userId },
        { $push: { messages: [
          { role: 'user', content: message },
          { role: 'bot', content: aiResponse }
        ] } },
        { upsert: true }
      );
    }

    // 9. Trả về cho frontend
    return res.json({
      success: true,
      ai: true,
      answer: answerText,
      courses: courses // Đủ thông tin để frontend hiển thị đẹp
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Lỗi AI hoặc DB', error: err.message });
  }
});

// Lấy toàn bộ lịch sử chat của user (phân trang)
export const getChatHistory = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const { page = 1, limit = 20 } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });

  const history = await ChatHistory.findOne({ userId })
    .select('messages userId createdAt updatedAt')
    .lean()
  if (!history) return res.json({ success: true, data: [], total: 0 });

  const total = history.messages.length;
  const end = total;
  const start = end - parseInt(limit);
  const messages = history.messages.slice(start, end);

  return res.json({
    success: true,
    data: messages,
    total,
    page: parseInt(page),
    limit: parseInt(limit)
  });
});

// Xóa toàn bộ lịch sử chat của user
export const deleteChatHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  if (!userId) return res.status(400).json({ success: false, message: 'Missing userId' });
  await ChatHistory.deleteOne({ userId });
  return res.json({ success: true, message: 'Đã xóa lịch sử chat.' });
});

// (Tùy chọn) Lấy chi tiết một phiên chat (nếu lưu nhiều phiên)
// export const getChatSession = asyncHandler(async (req, res) => {
//   const { sessionId } = req.params;
//   const session = await ChatHistory.findById(sessionId);
//   if (!session) return res.status(404).json({ success: false, message: 'Không tìm thấy phiên chat' });
//   return res.json({ success: true, data: session });
// });
