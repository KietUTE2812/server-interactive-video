import asyncHandler from "express-async-handler"
import {getTokenFromHeader} from "./getTokenFromHeader.js"
import jwt from "jsonwebtoken"
export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        return decoded;
    } catch (error) {
        console.error("Error verifying token:", error);
        return undefined;
    }
}
