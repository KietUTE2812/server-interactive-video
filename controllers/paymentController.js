import Payment from "../models/Payment.js";
import asyncHandler from "../middlewares/asyncHandler.js";
import ErrorResponse from "../utils/ErrorResponse.js";
import User from "../models/User.js";
import crypto from 'crypto';
import querystring from 'querystring';
import Course from "../models/Course.js";
import dateFormat from 'dateformat';
import vnp from 'vnpay';
const {VNPay} = vnp;

import dotenv from 'dotenv';
dotenv.config();

const vnpay = new VNPay({
    api_Host: 'http://sandbox.vnpayment.vn',
    tmnCode: process.env.VNP_TMN_CODE,
    secureSecret: process.env.VNP_HASH_SECRET,
});

// @desc      Get all payments
// @route     GET /api/v1/payments
// @access    Public
const getPayments = asyncHandler(async (req, res, next) => {
    const { fromMonth, toMonth, year } = req.query;

    if(fromMonth > toMonth) {
        return next(new ErrorResponse('From month must be less than to month', 400));
    }

    const startDate = new Date(year, fromMonth - 1, 1);

    const endDate = new Date(year, toMonth, 0, 23, 59, 59, 999); 

    const payments = await Payment.find()
        .where('createdAt')
        .gte(startDate)
        .lte(endDate);

    const courses = await Promise.all(
            payments.map(async (payment) => {
                const course = await Course.findById(payment.courseId);
                return course;
            })
        );
        const totalSuccess = await Payment.aggregate([
            {
                $match: {
                    paymentStatus: 'success'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        const totalPending = await Payment.aggregate([
            {
                $match: {
                    paymentStatus: 'pending'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
        const totalFailed = await Payment.aggregate([
            {
                $match: {
                    paymentStatus: 'failed'
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$amount' }
                }
            }
        ]);
    res.status(200).json({ success: true, count: payments.length,total: {totalSuccess, totalPending, totalFailed}, data: {
        payments: payments,
        courses: courses
    } });
});

// @desc      Get all payments by user id
// @route     GET /api/v1/payments/user/:userId
// @access    Public
const getPaymentsByUserId = asyncHandler(async (req, res, next) => {
    const userId = req.params.userId;
    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorResponse(`User not found with id of ${userId}`, 404));
    }

    

    const payments = await Payment.find({ userId: userId })
        .populate('userId').populate('courseId');
    res.status(200).json({ success: true, count: payments.length, data: payments });
}
);

// @desc      Get payment by id
// @route     GET /api/v1/payments/:id
// @access    Public
const getPaymentById = asyncHandler(async (req, res, next) => {
    const payment = await Payment.findById(req.params.id).populate('userId', 'profile').populate('courseId', 'title');
    if (!payment) {
        return next(new ErrorResponse(`Payment not found with id of ${req.params.id}`, 404));
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
    const checkPayment = await Payment.findOne({ userId: userId, courseId: course._id});
    if (checkPayment) {
        return res.status(400).json({ success: false, message: 'Payment already exists' });
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
        payment.save();
        // Đăng ký học phần cho user
        if (verify.isSuccess === true) {
            const course = await Course.findById(payment.courseId)
            if (!course){
                console.log('Course not found', payment.courseId);
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

export default {getPayments, getPaymentsByUserId, getPaymentById, createPayment, vnpayReturn, vnPayIPN};
            