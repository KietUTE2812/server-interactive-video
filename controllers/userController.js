import User from '../models/User.js';
import asyncHandler from 'express-async-handler';
import token from '../utils/generateToken.js';
import sendEmail from '../utils/sendEmail.js';
import bcrypt from "bcryptjs"
import { v4 as uuidv4 } from 'uuid';
import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const verifyAccountCtrl = asyncHandler(async (req, res) => {
    const { email, code } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
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
        res.status(400);
        throw new Error('Invalid code');
    }
});

// @desc    Register a new user
// @route   POST /api/v1/users/register
// @access  Public
const registerUserCtrl = asyncHandler(async (req, res) => {
    const { username, email, password, fullname } = req.body;
    const userExists = await User.findOne({ email });
    //Kiểm tra password
    if(password.length < 8 || (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>])[a-zA-Z\d!@#$%^&*(),.?":{}|<>]{8,}$/).test(password) === false) {
        res.status(400);
        throw new Error('Password is invalid');
    }
    //Kiểm tra xem user đã tồn tại chưa
    if (userExists) {
        res.status(400);
        throw new Error('Email already exists');
    }
    const userExistsUsername = await User.findOne({ username });
    //Kiểm tra xem user đã tồn tại chưa
    if (userExistsUsername) {
        res.status(400);
        throw new Error('Username already exists');
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
    user.verifyCode = code;
    await user.save();
    //Tạo message
    const message = `Please enter the following code to verify your account: ${code}`;
    //Kiểm tra user đã tạo chưa
    if (user) {
        try {
            await sendEmail({
                title: 'Verify account',
                email: user.email,
                subject: '[Code Chef] Verify your account',
                message
            });
        } catch (error) {
            user.verifyCode = '';
            await user.save();
            res.status(500);
            throw new Error('Email could not be sent' + error);
        }
        res.status(201).json({
            status: "success",
            message: "User created successfully",
            data: user
        });
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
    //Create verify url
    
}
);

// @desc    Login user
// @route   POST /api/v1/users/login
// @access  Public
const loginUserCtrl = asyncHandler(async (req, res) => {
    const { isGoogle, isFacebook, isGitHub } = req.body;

    try {
        if(isGoogle){
            const { email, googleId, picture, fullname } = req.body;
            var user = await User.findOne({ email });
            if (!user) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                const userAdd = await User.create({
                    googleId: googleId,
                    userId: uuidv4(),
                    email: email,
                    username: email,
                    profile: {picture: picture, fullname: fullname},
                    refreshToken: refreshToken,
                    role: 'student'
                });
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
            } else if(user && user.googleId === googleId){
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
                        token: token.generateToken(user._id)
                    }
                });
            }
            //Kiểm tra xem user đã tồn tại nhưng chưa có facebookId
            else if(user && user.googleId !== googleId){
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
                        token: token.generateToken(user._id)
                    }
                });
            }

        }
        else if(isFacebook){
            const { email, facebookId, picture, fullname } = req.body;
            var user = await User.findOne({ email });
            if (!user) {
                //Tạo Refreshtoken
                const refreshToken = token.generateRefreshToken(user._id);
                //Lưu refreshtoken vào db
                const userAdd = await User.create({
                    facebookId: facebookId,
                    userId: uuidv4(),
                    email: email,
                    username: email,
                    profile: {picture: picture, fullname: fullname},
                    refreshToken: refreshToken,
                    role: 'student'
                });
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
            } else if(user && user.facebookId === facebookId){
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
                        token: token.generateToken(user._id)
                    }
                });
            }
            //Kiểm tra xem user đã tồn tại nhưng chưa có facebookId
            else if(user && user.facebookId !== facebookId){
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
                        token: token.generateToken(user._id)
                    }
                });
            }

        }
        else{
            const { email, password } = req.body;
            const user = await User.findOne({ email });
            console.log(email);
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
                        token: token.generateToken(user._id)
                    }
                });
            } else {
                res.status(401);
                throw new Error('Invalid email or password');
            }
        }
        
    }
    catch (error) {
        res.status(401);
        throw new Error('Login failed' + error);
    }

});

