import asyncHandler from "express-async-handler";
import ErrorResponse from "../utils/ErrorResponse.js";
import Course from "../models/Course.js";


// @desc    Search courses for authenticated student
// @route   GET /api/v1/search/:searchValue
// @access  Private (student)
export const searchCourseForUser = asyncHandler(async (req, res, next) => {
    const { searchValue } = req.params;
    const {
        q,
        categories,
        levels,
        minPrice = 0,
        maxPrice,
        rating,
        sort = 'relevance',
        page = 1,
        limit = 12
    } = req.query;

    // Build search query
    const query = {};
    console.log("Query value:", q);
    // Chỉ thêm điều kiện tìm kiếm nếu q là một chuỗi hợp lệ
    if (q && typeof q === 'string' && q.trim() !== '') {
        // query.$or = [
        //     { title: { $regex: q, $options: 'i' } },
        //     { description: { $regex: q, $options: 'i' } },
        //     { 'instructor.name': { $regex: q, $options: 'i' } }
        // ];
        query.$text = { $search: q };
    }

    // Add filters
    if (categories) {
        const categoryArray = categories.split(',');
        query.category = { $in: categoryArray };
    }

    if (levels) {
        const levelArray = levels.split(',');
        query.level = { $in: levelArray };
    }

    // Add price range
    query.price = { $gte: minPrice };
    if (maxPrice) {
        query.price.$lte = maxPrice;
    }

    // Add rating filter
    if (rating) {
        query.rating = { $gte: parseFloat(rating) };
    }
    // Pagination
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = parseInt(page) * parseInt(limit);
    const total = await Course.countDocuments(query);

    // Sorting
    let sortOptions = {};
    if (sort === 'price-low') {
        sortOptions = { price: 1 };
    } else if (sort === 'price-high') {
        sortOptions = { price: -1 };
    } else if (sort === 'rating') {
        sortOptions = { rating: -1 };
    } else if (sort === 'newest') {
        sortOptions = { createdAt: -1 };
    } else if (sort === 'relevance') {
        sortOptions = { score: { $meta: 'textScore' } };
    }
    console.log("Query", query)
    const courses = await Course.find(query)
        .sort(sortOptions)
        .limit(limit)
        .skip(startIndex);

    const pagination = {};
    if (endIndex < total) {
        pagination.next = {
            page: page + 1,
            limit
        }
    }
    if (startIndex > 0) {
        pagination.prev = {
            page: page - 1,
            limit
        }
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
        success: true,
        count: courses.length,
        pagination,
        totalPages,
        data: courses
    });
});

export const searchWithLevels = asyncHandler(async (req, res, next) => {
    console.log("Search course with levels")
    res.status(200).json({
        message: "Successfully"
    })
});

export const searchWithCategories = asyncHandler(async (req, res, next) => {
    console.log("Search course with categories")
    res.status(200).json({
        message: "Successfully"
    })
});

export const getCategories = asyncHandler(async (req, res, next) => {
    console.log("Get all categories")
    res.status(200).json({
        message: "Successfully"
    })
});

export const getLevels = asyncHandler(async (req, res, next) => {
    console.log("Get all levels")
    res.status(200).json({
        message: "Successfully"
    })
});