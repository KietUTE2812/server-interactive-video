import pkg from 'natural';
const { TfIdf, WordTokenizer } = pkg;
import Course from '../models/Course.js';
import User from '../models/User.js';
import ErrorResponse from '../utils/ErrorResponse.js';
import asyncHandler from '../middlewares/asyncHandler.js';
import Progress from '../models/Progress.js';

/**
 * Tính toán độ tương đồng Cosine giữa 2 vector
 * @param {Array<number>} vecA - Vector thứ nhất
 * @param {Array<number>} vecB - Vector thứ hai
 * @returns {number} - Giá trị cosine similarity (0-1)
 */
function cosineSimilarity(vecA, vecB) {
  // Kiểm tra vector rỗng
  if (!vecA.length || !vecB.length) {
    return 0;
  }

  // Đảm bảo 2 vector có cùng kích thước
  const maxLen = Math.max(vecA.length, vecB.length);
  const normalizedA = [...vecA, ...Array(maxLen - vecA.length).fill(0)];
  const normalizedB = [...vecB, ...Array(maxLen - vecB.length).fill(0)];

  // Tính tích vô hướng
  const dotProduct = normalizedA.reduce((acc, val, i) => acc + val * normalizedB[i], 0);
  
  // Tính độ lớn của vector
  const magnitudeA = Math.sqrt(normalizedA.reduce((acc, val) => acc + val * val, 0));
  const magnitudeB = Math.sqrt(normalizedB.reduce((acc, val) => acc + val * val, 0));
  
  // Tránh lỗi chia cho 0
  return dotProduct / (magnitudeA * magnitudeB || 1);
}

/**
 * Tiền xử lý văn bản trước khi tính TF-IDF
 * @param {string} text - Văn bản cần tiền xử lý
 * @returns {string} - Văn bản đã được xử lý
 */
function preprocessText(text) {
  if (!text) return '';
  
  // Chuyển về chữ thường
  let processed = text.toLowerCase();
  
  // Loại bỏ các ký tự đặc biệt
  processed = processed.replace(/[^\w\s]/g, ' ');
  
  // Loại bỏ khoảng trắng thừa
  processed = processed.replace(/\s+/g, ' ').trim();
  
  return processed;
}

/**
 * Tạo vector TF-IDF từ document và model
 * @param {object} tfidf - TF-IDF model
 * @param {number} docIndex - Chỉ số của document
 * @returns {Array<number>} - Vector TF-IDF
 */
function createTfidfVector(tfidf, docIndex) {
  const vector = [];
  tfidf.listTerms(docIndex).forEach(term => vector.push(term.tfidf));
  return vector;
}

/**
 * Tính tương đồng giữa hai danh sách tags
 * @param {Array<string>} tags1 - Danh sách tags thứ nhất
 * @param {Array<string>} tags2 - Danh sách tags thứ hai
 * @returns {number} - Điểm tương đồng (0-1)
 */
function calculateTagSimilarity(tags1, tags2) {
  if (!tags1 || !tags2 || tags1.length === 0 || tags2.length === 0) {
    return 0;
  }

  // Tạo tập hợp các tags duy nhất
  const uniqueTags1 = new Set(tags1.map(t => t.toLowerCase()));
  const uniqueTags2 = new Set(tags2.map(t => t.toLowerCase()));

  // Đếm số lượng tags trùng nhau
  let intersection = 0;
  for (const tag of uniqueTags1) {
    if (uniqueTags2.has(tag)) {
      intersection++;
    }
  }

  // Tính điểm tương đồng bằng Jaccard similarity
  const union = uniqueTags1.size + uniqueTags2.size - intersection;
  return intersection / (union || 1);
}

/**
 * Tính điểm phù hợp về level
 * @param {string} userLevel - Level ưa thích của người dùng
 * @param {string} courseLevel - Level của khóa học
 * @returns {number} - Điểm phù hợp (0-1)
 */
