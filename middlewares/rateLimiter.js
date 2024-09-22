import { Client } from "../app/app.js";
import dotenv from "dotenv";
dotenv.config();

const MAXREQUESTS = process.env.MAXREQUESTS || 5;
const TIMEOUT = process.env.TIMEOUT || 50;
export const rateLimiter = async (req, res, next) => {

    const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress);
    const key = `rateLimiter:${ip}`;
    const currentRequest = await Client.get(key);

    if (currentRequest >= MAXREQUESTS) {
        const ttl = await Client.ttl(key);
        return res.status(429).json({
            status: "error",
            ttl: ttl,
            message: "Too many requests, please try again later"
        })
    } else {
        await Client.set(key, currentRequest ? parseInt(currentRequest) + 1 : 1, 'EX', TIMEOUT);
        next();
    }
}