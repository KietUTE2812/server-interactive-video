import asyncHandler from "express-async-handler";
import ErrorResponse from "../utils/ErrorResponse.js";
import Course from "../models/Course.js";
import mongoose from "mongoose";

// Hàm helper để kiểm tra text index đã được tạo chưa
const isTextIndexExists = async (modelName) => {
    try {
        const Model = mongoose.model(modelName);
        const collection = Model.collection;
        const indexes = await collection.indexes();
        return indexes.some(index => index.textIndexVersion);
    } catch (error) {
        console.error(`Error checking text index: ${error}`);
        return false;
    }
};

// @desc    Search courses for authenticated student
// @route   GET /api/v1/search/:searchValue
// @access  Private (student)
export const searchCourseForUser = asyncHandler(async (req, res, next) => {
    try {
        // Lấy và chuẩn hóa các tham số tìm kiếm
        const { searchValue } = req.params;
        const {
            q,
            tags,
            levels,
            minPrice = 0,
            maxPrice,
            rating,
            sort = 'relevance',
            page = 1,
            limit = 12
        } = req.query;

        // Chuyển đổi tham số phân trang sang số nguyên
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);

        // Kiểm tra tham số phân trang hợp lệ
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return next(new ErrorResponse('Invalid pagination parameters', 400));
        }

        // Build search query
        const query = {};

        // Tối ưu tìm kiếm văn bản
        if (q && typeof q === 'string' && q.trim() !== '') {
            const searchTerm = q.trim();
            
            // Ưu tiên sử dụng text index nếu có
            if (await isTextIndexExists('Course')) {
                query.$text = { $search: searchTerm };
            } else {
                // Fallback to regex search with optimization
                const searchRegex = new RegExp(searchTerm.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
                query.$or = [
                    { title: searchRegex }, 
                    { description: searchRegex },
                    { "instructor.profile.fullname": searchRegex } // Đường dẫn đúng đến tên giảng viên
                ];
            }
        }

        // Lọc theo danh mục (tags) - Cải thiện xử lý mảng
        if (tags) {
            const categoryArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
            if (categoryArray.length > 0) {
                query.tags = { $in: categoryArray };
            }
        }

        // Lọc theo cấp độ - Cải thiện xử lý mảng và chuyển về chữ thường
        if (levels) {
            const levelArray = levels.split(',').map(level => level.trim().toLowerCase()).filter(Boolean);
            if (levelArray.length > 0) {
                query.level = { $in: levelArray };
            }
        }

        // Lọc theo khoảng giá - Cải thiện logic xử lý
        if (minPrice !== undefined || maxPrice !== undefined) {
            query.price = {};
            
            if (minPrice !== undefined) {
                query.price.$gte = parseFloat(minPrice);
            }
            
            if (maxPrice !== undefined) {
                query.price.$lte = parseFloat(maxPrice);
            }
        }

        // Lọc theo đánh giá - Thêm xử lý hợp lệ
        if (rating) {
            const ratingValue = parseFloat(rating);
            if (!isNaN(ratingValue) && ratingValue >= 0 && ratingValue <= 5) {
                query.averageRating = { $gte: ratingValue };
            }
        }

        // Tính toán giá trị phân trang
        const skip = (pageNum - 1) * limitNum;

        // Thiết lập tuỳ chọn sắp xếp
        let sortOptions = {};
        switch (sort) {
            case 'price-low':
                sortOptions = { price: 1 };
                break;
            case 'price-high':
                sortOptions = { price: -1 };
                break;
            case 'rating':
                sortOptions = { averageRating: -1 };
                break;
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            case 'relevance':
                // Nếu có text search, sử dụng text score để sắp xếp
                if (query.$text) {
                    sortOptions = { score: { $meta: 'textScore' } };
                } else {
                    sortOptions = { createdAt: -1 };
                }
                break;
            default:
                sortOptions = { createdAt: -1 };
        }        
        
        // Thực hiện truy vấn với projection để tối ưu dữ liệu trả về
        const projection = {
            title: 1,
            description: 1,
            price: 1,
            averageRating: 1,
            level: 1,
            category: 1,
            instructor: 1, // Chỉ lấy _id của instructor
            thumbnail: 1,
            photo: 1, 
            images: 1, 
            createdAt: 1
        };

        // Thêm tùy chọn textScore nếu cần
        if (query.$text) {
            projection.score = { $meta: "textScore" };
        }

        // Thực hiện đếm tổng số kết quả (với lean() để cải thiện hiệu suất)
        const countPromise = Course.countDocuments(query).exec();

        // Thực hiện truy vấn chính với populate để lấy đầy đủ thông tin instructor
        const coursesPromise = Course.find(query, projection)
            .sort(sortOptions)
            .skip(skip)
            .limit(limitNum)
            .populate({
                path: 'instructor',
                select: 'username email role profile.fullname profile.picture profile.bio profile.phone'
            })
            .lean()
            .exec();

        // Chạy các truy vấn song song để cải thiện hiệu suất
        const [total, courses] = await Promise.all([countPromise, coursesPromise]);

        // Tính toán thông tin phân trang
        const totalPages = Math.ceil(total / limitNum);
        const pagination = {
            currentPage: pageNum,
            totalPages,
            totalItems: total,
            itemsPerPage: limitNum
        };

        if (pageNum < totalPages) {
            pagination.nextPage = pageNum + 1;
        }

        if (pageNum > 1) {
            pagination.prevPage = pageNum - 1;
        }

        // Trả về kết quả
        return res.status(200).json({
            success: true,
            count: courses.length,
            pagination,
            totalPages,
            courses
        });
    } catch (error) {
        console.error("Error in search:", error);
        return next(new ErrorResponse(`Search failed: ${error.message}`, 500));
    }
});