function calculateLevelMatch(userLevel, courseLevel) {
  // Nếu không có thông tin level
  if (!userLevel || !courseLevel) {
    return 0.5; // Trả về giá trị trung bình
  }

  // Chuyển đổi level sang số để so sánh
  const levelValues = {
    'beginner': 1,
    'intermediate': 2,
    'advanced': 3
  };

  const userLevelValue = levelValues[userLevel] || 1;
  const courseLevelValue = levelValues[courseLevel] || 1;

  // Tính khoảng cách giữa các level
  const distance = Math.abs(userLevelValue - courseLevelValue);

  // Chuyển đổi khoảng cách thành điểm phù hợp
  switch (distance) {
    case 0: return 1.0;    // Khớp hoàn toàn
    case 1: return 0.6;    // Chênh lệch 1 cấp độ
    case 2: return 0.3;    // Chênh lệch 2 cấp độ
    default: return 0.1;   // Mặc định
  }
}

/**
 * @desc    Gợi ý khóa học dựa trên nội dung và tags (Content-based)
 * @route   GET /api/v1/recommend
 * @access  Private
 */
export const recommendContentBased = asyncHandler(async (req, res, next) => {
  // 1. Lấy tham số và validate
  const userId = req.user._id.toString();
  const topN = parseInt(req.query.topN) || 5; // Số lượng khóa học gợi ý
  const contentWeight = parseFloat(req.query.contentWeight) || 0.6; // Trọng số cho nội dung
  const tagsWeight = parseFloat(req.query.tagsWeight) || 0.3; // Trọng số cho tags
  const levelWeight = parseFloat(req.query.levelWeight) || 0.1; // Trọng số cho level
  
  if (isNaN(topN) || topN <= 0) {
    return res.status(400).json({
      success: false,
      message: "topN phải là một số dương"
    });
  }
  
  try {
    // 2. Tìm thông tin người dùng
    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorResponse('Không tìm thấy người dùng', 404));
    }
    
    if (!user.enrolled_courses || user.enrolled_courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Người dùng chưa đăng ký khóa học nào",
        data: []
      });
    }
    
    // 3. Lấy danh sách khóa học đã học và chưa học
    const watched = await Course.find({ 
      _id: { $in: user.enrolled_courses },
      status: 'published' // Chỉ lấy các khóa học đã công khai
    });
    
    if (watched.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Chưa có dữ liệu khóa học đã học để gợi ý",
        data: []
      });
    }
    
    const watchedIds = watched.map(c => c._id);
    const unwatched = await Course.find({ 
      _id: { $nin: watchedIds },
      status: 'published' // Chỉ gợi ý các khóa học đã công khai
    });
    
    if (unwatched.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có khóa học mới để gợi ý",
        data: []
      });
    }
    
    // 4. Phân tích dữ liệu từ các khóa học đã học
    
    // 4.1 Phân tích nội dung với TF-IDF
    const tfidf = new TfIdf();
    
    // Thêm content từ cả tiêu đề và mô tả để tăng độ chính xác
    const allCourses = [...watched, ...unwatched];
    allCourses.forEach(course => {
      // Kết hợp tiêu đề và mô tả với trọng số cho tiêu đề cao hơn
      const content = `${course.title} ${course.title} ${preprocessText(course.description)}`;
      tfidf.addDocument(content);
    });
    
    // 4.2 Phân tích tags từ các khóa đã học
    const allUserTags = new Set();
    const tagCounts = {};
    
    watched.forEach(course => {
      if (course.tags && course.tags.length > 0) {
        course.tags.forEach(tag => {
          allUserTags.add(tag.toLowerCase());
          tagCounts[tag.toLowerCase()] = (tagCounts[tag.toLowerCase()] || 0) + 1;
        });
      }
    });
    
    // 4.3 Phân tích level ưa thích từ khóa học đã học
    const levelCounts = {};
    watched.forEach(course => {
      if (course.level) {
        levelCounts[course.level] = (levelCounts[course.level] || 0) + 1;
      }
    });
    
    // Lấy level phổ biến nhất
    const preferredLevel = Object.entries(levelCounts)
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0])[0] || 'beginner';
    
    // 5. Tính trung bình TF-IDF vector của các khóa đã học
    const watchedVectors = watched.map((_, i) => createTfidfVector(tfidf, i));
    
    // Nếu không có vector nào, trả về mảng rỗng
    if (watchedVectors.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không đủ dữ liệu để tính toán gợi ý",
        data: []
      });
    }
    
    // Tính vector trung bình từ tất cả khóa học đã xem
    const maxLen = Math.max(...watchedVectors.map(v => v.length));
    const avgVector = Array(maxLen).fill(0);
    
    for (let i = 0; i < maxLen; i++) {
      let sum = 0;
      let count = 0;
      
      for (const vec of watchedVectors) {
        if (i < vec.length) {
          sum += vec[i];
          count++;
        }
      }
      
      avgVector[i] = count ? sum / count : 0;
    }
    
    // 6. Tính điểm tương đồng tổng hợp cho các khóa học chưa xem
    const scoredCourses = unwatched.map((course, i) => {
      const idx = watched.length + i; // Vị trí trong mảng tfidf
      
      // 6.1 Tính điểm tương đồng nội dung (content)
      const vec = createTfidfVector(tfidf, idx);
      const contentSimilarity = cosineSimilarity(avgVector, vec);
      
      // 6.2 Tính điểm tương đồng tags
      const userTags = Array.from(allUserTags);
      const tagSimilarity = calculateTagSimilarity(userTags, course.tags || []);
      
      // 6.3 Tính điểm phù hợp level
      const levelMatch = calculateLevelMatch(preferredLevel, course.level);
      
      // 6.4 Tính điểm tổng hợp với các trọng số
      const combinedScore = 
        (contentSimilarity * contentWeight) + 
        (tagSimilarity * tagsWeight) + 
        (levelMatch * levelWeight);
      
      // Chỉ trả về các thông tin cần thiết
      return {
        _id: course._id,
        title: course.title,
        description: course.description,
        instructor: course.instructor,
        price: course.price,
        level: course.level,
        photo: course.photo,
        averageRating: course.averageRating || 0,
        tags: course.tags || [],
        enrollmentCount: course.enrollmentCount || 0,
        contentSimilarity: Math.round(contentSimilarity * 100) / 100,
        tagSimilarity: Math.round(tagSimilarity * 100) / 100,
        levelMatch: Math.round(levelMatch * 100) / 100,
        combinedScore: Math.round(combinedScore * 100) / 100
      };
    });
    
    // 7. Sắp xếp theo điểm tương đồng tổng hợp và lấy top N kết quả
    const recommendations = scoredCourses
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topN);
    
    // 8. Trả về kết quả
    res.status(200).json({
      success: true,
      count: recommendations.length,
      userPreferences: {
        preferredTags: Array.from(allUserTags).slice(0, 5),
        preferredLevel,
        weights: {
          content: contentWeight,
          tags: tagsWeight,
          level: levelWeight
        }
      },
      data: recommendations
    });
    
  } catch (error) {
    console.error('Lỗi trong quá trình gợi ý:', error);
    return next(new ErrorResponse(`Lỗi hệ thống gợi ý: ${error.message}`, 500));
  }
});

