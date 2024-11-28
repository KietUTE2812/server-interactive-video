import User from '../models/User.js';
import asyncHandler from 'express-async-handler';
import token from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import ErrorResponse from "../utils/ErrorResponse.js";


// const checkAuthStatus = async (req, res) => {
//     try {
//         console.log('Received userId:', req.user);
//         // The verifyToken middleware should have added the user's ID to the request object
//         const user = req.user;

//         if (!req.user) {
//             return res.status(401).json({ message: 'Không tìm thấy thông tin người dùng' });
//         }
//         // If we've got this far, the token is valid and we've found the user
//         res.status(200).json({
//             status: 'success',
//             data: {
//                 user: {
//                     id: _id,
//                     email,
//                     username,
//                     role,
//                     // Add any other user fields you want to send to the frontend
//                 }
//             }
//         });
//     } catch (error) {
//         console.error('Error in check-auth-status:', error);
//         res.status(500).json({ message: 'Internal server error' });
//     }
// };

// const checkAuth = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.user._id).select('-username -email -role');
//     if (user) {
//         res.json({
//             status: "success",
//             message: "Get user profile successfully",
//             data: user
//         });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// })


const verifyAccountCtrl = asyncHandler(async (req, res, next) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        return next(new ErrorResponse(`User not found with email of ${email}`, 404));
    }
    if (user.verifyCode == code) {
        user.status = 'active';
        user.verifyCode = '';
        await user.save();
        res.json({
            status: "success",
            message: "Verify account successfully"
        });
    } else {
        return next(new ErrorResponse(`Invalid code`, 400));
    }
});