export const searchWithLevels = asyncHandler(async (req, res, next) => {
    try {
        const { levels, page = 1, limit = 12, sort = 'newest' } = req.query;
        
        if (!levels) {
            return next(new ErrorResponse('Levels parameter is required', 400));
        }
        
        // Xử lý tham số levels và chuyển về chữ thường
        const levelArray = levels.split(',').map(level => level.trim().toLowerCase()).filter(Boolean);
        if (levelArray.length === 0) {
            return next(new ErrorResponse('Invalid levels parameter', 400));
        }
        
        // Chuyển đổi tham số phân trang sang số
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        
        // Kiểm tra tham số phân trang hợp lệ
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return next(new ErrorResponse('Invalid pagination parameters', 400));
        }
        
        // Xây dựng truy vấn
        const query = { level: { $in: levelArray } };
        
        // Tính toán skip value cho phân trang
        const skip = (pageNum - 1) * limitNum;
        
        // Xác định tùy chọn sắp xếp
        let sortOptions = {};
        switch (sort) {
            case 'price-low':
                sortOptions = { price: 1 };
                break;
            case 'price-high':
                sortOptions = { price: -1 };
                break;
            case 'rating':
                sortOptions = { averageRating: -1 };
                break;
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }
        
        // Xác định projection để lấy cả thông tin giảng viên và hình ảnh khóa học
        const projection = {
            title: 1,
            description: 1,
            price: 1,
            averageRating: 1,
            level: 1,
            category: 1,
            instructor: 1, // Chỉ lấy _id của instructor
            thumbnail: 1,
            photo: 1, 
            images: 1, 
            createdAt: 1
        };
        
        // Thực hiện truy vấn song song với populate
        const [total, courses] = await Promise.all([
            Course.countDocuments(query),
            Course.find(query, projection)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .populate({
                    path: 'instructor',
                    select: 'username email role profile.fullname profile.picture profile.bio profile.phone'
                })
                .lean()
        ]);
        
        // Tính toán thông tin phân trang
        const totalPages = Math.ceil(total / limitNum);
        
        // Response
        res.status(200).json({
            success: true,
            count: courses.length,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: total
            },
            courses
        });
    } catch (error) {
        console.error("Error searching by levels:", error);
        return next(new ErrorResponse(`Search failed: ${error.message}`, 500));
    }
});