/**
 * Tính toán ma trận đánh giá người dùng-khóa học từ User.enrolled_courses
 * @param {Array} users - Danh sách người dùng
 * @param {Array} courses - Danh sách khóa học
 * @returns {Object} - Ma trận đánh giá và ánh xạ ID
 */
async function buildRatingMatrix(users, courses) {
  // Tạo ánh xạ từ ID sang index
  const userIdToIndex = {};
  const courseIdToIndex = {};
  const userIndexToId = {};
  const courseIndexToId = {};
  
  users.forEach((user, index) => {
    userIdToIndex[user._id.toString()] = index;
    userIndexToId[index] = user._id.toString();
  });
  
  courses.forEach((course, index) => {
    courseIdToIndex[course._id.toString()] = index;
    courseIndexToId[index] = course._id.toString();
  });
  
  // Khởi tạo ma trận đánh giá với giá trị mặc định
  const ratings = Array(users.length).fill().map(() => Array(courses.length).fill(0));
  
  // Điền đánh giá vào ma trận dựa trên enrolled_courses của mỗi user
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Đảm bảo enrolled_courses tồn tại
    const enrolledCourses = user.enrolled_courses || [];
    
    // Đánh dấu các khóa học mà người dùng đã đăng ký
    for (const courseId of enrolledCourses) {
      const courseIdx = courseIdToIndex[courseId.toString()];
      
      if (courseIdx !== undefined) {
        // Tìm progress để đánh giá mức độ hoàn thành
        const progress = await Progress.findOne({
          userId: user._id,
          courseId: courseId
        });
        
        if (progress) {
          // Chuyển đổi phần trăm hoàn thành thành điểm đánh giá (1-5)
          let rating = 3; // Mặc định
          
          if (progress.completionPercentage > 80) {
            rating = 5; // Hoàn thành >80%, đánh giá tốt
          } else if (progress.completionPercentage > 60) {
            rating = 4;
          } else if (progress.completionPercentage > 40) {
            rating = 3;
          } else if (progress.completionPercentage > 20) {
            rating = 2;
          } else {
            rating = 1; // Hoàn thành <20%, đánh giá thấp
          }
          
          ratings[i][courseIdx] = rating;
        } else {
          // Nếu không có tiến độ, gán giá trị mặc định là 3
          ratings[i][courseIdx] = 3;
        }
      }
    }
  }
  
  return {
    ratings,
    userIdToIndex,
    courseIdToIndex,
    userIndexToId,
    courseIndexToId
  };
}