// @desc    Register a new user
// @route   POST /api/v1/users/register
// @access  Public
const registerUserCtrl = asyncHandler(async (req, res, next) => {
    const { username, email, password, fullname } = req.body;
    const userExists = await User.findOne({ email });
    //Kiểm tra password
    if (password.length < 8 || (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[a-zA-Z\d!@#$%^&*(),.?":{}|<>]{8,}$/).test(password) === false) {
        return next(new ErrorResponse('Password must be at least 8 characters long and contain at least one lowercase letter, one uppercase letter, one number and one special character', 400));
    }
    //Kiểm tra xem user đã tồn tại chưa
    if (userExists) {
        return next(new ErrorResponse('User already exists', 400));
    }
    const userExistsUsername = await User.findOne({ username });
    //Kiểm tra xem user đã tồn tại chưa
    if (userExistsUsername) {
        return next(new ErrorResponse('Username already exists', 400));
    }

    // //Băm password
    // const salt = await bcrypt.genSalt(10)
    // const hashedPassword = await bcrypt.hash(password, salt)
    //Tạo user
    const userId = uuidv4();
    const user = await User.create({
        userId: userId,
        profile: {
            fullname: fullname,
        },
        username: username,
        email: email,
        password: password
    });
    //Tạo verify code
    const code = Math.floor(100000 + Math.random() * 900000);
    const expire = Date.now() + 10 * 60 * 1000;
    user.verifyCode = code;
    user.verifyCodeExpired = expire;
    await user.save();
    //Tạo message
    const message = `Please enter the following code to verify your account: ${code}`;
    //Kiểm tra user đã tạo chưa
    if (user) {
        try {
            await sendEmail({
                title: 'Verify account',
                email: user.email,
                subject: '[Code Chef] Verify your account. Valid for 10 minutes',
                message
            });
        } catch (error) {
            user.verifyCode = '';
            await user.save();
            return next(new ErrorResponse('Email could not be sent', 500));
        }
        res.status(201).json({
            status: "success",
            message: "User created successfully",
            data: user
        });
    } else {
        return next(new ErrorResponse('Invalid user data', 400));
    }

}
);

// @desc    Login user
// @route   POST /api/v1/users/login
// @access  Public
const loginUserCtrl = asyncHandler(async (req, res, next) => {
    const { isGoogle, isFacebook, isGitHub } = req.body;

    try {
        if (isGoogle) {
            const { email, googleId, picture, fullname } = req.body;
            var user = await User.findOne({ email });
            if (!user) {
                //Lưu refreshtoken vào db
                const userAdd = await User.create({
                    googleId: googleId,
                    userId: uuidv4(),
                    email: email,
                    username: email,
                    profile: { picture: picture, fullname: fullname },
                    role: 'student'
                });
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(userAdd._id);
                //Lưu refreshtoken vào db
                userAdd.refreshToken = refreshToken;
                await userAdd.save();
                // Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });
                res.json({
                    status: "success",
                    message: "Signup successfully",
                    data: {
                        user: userAdd,
                        token: token.generateToken(userAdd._id)
                    }
                });
                //Kiểm tra xem user đã tồn tại chưa
            } else if (user && user.googleId === googleId) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                await User.findByIdAndUpdate(user._id, { refreshToken }, { new: true });
                //Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });
                res.json({
                    status: "success",
                    message: "Login successfully",
                    data: {
                        user: user,
                        token: token.generateToken(user)
                    }
                });
            }
            //Kiểm tra xem user đã tồn tại nhưng chưa có googleId
            else if (user && user.googleId !== googleId) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                user.refreshToken = refreshToken;
                user.googleId = googleId;
                user.profile.picture = picture;
                user.profile.fullname = fullname;
                await user.save();

                //Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });

                res.json({
                    status: "success",
                    message: "Login successfully",
                    data: {
                        user: user,
                        token: token.generateToken(user)
                    }
                });
            }

        }
        else if (isFacebook) {
            const { email, facebookId, picture, fullname } = req.body;
            var user = await User.findOne({ email });
            if (!user) {
                //Lưu refreshtoken vào db
                const userAdd = await User.create({
                    facebookId: facebookId,
                    userId: uuidv4(),
                    email: email,
                    username: email,
                    profile: { picture: picture, fullname: fullname },
                    role: 'student'
                });
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(userAdd._id);
                //Lưu refreshtoken vào db
                userAdd.refreshToken = refreshToken;
                await userAdd.save();

                // Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });
                res.json({
                    status: "success",
                    message: "Signup successfully",
                    data: {
                        user: userAdd,
                        token: token.generateToken(userAdd._id)
                    }
                });
                //Kiểm tra xem user đã tồn tại chưa
            } else if (user && user.facebookId === facebookId) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                await User.findByIdAndUpdate(user._id, { refreshToken }, { new: true });
                //Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });
                res.json({
                    status: "success",
                    message: "Login successfully",
                    data: {
                        user: user,
                        token: token.generateToken(user)
                    }
                });
            }
            //Kiểm tra xem user đã tồn tại nhưng chưa có facebookId
            else if (user && user.facebookId !== facebookId) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                user.refreshToken = refreshToken;
                user.facebookId = facebookId;
                user.profile.picture = picture;
                user.profile.fullname = fullname;
                await user.save();

                //Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    sameSite: 'None',
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });

                res.json({
                    status: "success",
                    message: "Login successfully",
                    data: {
                        user: user,
                        token: token.generateToken(user)
                    }
                });
            }

        }
        else {
            const { email, password } = req.body;
            const user = await User.findOne({ email, status: 'active' });
            //Kiểm tra xem user đã tồn tại chưa
            if (user && (await bcrypt.compare(password, user?.password))) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                await User.findByIdAndUpdate(user._id, { refreshToken }, { new: true });
                //Trả về token ở response và refreshtoken ở cookie
                res.cookie('refreshToken', refreshToken, {
                    httpOnly: true,
                    maxAge: 3 * 24 * 60 * 60 * 1000
                });
                res.json({
                    status: "success",
                    message: "Login successfully",
                    data: {
                        user,
                        token: token.generateToken(user)
                    }
                });
            } else {
                return next(new ErrorResponse('Invalid credentials', 401));
            }
        }

    }
    catch (error) {
        return next(new ErrorResponse(error.message, 500));
    }

});

// @desc    Get user profile
// @route   GET /api/v1/users/:id
// @access  Private
const getUserProfileCtrl = asyncHandler(async (req, res) => {
    const _id = req.params.userid;

    const user = await User.findById(_id).select('-password -refreshToken').populate('enrolled_courses');
    if (user) {
        res.json({
            status: "success",
            message: "Get user profile successfully",
            data: user
        });
    } else {
        return next(new ErrorResponse('User not found', 404));
    }
    console.log("get profile user");

});