export const searchWithTags = asyncHandler(async (req, res, next) => {
    try {
        const { tags, page = 1, limit = 12, sort = 'newest' } = req.query;
        
        if (!tags) {
            return next(new ErrorResponse('Tags parameter is required', 400));
        }
        
        // Xử lý tham số tags
        const tagArray = tags.split(',').map(tag => tag.trim()).filter(Boolean);
        if (tagArray.length === 0) {
            return next(new ErrorResponse('Invalid tags parameter', 400));
        }
        
        // Chuyển đổi tham số phân trang sang số
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        
        // Kiểm tra tham số phân trang hợp lệ
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return next(new ErrorResponse('Invalid pagination parameters', 400));
        }
        
        // Xây dựng truy vấn
        const query = { tags: { $in: tagArray } };
        
        // Tính toán skip value cho phân trang
        const skip = (pageNum - 1) * limitNum;
        
        // Xác định tùy chọn sắp xếp
        let sortOptions = {};
        switch (sort) {
            case 'price-low':
                sortOptions = { price: 1 };
                break;
            case 'price-high':
                sortOptions = { price: -1 };
                break;
            case 'rating':
                sortOptions = { averageRating: -1 };
                break;
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            default:
                sortOptions = { createdAt: -1 };
        }
        
        // Xác định projection để bao gồm thông tin cơ bản
        const projection = {
            title: 1,
            description: 1,
            price: 1,
            averageRating: 1,
            level: 1,
            category: 1,
            instructor: 1, // Chỉ lấy _id của instructor
            thumbnail: 1,
            photo: 1,
            images: 1,
            createdAt: 1
        };
        
        // Thực hiện truy vấn song song với populate
        const [total, courses] = await Promise.all([
            Course.countDocuments(query),
            Course.find(query, projection)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .populate({
                    path: 'instructor',
                    select: 'username email role profile.fullname profile.picture profile.bio profile.phone'
                })
                .lean()
        ]);
        
        // Tính toán thông tin phân trang
        const totalPages = Math.ceil(total / limitNum);
        
        // Response
        res.status(200).json({
            success: true,
            count: courses.length,
            pagination: {
                currentPage: pageNum,
                totalPages,
                totalItems: total
            },
            courses
        });
    } catch (error) {
        console.error("Error searching by tags:", error);
        return next(new ErrorResponse(`Search failed: ${error.message}`, 500));
    }
});

export const getTags = asyncHandler(async (req, res, next) => {
    try {
        // Tìm tất cả các tags duy nhất từ collection courses
        const tags = await Course.distinct('tags');
        
        // Đếm số khóa học cho mỗi tag
        const tagCounts = await Promise.all(
            tags.map(async (tag) => {
                const count = await Course.countDocuments({ tags: tag });
                return { 
                    name: tag, 
                    count 
                };
            })
        );
        
        // Sắp xếp tags theo số lượng khóa học (giảm dần)
        const sortedTags = tagCounts.sort((a, b) => b.count - a.count);
        
        res.status(200).json({
            success: true,
            count: sortedTags.length,
            data: sortedTags
        });
    } catch (error) {
        console.error("Error getting tags:", error);
        return next(new ErrorResponse(`Failed to retrieve tags: ${error.message}`, 500));
    }
});

export const getLevels = asyncHandler(async (req, res, next) => {
    try {
        // Tìm tất cả các levels duy nhất từ collection courses
        const levels = await Course.distinct('level');
        
        // Đếm số khóa học cho mỗi level
        const levelCounts = await Promise.all(
            levels.map(async (level) => {
                const count = await Course.countDocuments({ level });
                return { 
                    name: level, 
                    count 
                };
            })
        );
        
        // Sắp xếp levels theo số lượng khóa học (giảm dần)
        const sortedLevels = levelCounts.sort((a, b) => b.count - a.count);
        
        res.status(200).json({
            success: true,
            count: sortedLevels.length,
            data: sortedLevels
        });
    } catch (error) {
        console.error("Error getting levels:", error);
        return next(new ErrorResponse(`Failed to retrieve levels: ${error.message}`, 500));
    }
});