/**
 * Tính toán độ tương đồng giữa các người dùng
 * @param {Array<Array<number>>} ratings - Ma trận đánh giá người dùng-khóa học
 * @returns {Array<Array<number>>} - Ma trận độ tương đồng giữa các người dùng
 */
function calculateUserSimilarity(ratings) {
  const numUsers = ratings.length;
  const similarity = Array(numUsers).fill().map(() => Array(numUsers).fill(0));
  
  for (let i = 0; i < numUsers; i++) {
    // Độ tương đồng với chính mình = 1
    similarity[i][i] = 1;
    
    for (let j = i + 1; j < numUsers; j++) {
      // Chỉ tính cho các cặp người dùng khác nhau
      const vecA = ratings[i];
      const vecB = ratings[j];
      
      // Tính cosine similarity
      const sim = cosineSimilarity(vecA, vecB);
      
      // Ma trận đối xứng
      similarity[i][j] = sim;
      similarity[j][i] = sim;
    }
  }
  
  return similarity;
}

/**
 * Dự đoán đánh giá của người dùng cho một khóa học
 * @param {number} userIdx - Chỉ số người dùng
 * @param {number} courseIdx - Chỉ số khóa học
 * @param {Array<Array<number>>} ratings - Ma trận đánh giá
 * @param {Array<Array<number>>} similarity - Ma trận độ tương đồng
 * @param {number} k - Số người dùng lân cận sử dụng trong dự đoán
 * @returns {number} - Đánh giá dự đoán
 */
function predictRating(userIdx, courseIdx, ratings, similarity, k) {
  const numUsers = ratings.length;
  
  // Nếu người dùng đã đánh giá khóa học
  if (ratings[userIdx][courseIdx] > 0) {
    return ratings[userIdx][courseIdx];
  }
  
  // Lấy k người dùng tương đồng nhất đã đánh giá khóa học này
  const neighbors = [];
  
  for (let i = 0; i < numUsers; i++) {
    if (i !== userIdx && ratings[i][courseIdx] > 0) {
      neighbors.push({
        userIdx: i,
        similarity: similarity[userIdx][i],
        rating: ratings[i][courseIdx]
      });
    }
  }
  
  // Sắp xếp theo độ tương đồng giảm dần
  neighbors.sort((a, b) => b.similarity - a.similarity);
  
  // Lấy k láng giềng gần nhất
  const kNearest = neighbors.slice(0, k);
  
  // Nếu không có láng giềng phù hợp
  if (kNearest.length === 0) {
    return 0;
  }
  
  // Tính đánh giá dự đoán dựa trên k láng giềng gần nhất
  let numerator = 0;
  let denominator = 0;
  
  for (const neighbor of kNearest) {
    numerator += neighbor.similarity * neighbor.rating;
    denominator += Math.abs(neighbor.similarity);
  }
  
  // Tránh chia cho 0
  if (denominator === 0) {
    return 0;
  }
  
  return numerator / denominator;
}

/**
 * @desc    Gợi ý khóa học dựa trên người dùng tương tự (Collaborative Filtering)
 * @route   GET /api/v1/recommend/collaborative
 * @access  Private
 */
