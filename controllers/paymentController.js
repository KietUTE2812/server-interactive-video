import Payment from "../models/Payment.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from "../models/User.js";
import crypto from 'crypto';
import querystring from 'querystring';
import excel from 'exceljs';
import Course from "../models/Course.js";
import dateFormat from 'dateformat';
import vnp from 'vnpay';
const {VNPay} = vnp;

import dotenv from 'dotenv';
dotenv.config();

const vnpay = new VNPay({
    api_Host: 'https://sandbox.vnpayment.vn',
    tmnCode: process.env.VNP_TMN_CODE,
    secureSecret: process.env.VNP_HASH_SECRET,
});

// @desc      Get all payments with enhanced filtering for admin
// @route     GET /api/v1/payments
// @access    Public
const getPayments = asyncHandler(async (req, res, next) => {
    const { 
        fromMonth = 1, 
        toMonth = 12, 
        year = new Date().getFullYear(), 
        userId, 
        search, 
        courseId,
        paymentStatus,
        paymentMethod,
        page = 1,
        limit = 10,
        sort = 'createdAt',
        order = 'desc' 
    } = req.query;
    
    const user = req.user;

    // For students - show only their own payments
    if (user.role === 'student') {
        let payments = await Payment.find({ userId: user._id })
            .populate('courseId', 'title description photo price');
        
        res.status(200).json({
            success: true,
            count: payments.length,
            data: {
                payments: payments,
            }
        });
        return;
    }

    // Validate query parameters
    if(fromMonth > toMonth) {
        return next(new ErrorResponse('From month must be less than to month', 400));
    }

    // Calculate date range for filtering
    const startDate = new Date(year, fromMonth - 1, 1);
    const endDate = new Date(year, toMonth, 0, 23, 59, 59, 999); 

    // Build filter object
    const filter = {
        createdAt: {
            $gte: startDate,
            $lte: endDate
        }
    };

    // Add optional filters if they exist
    if (userId) filter.userId = userId;
    if (courseId) filter.courseId = courseId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    
    // Search functionality (across multiple fields)
    if (search) {
        const searchRegex = new RegExp(search, 'i');
        filter.$or = [
            { 'orderInfo': searchRegex },
            { 'paymentId': searchRegex }
        ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;

    // Get total count for pagination
    const totalCount = await Payment.countDocuments(filter);
    
    // Get paginated payments
    const payments = await Payment.find(filter)
        .populate('userId', 'username profile email')
        .populate('courseId', 'title description photo price')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));

    // Get related courses (only needed if not populated)
    const courses = payments.map(payment => payment.courseId);

    // ---- Analytics for admin dashboard ----
    
    // 1. Payment Status Statistics
    const paymentStatistics = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$paymentStatus',
                count: { $sum: 1 },
                total: { $sum: '$amount' }
            }
        }
    ]);

    // 2. Payment Method Statistics
    const paymentMethodStats = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$paymentMethod',
                count: { $sum: 1 },
                total: { $sum: '$amount' }
            }
        }
    ]);

    // 3. Monthly Revenue Trends
    const monthlyTrends = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                paymentStatus: 'success'
            }
        },
        {
            $group: {
                _id: { 
                    month: { $month: '$createdAt' },
                    year: { $year: '$createdAt' }
                },
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1 }
        }
    ]);

    // 4. Course Revenue Statistics (Top courses by revenue)
    const courseRevenueStats = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                paymentStatus: 'success'
            }
        },
        {
            $group: {
                _id: '$courseId',
                totalRevenue: { $sum: '$amount' },
                enrollments: { $sum: 1 }
            }
        },
        {
            $sort: { totalRevenue: -1 }
        },
        {
            $limit: 10
        }
    ]);

    // Get course details for the top revenue courses
    const topCourses = await Promise.all(
        courseRevenueStats.map(async (item) => {
            const course = await Course.findById(item._id);
            return {
                ...item,
                course: course ? {
                    title: course.title,
                    photo: course.photo,
                    price: course.price
                } : null
            };
        })
    );

    // 5. Instructor Revenue Statistics
    const instructorRevenueStats = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                paymentStatus: 'success'
            }
        },
        {
            $lookup: {
                from: 'courses',
                localField: 'courseId',
                foreignField: '_id',
                as: 'course'
            }
        },
        {
            $unwind: '$course'
        },
        {
            $group: {
                _id: '$course.instructor',
                totalRevenue: { $sum: '$amount' },
                coursesSold: { $sum: 1 }
            }
        },
        {
            $sort: { totalRevenue: -1 }
        },
        {
            $limit: 10
        }
    ]);

    // Get instructor details
    const topInstructors = await Promise.all(
        instructorRevenueStats.map(async (item) => {
            const instructor = await User.findById(item._id);
            return {
                ...item,
                instructor: instructor ? {
                    fullname: instructor.profile.fullname,
                    picture: instructor.profile.picture,
                    email: instructor.email
                } : null
            };
        })
    );

    // Format totals to ensure we always have values
    const totalSuccess = await Payment.aggregate([
        {
            $match: {
                paymentStatus: 'success',
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    const totalPending = await Payment.aggregate([
        {
            $match: {
                paymentStatus: 'pending',
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);
    
    const totalFailed = await Payment.aggregate([
        {
            $match: {
                paymentStatus: 'failed',
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    // Return enhanced response with analytics
    res.status(200).json({ 
        success: true, 
        count: payments.length,
        totalCount,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / parseInt(limit))
        },
        financialSummary: {
            success: totalSuccess.length > 0 ? totalSuccess[0] : { total: 0, count: 0 },
            pending: totalPending.length > 0 ? totalPending[0] : { total: 0, count: 0 },
            failed: totalFailed.length > 0 ? totalFailed[0] : { total: 0, count: 0 }
        },
        analytics: {
            paymentStatistics,
            paymentMethodStats,
            monthlyTrends,
            topCourses,
            topInstructors
        },
        data: {
            payments,
            courses
        }
    });
});

// @desc      Get analytics for admin dashboard
// @route     GET /api/v1/payments/analytics
// @access    Private/Admin
const getPaymentAnalytics = asyncHandler(async (req, res, next) => {
    const { 
        period = 'monthly', 
        year = new Date().getFullYear(), 
        month = new Date().getMonth() + 1
    } = req.query;
    
    // Check if user is admin
    if (req.user.role !== 'admin') {
        return next(new ErrorResponse('Not authorized to access payment analytics', 403));
    }

    let startDate, endDate;
    const currentDate = new Date();

    // Set date range based on requested period
    switch (period) {
        case 'daily':
            // Last 30 days
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - 30);
            endDate = new Date(currentDate);
            break;
        case 'weekly':
            // Last 12 weeks
            startDate = new Date(currentDate);
            startDate.setDate(currentDate.getDate() - 84); // 12 weeks * 7 days
            endDate = new Date(currentDate);
            break;
        case 'monthly':
            // Last 12 months
            startDate = new Date(currentDate);
            startDate.setMonth(currentDate.getMonth() - 12);
            endDate = new Date(currentDate);
            break;
        case 'yearly':
            // Last 5 years
            startDate = new Date(currentDate);
            startDate.setFullYear(currentDate.getFullYear() - 5);
            endDate = new Date(currentDate);
            break;
        case 'custom':
            // Custom date range from the specified year and month
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59, 999);
            break;
        default:
            // Default to monthly
            startDate = new Date(currentDate);
            startDate.setMonth(currentDate.getMonth() - 12);
            endDate = new Date(currentDate);
    }

    // 1. Overall Payment Statistics
    const overallStats = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: null,
                totalRevenue: { $sum: { $cond: [ { $eq: ["$paymentStatus", "success"] }, "$amount", 0 ] } },
                totalTransactions: { $sum: 1 },
                successfulTransactions: { $sum: { $cond: [ { $eq: ["$paymentStatus", "success"] }, 1, 0 ] } },
                failedTransactions: { $sum: { $cond: [ { $eq: ["$paymentStatus", "failed"] }, 1, 0 ] } },
                pendingTransactions: { $sum: { $cond: [ { $eq: ["$paymentStatus", "pending"] }, 1, 0 ] } },
                averageOrderValue: { $avg: { $cond: [ { $eq: ["$paymentStatus", "success"] }, "$amount", null ] } }
            }
        }
    ]);

    // 2. Time-based Revenue Trends
    let timeGroup, timeFormat;
    switch (period) {
        case 'daily':
            timeGroup = { day: { $dayOfMonth: '$createdAt' }, month: { $month: '$createdAt' }, year: { $year: '$createdAt' } };
            timeFormat = '%Y-%m-%d';
            break;
        case 'weekly':
            timeGroup = { week: { $week: '$createdAt' }, year: { $year: '$createdAt' } };
            timeFormat = '%Y-W%U';
            break;
        case 'monthly':
        default:
            timeGroup = { month: { $month: '$createdAt' }, year: { $year: '$createdAt' } };
            timeFormat = '%Y-%m';
            break;
        case 'yearly':
            timeGroup = { year: { $year: '$createdAt' } };
            timeFormat = '%Y';
            break;
    }

    const revenueTrends = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                paymentStatus: 'success'
            }
        },
        {
            $group: {
                _id: timeGroup,
                revenue: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        },
        {
            $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 }
        }
    ]);

    // 3. Course Performance
    const coursePerformance = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate },
                paymentStatus: 'success'
            }
        },
        {
            $group: {
                _id: '$courseId',
                revenue: { $sum: '$amount' },
                purchases: { $sum: 1 }
            }
        },
        {
            $lookup: {
                from: 'courses',
                localField: '_id',
                foreignField: '_id',
                as: 'courseDetails'
            }
        },
        {
            $unwind: '$courseDetails'
        },
        {
            $project: {
                courseId: '$_id',
                courseTitle: '$courseDetails.title',
                coursePrice: '$courseDetails.price',
                revenue: 1,
                purchases: 1,
                instructor: '$courseDetails.instructor'
            }
        },
        {
            $sort: { revenue: -1 }
        },
        {
            $limit: 10
        }
    ]);

    // 4. Payment Method Distribution
    const paymentMethodDistribution = await Payment.aggregate([
        {
            $match: {
                createdAt: { $gte: startDate, $lte: endDate }
            }
        },
        {
            $group: {
                _id: '$paymentMethod',
                totalTransactions: { $sum: 1 },
                totalAmount: { $sum: '$amount' },
                successfulTransactions: { $sum: { $cond: [ { $eq: ["$paymentStatus", "success"] }, 1, 0 ] } },
                successAmount: { $sum: { $cond: [ { $eq: ["$paymentStatus", "success"] }, "$amount", 0 ] } }
            }
        }
    ]);

    // Return all analytics
    res.status(200).json({
        success: true,
        period,
        dateRange: {
            startDate,
            endDate
        },
        analytics: {
            overallStats: overallStats.length > 0 ? overallStats[0] : {
                totalRevenue: 0,
                totalTransactions: 0,
                successfulTransactions: 0,
                failedTransactions: 0,
                pendingTransactions: 0,
                averageOrderValue: 0
            },
            revenueTrends,
            coursePerformance,
            paymentMethodDistribution
        }
    });
});