export const fetchCourses = asyncHandler(async (req, res, next) => {
    try {
        const { 
            page = 1, 
            limit = 10, 
            sort = 'newest',
            fields,
            category,
            tags,
            level,
            minPrice,
            maxPrice,
            search
        } = req.query;
        
        const pageNumber = parseInt(page);
        const limitNumber = parseInt(limit);

        if (isNaN(pageNumber) || isNaN(limitNumber) || pageNumber < 1 || limitNumber < 1) {
            return next(new ErrorResponse("Invalid page or limit parameter", 400));
        }        // Build query filter
        const filter = {};

        // Category and tags filter
        if (category) {
            filter.category = { $in: category.split(',').map(c => c.trim()).filter(Boolean) };
        }
        if (tags) {
            filter.tags = { $in: tags.split(',').map(t => t.trim()).filter(Boolean) };
        }

        // Level filter
        if (level) {
            filter.level = { $in: level.split(',').map(l => l.trim().toLowerCase()).filter(Boolean) };
        }

        // Price filter
        if (minPrice || maxPrice) {
            filter.price = {};
            if (minPrice) filter.price.$gte = parseFloat(minPrice);
            if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
        }
        
        // Rating filter - Sử dụng averageRating
        const rating = req.query.rating;
        if (rating) {
            const ratingValue = parseFloat(rating);
            if (!isNaN(ratingValue) && ratingValue >= 0 && ratingValue <= 5) {
                filter.averageRating = { $gte: ratingValue };
            }
        }
        
        // Review count filter - Sử dụng kích thước của mảng courseReviews
        const minReviews = req.query.minReviews;
        if (minReviews) {
            const reviewCount = parseInt(minReviews);
            if (!isNaN(reviewCount) && reviewCount > 0) {
                // Sử dụng $expr và $size để kiểm tra độ dài mảng
                if (!filter.$expr) filter.$expr = {};
                filter.$expr = { $gte: [{ $size: "$courseReviews" }, reviewCount] };
            }
        }

        // Text search
        let sortOptions = {};
        let projection = {};
        if (search && search.trim() !== '') {
            filter.$text = { $search: search.trim() };
            sortOptions = { score: { $meta: "textScore" } };
            projection = { score: { $meta: "textScore" } };
        }

        // Additional sort
        switch (sort) {
            case 'price-low': sortOptions.price = 1; break;
            case 'price-high': sortOptions.price = -1; break;
            case 'rating': sortOptions.averageRating = -1; break;
            case 'oldest': sortOptions.createdAt = 1; break;
            case 'newest': default: sortOptions.createdAt = -1;
        }        // Field selection
        if (fields) {
            fields.split(',').forEach(f => projection[f.trim()] = 1);
        } else {
            projection = {
                title: 1, description: 1, price: 1, thumbnail: 1, photo: 1, images: 1,
                averageRating: 1, level: 1, category: 1, tags: 1, instructor: 1, createdAt: 1, updatedAt: 1,
                courseReviews: 1 // Thêm courseReviews để đếm số lượt review
            };
        }

        // Pagination
        const skip = (pageNumber - 1) * limitNumber;

        // Query
        const [totalCount, courses] = await Promise.all([
            Course.countDocuments(filter),
            Course.find(filter, projection)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNumber)
                .populate({
                    path: 'instructor',
                    select: 'username email role profile.fullname profile.picture profile.bio profile.phone'
                })
                .lean()
        ]);

        const totalPages = Math.ceil(totalCount / limitNumber);

        res.status(200).json({
            success: true,
            data: {
                courses,
                pagination: {
                    currentPage: pageNumber,
                    totalPages,
                    totalCount,
                    hasPrevPage: pageNumber > 1,
                    hasNextPage: pageNumber < totalPages,
                    prevPage: pageNumber > 1 ? pageNumber - 1 : undefined,
                    nextPage: pageNumber < totalPages ? pageNumber + 1 : undefined
                }
            },
            message: "Courses fetched successfully"
        });
    } catch (error) {
        console.error("Error fetching courses:", error);
        return next(new ErrorResponse(`Failed to fetch courses: ${error.message}`, 500));
    }
});