export const recommendCollaborative = asyncHandler(async (req, res, next) => {
  // 1. Lấy tham số và validate
  const userId = req.user._id.toString();
  const topN = parseInt(req.query.topN) || 5; // Số lượng khóa học gợi ý
  const k = parseInt(req.query.k) || 5; // Số người dùng lân cận
  
  if (isNaN(topN) || topN <= 0) {
    return res.status(400).json({
      success: false,
      message: "topN phải là một số dương"
    });
  }
  
  try {
    // 2. Tìm thông tin người dùng
    const user = await User.findById(userId).populate('enrolled_courses');
    if (!user) {
      return next(new ErrorResponse('Không tìm thấy người dùng', 404));
    }
    
    // 3. Lấy danh sách tất cả người dùng (giới hạn cho hiệu năng)
    const allUsers = await User.find({
      _id: { $ne: userId }, // Loại bỏ người dùng hiện tại
      role: 'student', // Chỉ xét học viên
      enrolled_courses: { $exists: true, $not: { $size: 0 } } // Chỉ lấy những user đã đăng ký ít nhất 1 khóa học
    }).populate('enrolled_courses').limit(1000); // Giới hạn số lượng để tránh quá tải
    
    // Nếu không có đủ user để so sánh
    if (allUsers.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không đủ dữ liệu người dùng để đề xuất",
        data: []
      });
    }
    
    // Thêm người dùng hiện tại vào danh sách
    allUsers.unshift(user);
    
    // 4. Lấy danh sách tất cả khóa học đã công khai
    const allCourses = await Course.find({ status: 'published' });
    
    if (allCourses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có khóa học nào để gợi ý",
        data: []
      });
    }
    
    // 5. Xây dựng ma trận đánh giá từ enrolled_courses
    const {
      ratings,
      userIdToIndex,
      courseIdToIndex,
      userIndexToId,
      courseIndexToId
    } = await buildRatingMatrix(allUsers, allCourses);
    
    // 6. Tính toán độ tương đồng giữa các người dùng
    const similarities = calculateUserSimilarity(ratings);
    
    // 7. Lấy chỉ số của người dùng hiện tại
    const currentUserIdx = userIdToIndex[userId];
    
    // 8. Tìm các khóa học chưa xem của người dùng hiện tại
    const watchedCourseIds = user.enrolled_courses.map(course => course._id.toString());
    const unwatchedCourses = allCourses.filter(course => 
      !watchedCourseIds.includes(course._id.toString())
    );
    
    if (unwatchedCourses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có khóa học mới để gợi ý",
        data: []
      });
    }
    
    // 9. Dự đoán đánh giá cho các khóa học chưa xem
    const predictions = [];
    
    for (const course of unwatchedCourses) {
      const courseIdx = courseIdToIndex[course._id.toString()];
      if (courseIdx !== undefined) {
        const predictedRating = predictRating(
          currentUserIdx,
          courseIdx,
          ratings,
          similarities,
          k
        );
        
        // Chỉ đề xuất các khóa học có dự đoán đánh giá tốt
        if (predictedRating >= 3.0) {
          predictions.push({
            _id: course._id,
            title: course.title,
            description: course.description,
            instructor: course.instructor,
            price: course.price,
            level: course.level,
            photo: course.photo,
            averageRating: course.averageRating || 0,
            tags: course.tags || [],
            enrollmentCount: course.enrollmentCount || 0,
            predictedRating: Math.round(predictedRating * 10) / 10
          });
        }
      }
    }
    
    // 10. Sắp xếp theo đánh giá dự đoán giảm dần và lấy top N
    const recommendations = predictions
      .sort((a, b) => b.predictedRating - a.predictedRating)
      .slice(0, topN);
    
    // 11. Trả về kết quả
    res.status(200).json({
      success: true,
      count: recommendations.length,
      similarUsers: allUsers.length - 1,
      kNeighbors: k,
      data: recommendations
    });
    
  } catch (error) {
    console.error('Lỗi trong quá trình gợi ý collaborative:', error);
    return next(new ErrorResponse(`Lỗi hệ thống gợi ý collaborative: ${error.message}`, 500));
  }
});