// @desc      Export payments to excel
// @route     GET /api/v1/payments/export
// @access    Private/Admin
const exportPayments = asyncHandler(async (req, res, next) => {
    const payments = await Payment.find().populate('userId', 'profile email').populate('courseId', 'title description photo price');
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Payments');

    // Define columns
    worksheet.columns = [
        { header: 'ID', key: '_id', width: 25 },
        { header: 'User', key: 'user', width: 20 },
        { header: 'Email', key: 'email', width: 20 },
        { header: 'Course', key: 'course', width: 20 },
        { header: 'Amount', key: 'amount', width: 15 },
        { header: 'Currency', key: 'currency', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Date', key: 'createdAt', width: 20 }
    ];

    // Add rows
    payments.forEach(payment => {
        worksheet.addRow([
            payment._id,
            payment.userId?.profile?.fullname,
            payment.userId?.email,
            payment.courseId?.title,
            payment.amount,
            payment.currency,
            payment.paymentStatus,
            payment.createdAt
        ]);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=payments.xlsx');

    await workbook.xlsx.write(res);
    res.end();
});

// @desc      Get all payments by user id
// @route     GET /api/v1/payments/user/:userId
// @access    Public
const getPaymentsByUserId = asyncHandler(async (req, res, next) => {
    const userId = req.params.userId;
    const { page = 1, limit = 10, sort = 'createdAt', order = 'desc' } = req.query;
    
    // Check user exists
    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${userId}`, 404));
    }

    // Access control - only admin or the user themselves can view
    if (req.user.role !== 'admin' && req.user._id.toString() !== userId) {
        return next(new ErrorResponse('Not authorized to access these payment records', 403));
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOption = {};
    sortOption[sort] = order === 'desc' ? -1 : 1;

    // Get total count
    const totalCount = await Payment.countDocuments({ userId });

    // Get payments with pagination
    const payments = await Payment.find({ userId })
        .populate('userId', 'username profile email')
        .populate('courseId', 'title description photo price')
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit));

    // Get user stats
    const userStats = await Payment.aggregate([
        {
            $match: { userId: mongoose.Types.ObjectId(userId) }
        },
        {
            $group: {
                _id: '$paymentStatus',
                total: { $sum: '$amount' },
                count: { $sum: 1 }
            }
        }
    ]);

    res.status(200).json({ 
        success: true, 
        count: payments.length,
        totalCount,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            totalPages: Math.ceil(totalCount / parseInt(limit))
        },
        userStats,
        data: payments 
    });
});

// @desc      Get payment by id
// @route     GET /api/v1/payments/:id
// @access    Public
const getPaymentById = asyncHandler(async (req, res, next) => {
    const payment = await Payment.findById(req.params.id)
        .populate('userId', 'username profile email')
        .populate('courseId', 'title description photo price instructor');
    
    if (!payment) {
        return next(new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404));
    }
    
    // Access control - only admin, the payer, or the course instructor can view
    const isInstructor = payment.courseId && 
                        payment.courseId.instructor && 
                        payment.courseId.instructor.toString() === req.user._id.toString();
    
    if (req.user.role !== 'admin' && 
        req.user._id.toString() !== payment.userId._id.toString() && 
        !isInstructor) {
        return next(new ErrorResponse('Not authorized to access this payment record', 403));
    }
    
    res.status(200).json({ success: true, data: payment });
});


// @desc      Create new payment
// @route     POST /api/v1/payments body {amount}
// @access    Public
const createPayment = asyncHandler(async (req, res, next) => {
    const { amount, orderInfo, courseId, userId } = req.body;
    let ipAddr = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    let date = new Date();
    let createDate = dateFormat(date, 'yyyymmddmmHHss');
    let exDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);
    let expireDate = dateFormat(exDate, 'yyyymmddHHmmss');

    const paymentUrl = vnpay.buildPaymentUrl({
        vnp_Amount: amount,
        vnp_IpAddr: ipAddr,
        vnp_TxnRef: date.getTime(),
        vnp_OrderInfo: orderInfo || 'Thanh toán học phí',
        vnp_OrderType: 'billpayment',
        vnp_ReturnUrl: 'http://localhost:3000/api/v1/payments/vnpay-return',
        vnp_Locale: 'vn',
        vnp_CreateDate: createDate, // tùy chọn, mặc định là hiện tại
        vnp_ExpireDate: expireDate, // tùy chọn
    }); 
    const course = await Course.findOne({courseId: courseId})
    // Kiểm tra payment có tồn tại không
    const checkPayment = await Payment.findOne({ userId: userId, courseId: course._id, paymentStatus: 'success'});
    if (checkPayment) {
        return next(new ErrorResponse(`Payment already exists with user id of ${userId} and course id of ${course._id}`, 400));
    }
    //Tạo payment
    const payment = await Payment.create({
        userId: userId,
        courseId: course?._id,
        paymentId: date.getTime(),
        amount: amount,
        currency: 'vnd',
        orderId: createDate,
        orderInfo: orderInfo || 'Thanh toán học phí',
        paymentMethod: 'vnpay',
        paymentStatus: 'pending',
        ipAddress: ipAddr,
        userAgent: req.headers['user-agent'] || 'Unknown'
    });
    // Trả về URL để chuyển hướng đến VNPay
    res.json({
        success: true,
        data: paymentUrl,
    });
});

// Hàm sắp xếp object để tạo chuỗi query string đúng thứ tự
function sortObject(obj) {
    let sorted = {};
    let keys = Object.keys(obj).sort();
    keys.forEach(key => {
        sorted[key] = obj[key];
    });
    return sorted;
}

const vnPayIPN = asyncHandler(async (req, res, next) => {
    let vnp_Params = req.query;

    let secureHash = vnp_Params['vnp_SecureHash'];

    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    vnp_Params = sortObject(vnp_Params);
    let secretKey = process.env.VNP_HASH_SECRET;
    let signData = querystring.stringify(vnp_Params);
    let hmac = crypto.createHmac('sha512', secretKey);
    let signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
        var orderId = vnp_Params['vnp_TxnRef'];
            var rspCode = vnp_Params['vnp_ResponseCode'];
            //Kiem tra du lieu co hop le khong, cap nhat trang thai don hang va gui ket qua cho VNPAY theo dinh dang duoi
            res.status(200).json({RspCode: '00', Message: 'success'})
    } else {
        // Chuyển hướng đến frontend với thông báo lỗi
        res.status(200).json({RspCode: '97', Message: 'Fail checksum'})
    }
});


// @desc      VNPay return
// @route     GET /api/v1/payments/vnpay-return
// @access    Public
const vnpayReturn = asyncHandler(async (req, res, next) => {
    const verify = vnpay.verifyReturnUrl(req.query);
    const payment = await Payment.findOne({ paymentId: verify.vnp_TxnRef });
    console.log(payment);
    if (verify.isVerified) {    
        if (!payment) {
            console.log('Payment not found');
            payment.paymentStatus = 'failed';
            payment.save();
            return res.redirect(`${process.env.CLIENT_URL}/vnpay_return?status=failed`);
        }
        // Cập nhật trạng thái giao dịch
        payment.paymentStatus = verify.isSuccess === true ? 'success' : 'failed';
        payment.transactionNo = verify.vnp_TransactionNo || '';
        
        // Store payment details for analytics
        payment.paymentDetail = {
            responseCode: verify.vnp_ResponseCode,
            bankCode: verify.vnp_BankCode,
            bankTranNo: verify.vnp_BankTranNo,
            cardType: verify.vnp_CardType,
            transactionDate: verify.vnp_PayDate
        };
        
        await payment.save();
        // Đăng ký học phần cho user
        if (verify.isSuccess === true) {
            const course = await Course.findById(payment.courseId)
            if (!course){
                return res.redirect(`${process.env.CLIENT_URL}/vnpay_return?status=failed`);
            }
            const user = await User.findById(payment.userId);
            
            user.enrolled_courses.push(payment.courseId);
            user.save();
        }
        // Chuyển hướng đến frontend kèm theo các tham số giao dịch
        return res.redirect(`${process.env.CLIENT_URL}/vnpay_return?status=success&orderId=${verify.vnp_TxnRef}&courseId=${payment.courseId}&amount=${verify.vnp_Amount}&transactionNo=${verify.vnp_TransactionNo}`);
    } else {
        payment.paymentStatus = 'failed';
        payment.save();
        // Chuyển hướng đến frontend với thông báo lỗi
        return res.redirect(`${process.env.CLIENT_URL}/vnpay_return?status=failed`);
    }
}); 

export default {
    getPayments, 
    getPaymentsByUserId, 
    getPaymentById, 
    createPayment, 
    vnpayReturn, 
    vnPayIPN,
    getPaymentAnalytics,
    exportPayments
};
            