// @desc    Create text index for search optimization
// @route   POST /api/v1/search/create-index
// @access  Private (Admin only)
export const createSearchIndex = asyncHandler(async (req, res, next) => {
    try {
        const courseCollection = Course.collection;
        
        // Kiểm tra xem text index đã tồn tại chưa
        const indexes = await courseCollection.indexes();
        const textIndexExists = indexes.some(index => index.textIndexVersion);
        
        if (textIndexExists) {
            // Nếu index đã tồn tại, thông báo cho admin
            return res.status(200).json({
                success: true,
                message: "Text index already exists on Course collection"
            });
        }
        
        // Tạo text index mới cho các trường thường được tìm kiếm
        await courseCollection.createIndex(
            {
                title: "text",
                description: "text",
                "instructor.profile.fullname": "text", // Cập nhật đường dẫn tới tên instructor
                category: "text"
            },
            {
                weights: {
                    title: 10,         // Title có trọng số cao nhất
                    description: 5,     // Mô tả có trọng số trung bình
                    "instructor.profile.fullname": 3, // Tên giảng viên
                    category: 2         // Danh mục có trọng số thấp nhất
                },
                name: "course_search_index"
            }
        );
        
        // Thêm index thông thường cho các trường lọc phổ biến
        await Promise.all([
            courseCollection.createIndex({ price: 1 }),
            courseCollection.createIndex({ averageRating: -1 }),
            courseCollection.createIndex({ level: 1 }),
            courseCollection.createIndex({ tags: 1 }),
            courseCollection.createIndex({ createdAt: -1 })
        ]);
        
        res.status(200).json({
            success: true,
            message: "Search indexes created successfully for Course collection"
        });
    } catch (error) {
        console.error("Error creating search index:", error);
        return next(new ErrorResponse(`Failed to create search index: ${error.message}`, 500));
    }
});