/**
 * @desc    Gợi ý khóa học kết hợp cả hai phương pháp
 * @route   GET /api/v1/recommend/hybrid
 * @access  Private
 */
export const recommendHybrid = asyncHandler(async (req, res, next) => {
  // 1. Lấy tham số và validate
  const userId = req.user._id.toString();
  const topN = parseInt(req.query.topN) || 10; // Số lượng khóa học gợi ý
  const contentWeight = parseFloat(req.query.contentWeight) || 0.6; // Trọng số cho content-based
  const collaborativeWeight = parseFloat(req.query.collaborativeWeight) || 0.4; // Trọng số cho collaborative
  
  if (isNaN(topN) || topN <= 0) {
    return res.status(400).json({
      success: false,
      message: "topN phải là một số dương"
    });
  }
  
  try {
    // 2. Kiểm tra người dùng tồn tại và đã đăng ký khóa học nào chưa
    const user = await User.findById(userId).populate('enrolled_courses');
    if (!user) {
      return next(new ErrorResponse('Không tìm thấy người dùng', 404));
    }
    
    if (!user.enrolled_courses || user.enrolled_courses.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Người dùng chưa đăng ký khóa học nào để gợi ý",
        data: []
      });
    }
    
    // 3. Gọi hàm content-based và collaborative để lấy gợi ý
    const contentReq = { 
      user: user, 
      query: { 
        topN: topN * 2,
        contentWeight: 0.6,
        tagsWeight: 0.3,
        levelWeight: 0.1
      } 
    };
    
    const collabReq = { 
      user: user, 
      query: { 
        topN: topN * 2, 
        k: 5 
      } 
    };
    
    // 4. Tạo response giả lập
    const contentRes = {
      status: function() { return this; },
      json: function(data) { this.data = data; return this; }
    };
    
    const collabRes = {
      status: function() { return this; },
      json: function(data) { this.data = data; return this; }
    };
    
    // 5. Gọi các hàm gợi ý - đảm bảo chỉ gắn req.user và không ảnh hưởng đến biến gốc
    const originalUser = req.user;
    
    // Thực hiện gợi ý content-based
    req.user = contentReq.user;
    req.query = contentReq.query;
    await recommendContentBased(req, contentRes, next);
    
    // Thực hiện gợi ý collaborative
    req.user = collabReq.user;
    req.query = collabReq.query;
    await recommendCollaborative(req, collabRes, next);
    
    // Khôi phục req.user và req.query
    req.user = originalUser;
    req.query = { topN, contentWeight, collaborativeWeight };
    
    // 6. Kiểm tra kết quả từ cả hai phương pháp
    const contentBasedRecs = contentRes.data?.data || [];
    const collaborativeRecs = collabRes.data?.data || [];
    
    // 7. Nếu một trong hai phương pháp không trả về kết quả, chỉ sử dụng phương pháp còn lại
    if (contentBasedRecs.length === 0 && collaborativeRecs.length === 0) {
      return res.status(200).json({
        success: true,
        message: "Không có đề xuất nào từ cả hai phương pháp",
        data: []
      });
    }
    
    if (contentBasedRecs.length === 0) {
      return res.status(200).json({
        success: true,
        count: collaborativeRecs.length,
        data: collaborativeRecs.slice(0, topN),
        method: 'collaborative-only'
      });
    }
    
    if (collaborativeRecs.length === 0) {
      return res.status(200).json({
        success: true,
        count: contentBasedRecs.length,
        data: contentBasedRecs.slice(0, topN),
        method: 'content-based-only'
      });
    }
    
    // 8. Kết hợp các đề xuất từ cả hai phương pháp
    const courseMap = new Map();
    
    // 9. Thêm đề xuất từ content-based với trọng số tương ứng
    contentBasedRecs.forEach((rec, index) => {
      // Chuẩn hóa điểm số (vị trí trong danh sách)
      const normalizedPosition = index / contentBasedRecs.length; // 0 là tốt nhất, 1 là kém nhất
      const score = contentWeight * (1 - normalizedPosition);
      
      courseMap.set(rec._id.toString(), {
        ...rec,
        hybridScore: score,
        sources: ['content-based'],
        normalizedContentScore: 1 - normalizedPosition
      });
    });
    
    // 10. Kết hợp đề xuất từ collaborative
    collaborativeRecs.forEach((rec, index) => {
      // Chuẩn hóa điểm số (vị trí trong danh sách)
      const normalizedPosition = index / collaborativeRecs.length;
      const score = collaborativeWeight * (1 - normalizedPosition);
      
      // Nếu khóa học đã có trong map, cộng thêm điểm
      const courseId = rec._id.toString();
      if (courseMap.has(courseId)) {
        const existingRec = courseMap.get(courseId);
        existingRec.hybridScore += score;
        existingRec.sources.push('collaborative');
        existingRec.predictedRating = rec.predictedRating;
        existingRec.normalizedCollabScore = 1 - normalizedPosition;
        courseMap.set(courseId, existingRec);
      } else {
        // Nếu chưa có, thêm mới vào map
        courseMap.set(courseId, {
          ...rec,
          hybridScore: score,
          sources: ['collaborative'],
          normalizedCollabScore: 1 - normalizedPosition
        });
      }
    });
    
    // 11. Chuyển đổi Map thành mảng, sắp xếp theo hybridScore và lấy top N
    const hybridRecommendations = Array.from(courseMap.values())
      .sort((a, b) => b.hybridScore - a.hybridScore)
      .slice(0, topN)
      .map(rec => {
        // Làm sạch dữ liệu trước khi trả về
        const result = {
          _id: rec._id,
          title: rec.title,
          description: rec.description,
          instructor: rec.instructor,
          price: rec.price,
          level: rec.level,
          photo: rec.photo,
          averageRating: rec.averageRating || 0,
          tags: rec.tags || [],
          enrollmentCount: rec.enrollmentCount || 0,
          hybridScore: Math.round(rec.hybridScore * 100) / 100,
          sources: rec.sources
        };
        
        // Thêm các điểm số cụ thể nếu có
        if (rec.contentSimilarity) {
          result.contentSimilarity = rec.contentSimilarity;
        }
        if (rec.tagSimilarity) {
          result.tagSimilarity = rec.tagSimilarity;
        }
        if (rec.levelMatch) {
          result.levelMatch = rec.levelMatch;
        }
        if (rec.predictedRating) {
          result.predictedRating = rec.predictedRating;
        }
        
        return result;
      });
    
    // 12. Trả về kết quả
    res.status(200).json({
      success: true,
      count: hybridRecommendations.length,
      data: hybridRecommendations,
      method: 'hybrid',
      weights: {
        content: contentWeight,
        collaborative: collaborativeWeight
      }
    });
    
  } catch (error) {
    console.error('Lỗi trong quá trình gợi ý hybrid:', error);
    return next(new ErrorResponse(`Lỗi hệ thống gợi ý hybrid: ${error.message}`, 500));
  }
});