// @desc    Update user profile
// @route   PUT /api/v1/users/update-profile
// @access  Private
const updateUserCtrl = asyncHandler(async (req, res, next) => {
    const userId = req.params.userid;
    const filePath = req.file?.path;
    const { fullname, bio, phone } = req.body;
    // Kiểm tra xem user đã tồn tại chưa
    const user = await User.findById(userId);
    if (!user) {
        return next(new ErrorResponse('User not found', 404));
    }
    // Cập nhật thông tin user
    user.profile.fullname = fullname || user.profile.fullname;
    user.profile.bio = bio || user.profile.bio;
    user.profile.phone = phone || user.profile.phone;
    if (filePath) {
        user.profile.picture = filePath;
    }
    await user.save();
    res.json({
        status: "success",
        message: "Update user profile successfully",
        data: user
    });

}
);

// @desc    Update user profile
// @route   PUT /api/v1/users/update-profile
// @access  Private
const updateUserByAdminCtrl = asyncHandler(async (req, res, next) => {
    const adminId = req.params.userid;
    const filePath = req.file?.path;
    const { fullname, bio, phone, userId, status, role } = req.body;
    // Kiểm tra xem user đã tồn tại chưa
    const admin = await User.findById(adminId);
    if (!admin) {
        return next(new ErrorResponse('User not found', 404));
    }

    const user = await User.findById(userId).select('profile userId status role fullname bio phone');
    // Cập nhật thông tin user
    user.profile.fullname = fullname || user.profile.fullname;
    user.profile.bio = bio || user.profile.bio;
    user.profile.phone = phone || user.profile.phone;
    user.status = status || user.status
    user.role = role || user.role
    if (filePath) {
        user.profile.picture = filePath;
    }
    console.log(user);
    await user.save();
    res.json({
        status: "success",
        message: "Update user profile successfully",
        data: user
    });

}
);



// @desc    Forgot password (email)
// @route   POST /api/v1/users/forgot-password
// @access  Public
export const forgotPasswordCtrl = asyncHandler(async (req, res, next) => {
    const { email } = req.body;

    // Check if the user exists
    const user = await User.findOne({ email });
    if (!user) {
        return next(new ErrorResponse('There is no user with that email', 404));
    }
    // Tạo token chứa 10 ký tự ngẫu nhiên
    const resetToken = Math.floor(100000 + Math.random() * 900000);
    const resetExpire = Date.now() + 10 * 60 * 1000;
    user.verifyForgotPassword = resetToken;
    user.verifyForgotPasswordExpired = resetExpire;
    await user.save(); // Lưu token và thời gian hết hạn vào db

    // Tạo nội dung email
    const message = `Please enter the following code to reset your password: ${resetToken}`;

    try {
        // Send the email
        await sendEmail({
            email: user.email,
            subject: 'Your Password Reset Token (valid for 10 minutes)',
            message
        });

        res.status(200).json({
            status: 'success',
            message: 'Token sent to email!'
        });
    } catch (err) {
        return next(new ErrorResponse('Email could not be sent', 500));
    }
});

// @desc    Reset password (token, new password)
// @route   GET /api/v1/users/reset-password/:token
// @access  Public
export const resetPasswordCtrl = asyncHandler(async (req, res, next) => {
    const { code, password } = req.body;

    try {
        // Xác thực token
        const user = await User.findOne({ verifyForgotPassword: code, verifyForgotPasswordExpired: { $gt: Date.now() } });

        // Kiểm tra user
        if (!user) {
            return next(new ErrorResponse('Token is invalid or has expired', 400));
        }

        // Set new password
        user.password = password
        user.verifyForgotPassword = '';
        user.verifyForgotPasswordExpired = '';
        await user.save();

        // Send response
        res.status(200).json({
            status: 'success',
            message: 'Password reset successful!',
            token: token.generateToken(user),
        });
    } catch (err) {
        // Handle invalid or expired token
        return next(new ErrorResponse('Invalid token or token was expired', 400));
    }
});