// @desc    Get user profile
// @route   GET /api/v1/users/profile
// @access  Private
const getUserProfileCtrl = asyncHandler(async (req, res) => {
    const _id = req.params.userid;
    const user = await User.findById({ _id }).select('-password -refreshToken -role');
    if (user) {
        res.json({
            status: "success",
            message: "Get user profile successfully",
            data: user
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

// @desc    Update user profile
// @route   PUT /api/v1/users/update-profile
// @access  Private
const updateUserCtrl = asyncHandler(async (req, res) => {
    const user = await User.findById(req.userId);
    if (user) {
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        if (req.body.password) {
            user.password = req.body.password;
        }
        const updatedUser = await user.save();
        res.json({
            status: "success",
            message: "Update user profile successfully",
            data: updatedUser
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
}
);

// @desc    Forgot password
// @route   POST /api/v1/users/forgot-password
// @access  Public
const forgotPasswordCtrl = asyncHandler(async (req, res) => {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
        res.status(404);
        throw new Error('User not found');
    }
    //Get reset token
    const resetToken = user.getResetPasswordToken();
    await user.save();
    //Create reset url
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/users/reset-password/${resetToken}`;
    const message = `You are receiving this email because you 
    (or someone else) has requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl} \n\n This link will expire in 10 minutes`;
    try {
        await sendEmail({
            title: 'Reset password',
            email: user.email,
            subject: '[Code Chef] Password reset token',
            message
        });
        res.json({
            status: "success",
            message: "Email sent"
        });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent');
    }
});

// @desc    Reset password
// @route   GET /api/v1/users/reset-password/:token
// @access  Public
const resetPasswordCtrl = asyncHandler(async (req, res) => {
    const resetPasswordToken = req.params.token;
    const resetToken = crypto.createHash('sha256').update(resetPasswordToken).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: resetToken,
        resetPasswordExpire: { $gt: Date.now() }
    });
    if (!user) {
        res.status(400);
        throw new Error('Invalid token');
    }
    //Set new password
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();
    res.json({
        status: "success",
        message: "Reset password successfully"
    });
});

// @desc Delete user
// @route DELETE /api/v1/users/:userid
// @access Private/Admin
const deleteUserCtrl = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.userid);
    if (user) {
        await User.updateOne({ _id: req.params.userid }, { status: 'removed' });
        res.json({
            status: "success",
            message: "User removed successfully"
        });
    }
    else {
        res.status(404);
        throw new Error('User not found');
    }
});


const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const verify = async (token) => {
    const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
    });
    return ticket.getPayload();
}

// @desc    Google login
// @route   POST /api/v1/users/auth-google
// @access  Public

const googleLoginCtrl = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if(token){
        const payload = await verify(token);
        const { email, name, picture, sub } = payload;
        console.log(payload);
        let user = await User.findOne({ email, googleId: sub });
        if(user){
            user = await User.create({
                googleId: sub,
                email: email,
                fullname: name,
                profile: {picture: picture},
                role: 'student'
            });
        }
        res.json({
            status: "success",
            message: "Login successfully",
            data: {
                user,
                token: generateToken(user._id)
            }
        });
    }else{
        res.status(400);
        throw new Error('Invalid token');
    }
});

// @desc    Refresh token
// @route   POST /api/v1/users/refresh-token
// @access  Public

function getCookieValue(cookieString, name) {
    // Tách các cookie thành mảng
    const cookieArray = cookieString.split('; ');
    
    // Tìm cookie có key là 'name'
    const cookie = cookieArray.find(cookie => cookie.startsWith(name + '='));
    
    // Trả về giá trị của cookie nếu tìm thấy, ngược lại trả về null
    return cookie ? cookie.split('=')[1] : null;
}

const refreshAccessTokenCtrl = asyncHandler(async (req, res) => {
    const cookie = req.headers.cookie;
    const refreshToken = getCookieValue(cookie, 'refreshToken');
    if (!cookie && !refreshToken) {
        const err = new Error('No cookie');
        err.statusCode = 404;
        throw err;
    }
    await jwt.verify(refreshToken, process.env.JWT_SECRET, async (error, decoded) => {
        if (error) {
            const err = new Error('Invalid refresh token, you must login again');
            err.statusCode = 403;
            throw err;
        }
        const user = await User.findById(decoded._id);
        if (!user || user.refreshToken !== refreshToken) {
            const err = new Error('User not found or invalid refresh token');
            err.statusCode = 403;
            throw err;
        }
        res.json({
            status: "success",
            message: "Refresh access token successfully",
            data: {
                success: true,
                newToken: token.generateToken(user._id)
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
        const err = new Error('No cookie, no refresh, must logout');
        err.statusCode = 401;
        throw err;
    }
    const refreshToken = cookie.split('=')[1];
    //Kiểm tra xem có cookie và refreshToken không
    if (!refreshToken) {
        const err = new Error('No cookie, no refresh, must logout');
        err.statusCode = 401;
        throw err;
    }
    //Xóa refreshToken trong db
    await User.findOneAndUpdate( {refreshToken} , { refreshToken: '' }, { new: true });
    //Xóa refreshToken trong cookie
    res.clearCookie('refreshToken');
    res.json({
        status: "success",
        message: "Logout successfully"
    });
});

export default { registerUserCtrl, loginUserCtrl, getUserProfileCtrl, updateUserCtrl, 
    forgotPasswordCtrl, resetPasswordCtrl, deleteUserCtrl, googleLoginCtrl, 
    refreshAccessTokenCtrl, logoutCtrl, verifyAccountCtrl };