/**
 * @desc    Gợi ý khóa học phổ biến nhất (Popular Courses)
 * @route   GET /api/v1/recommend/popular
 * @access  Public
 */
export const recommendPopular = asyncHandler(async (req, res, next) => {
  // 1. Lấy tham số và validate
  const topN = parseInt(req.query.topN) || 10; // Số lượng khóa học gợi ý
  const weightRating = parseFloat(req.query.weightRating) || 0.5; // Trọng số cho đánh giá
  const weightEnrollment = parseFloat(req.query.weightEnrollment) || 0.5; // Trọng số cho số lượng đăng ký
  
  if (isNaN(topN) || topN <= 0) {
    return res.status(400).json({
      success: false,
      message: "topN phải là một số dương"
    });
  }

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
      return res.status(200).json({
        success: true,
        message: "Không có khóa học nào",
        data: []
      });
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
    
    // 5. Trả về kết quả
    res.status(200).json({
      success: true,
      count: popularCourses.length,
      weights: {
        rating: weightRating,
        enrollment: weightEnrollment
      },
      data: popularCourses
    });
    
  } catch (error) {
    console.error('Lỗi trong quá trình gợi ý khóa học phổ biến:', error);
    return next(new ErrorResponse(`Lỗi hệ thống gợi ý phổ biến: ${error.message}`, 500));
  }
});