// @desc Delete user
// @route DELETE /api/v1/users/:userid
// @access Private/Admin
const deleteUserCtrl = asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.userid);
    if (user) {
        await User.updateOne({ _id: req.params.userid }, { status: 'removed' });
        res.json({
            status: "success",
            message: "User removed successfully"
        });
    }
    else {
        return next(new ErrorResponse('User not found', 404));
    }
});

function getCookieValue(cookieString, name) {
    // Tách các cookie thành mảng
    const cookieArray = cookieString.split('; ');

    // Tìm cookie có key là 'name'
    const cookie = cookieArray.find(cookie => cookie.startsWith(name + '='));

    // Trả về giá trị của cookie nếu tìm thấy, ngược lại trả về null
    return cookie ? cookie.split('=')[1] : null;
}

// @desc    Refresh token
// @route   POST /api/v1/users/refresh-token
// @access  Public
const refreshAccessTokenCtrl = asyncHandler(async (req, res, next) => {
    const cookie = req.headers.cookie;
    const refreshToken = getCookieValue(cookie, 'refreshToken');
    if (!cookie && !refreshToken) {
        return next(new ErrorResponse('No cookie, no refresh, must login', 401));
    }
    await jwt.verify(refreshToken, process.env.JWT_SECRET, async (error, decoded) => {
        if (error) {
            return next(new ErrorResponse('Invalid refresh token', 403));
        }
        const user = await User.findById(decoded._id);
        if (!user || user.refreshToken !== refreshToken) {
            return next(new ErrorResponse('Invalid refresh token', 403));
        }
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            sameSite: 'None',
            maxAge: 3 * 24 * 60 * 60 * 1000
        });
        res.json({
            status: "success",
            message: "Refresh access token successfully",
            data: {
                success: true,
                newToken: token.generateToken(user)
            }
        });
    }
    );
});

// @desc    Logout
// @route   POST /api/v1/users/logout
// @access  Private

const logoutCtrl = asyncHandler(async (req, res) => {
    const cookie = req.headers.cookie;
    if (!cookie) {
        return next(new ErrorResponse('No cookie, no refresh, must login', 401));
    }
    const refreshToken = cookie.split('=')[1];
    //Kiểm tra xem có cookie và refreshToken không
    if (!refreshToken) {
        return next(new ErrorResponse('No cookie, no refresh, must login', 401));
    }
    //Xóa refreshToken trong db
    await User.findOneAndUpdate({ refreshToken }, { refreshToken: '' }, { new: true });
    //Xóa refreshToken trong cookie
    res.clearCookie('refreshToken');
    res.json({
        status: "success",
        message: "Logout successfully"
    });
});

// @desc Get users by Filter and Pagination
// @route GET api/v1/users?limit=1&page=1&filter={}
// @access Private Admin, Private Intructors
const getAllUserCtrl = asyncHandler(async (req, res) => {
    const { limit, page, ...filters } = req.query;
    const query = filters;
    if(req.user.role !== 'admin' && limit >= 10 && page >=1) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
    // Filter by email
    if (filters.email) {
        query.email = { $regex: filters.email, $options: 'i' };
    }

    // Filter by fullname
    if (filters.fullname) {
        query['profile.fullname'] = { $regex: filters.fullname, $options: 'i' };
        delete query.fullname;
    }

    // Filter by username
    if (filters.username) {
        query.username = { $regex: filters.username, $options: 'i' };
    }

    // Filter by role
    if (filters.role) {
        query.role = filters.role;
    }
    if (filters.courseId) {
        query.enrolled_courses = { $in: [filters.courseId] };
    }

    // Filter by status
    if (filters.status) {
        query.status = filters.status;
    }
    console.log(query);
    const users = await User.find(query)
        .limit(limit)
        .skip(limit * (page - 1)).select('profile email username role status');
    const total = await User.countDocuments(query);

    res.status(200).json({
        status: "success",
        total,
        limit,
        page,
        data: {
            users
        }
    });
});

export default {
    registerUserCtrl, loginUserCtrl, getUserProfileCtrl, updateUserCtrl,
    forgotPasswordCtrl, resetPasswordCtrl, deleteUserCtrl,
    refreshAccessTokenCtrl, logoutCtrl, verifyAccountCtrl, getAllUserCtrl, updateUserByAdminCtrl
};