// @desc    Advanced search with multiple criteria and recommendations
// @route   POST /api/v1/search/advanced
// @access  Private
export const advancedSearch = asyncHandler(async (req, res, next) => {
    try {
        const {
            query,
            filters = {},
            page = 1,
            limit = 10,
            sort = 'relevance',
            includeRecommendations = false
        } = req.body;

        // Validate pagination parameters
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        
        if (isNaN(pageNum) || isNaN(limitNum) || pageNum < 1 || limitNum < 1) {
            return next(new ErrorResponse('Invalid pagination parameters', 400));
        }

        // Build the complex search query
        const searchQuery = {};
        
        // Text search if query is provided
        if (query && typeof query === 'string' && query.trim()) {
            const trimmedQuery = query.trim();
            
            // Use text index if available
            if (await isTextIndexExists('Course')) {
                searchQuery.$text = { $search: trimmedQuery };
            } else {
                // Fallback to optimized regex
                const searchRegex = new RegExp(trimmedQuery.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'i');
                searchQuery.$or = [
                    { title: searchRegex }, 
                    { description: searchRegex },
                    { "instructor.profile.fullname": searchRegex }, // Cập nhật đường dẫn tới tên instructor
                    { category: searchRegex }
                ];
            }
        }
        
        // Process filters
        if (filters) {
            // Category/Tags filter
            if (filters.categories && Array.isArray(filters.categories) && filters.categories.length > 0) {
                searchQuery.category = { $in: filters.categories };
            }
            
            // Level filter - chuyển tất cả các giá trị về chữ thường
            if (filters.levels && Array.isArray(filters.levels) && filters.levels.length > 0) {
                searchQuery.level = { $in: filters.levels.map(level => level.toLowerCase()) };
            }
            
            // Price range filter
            if (filters.price) {
                searchQuery.price = {};
                if (filters.price.min !== undefined) {
                    searchQuery.price.$gte = parseFloat(filters.price.min);
                }
                if (filters.price.max !== undefined) {
                    searchQuery.price.$lte = parseFloat(filters.price.max);
                }
            }
            
            // Rating filter
            if (filters.averageRating !== undefined) {
                const ratingValue = parseFloat(filters.averageRating);
                if (!isNaN(ratingValue) && ratingValue >= 0 && ratingValue <= 5) {
                    searchQuery.averageRating = { $gte: ratingValue };
                }
            }
            
            // Duration filter (assuming courses have duration field)
            if (filters.duration) {
                searchQuery.duration = {};
                if (filters.duration.min !== undefined) {
                    searchQuery.duration.$gte = parseInt(filters.duration.min, 10);
                }
                if (filters.duration.max !== undefined) {
                    searchQuery.duration.$lte = parseInt(filters.duration.max, 10);
                }
            }
            
            // Date filter (for recently added courses)
            if (filters.date) {
                if (filters.date === 'last_week') {
                    const lastWeek = new Date();
                    lastWeek.setDate(lastWeek.getDate() - 7);
                    searchQuery.createdAt = { $gte: lastWeek };
                } else if (filters.date === 'last_month') {
                    const lastMonth = new Date();
                    lastMonth.setMonth(lastMonth.getMonth() - 1);
                    searchQuery.createdAt = { $gte: lastMonth };
                } else if (filters.date === 'last_year') {
                    const lastYear = new Date();
                    lastYear.setFullYear(lastYear.getFullYear() - 1);
                    searchQuery.createdAt = { $gte: lastYear };
                }
            }
        }

        // Calculate pagination values
        const skip = (pageNum - 1) * limitNum;
        
        // Set sorting options
        let sortOptions = {};
        switch (sort) {
            case 'price_low':
                sortOptions = { price: 1 };
                break;
            case 'price_high':
                sortOptions = { price: -1 };
                break;
            case 'rating':
                sortOptions = { averageRating: -1 };
                break;
            case 'newest':
                sortOptions = { createdAt: -1 };
                break;
            case 'oldest':
                sortOptions = { createdAt: 1 };
                break;
            case 'relevance':
                if (searchQuery.$text) {
                    sortOptions = { score: { $meta: "textScore" } };
                } else {
                    sortOptions = { averageRating: -1, createdAt: -1 };
                }
                break;
            case 'popular':
                sortOptions = { studentsEnrolled: -1 };
                break;
            default:
                sortOptions = { averageRating: -1, createdAt: -1 };
        }
        
        // Set projection for optimization
        const projection = {
            title: 1,
            description: 1,
            price: 1,
            averageRating: 1,
            level: 1,
            category: 1,
            instructor: 1, // Chỉ lấy _id của instructor
            thumbnail: 1,
            photo: 1,
            images: 1,
            createdAt: 1,
            updatedAt: 1,
            duration: 1
        };
        
        if (searchQuery.$text) {
            projection.score = { $meta: "textScore" };
        }
        
        // Execute search query and count in parallel
        const [count, searchResults] = await Promise.all([
            Course.countDocuments(searchQuery),
            Course.find(searchQuery, projection)
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .populate({
                    path: 'instructor',
                    select: 'username email role profile.fullname profile.picture profile.bio profile.phone'
                })
                .lean()
        ]);

        // Generate recommendations if requested
        let recommendations = [];
        if (includeRecommendations && searchResults.length > 0) {
            // Extract categories from search results
            const categories = searchResults.flatMap(course => course.category || []);
            const uniqueCategories = [...new Set(categories)];
            
            // Find similar courses based on categories
            if (uniqueCategories.length > 0) {
                const recommendationQuery = {
                    category: { $in: uniqueCategories },
                    _id: { $nin: searchResults.map(course => course._id) } // Exclude courses already in results
                };
                
                recommendations = await Course.find(recommendationQuery, projection)
                    .sort({ averageRating: -1 })
                    .limit(5)
                    .populate({
                        path: 'instructor',
                        select: 'username email role profile.fullname profile.picture profile.bio profile.phone'
                    })
                    .lean();
            }
        }
        
        // Calculate pagination info
        const totalPages = Math.ceil(count / limitNum);
        const hasNextPage = pageNum < totalPages;
        const hasPrevPage = pageNum > 1;
        
        const pagination = {
            currentPage: pageNum,
            totalPages,
            totalItems: count,
            hasNextPage,
            hasPrevPage
        };
        
        // Add navigation links
        if (hasPrevPage) pagination.prevPage = pageNum - 1;
        if (hasNextPage) pagination.nextPage = pageNum + 1;
        
        // Return results
        res.status(200).json({
            success: true,
            count: searchResults.length,
            totalCount: count,
            pagination,
            data: {
                results: searchResults,
                recommendations
            }
        });
    } catch (error) {
        console.error("Advanced search error:", error);
        return next(new ErrorResponse(`Advanced search failed: ${error.message}`, 500));
    }
});