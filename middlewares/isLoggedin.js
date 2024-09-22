import { getTokenFromHeader } from "../utils/getTokenFromHeader.js"
import { verifyToken } from "../utils/verifyToken.js";

export const isLoggedin = (req, res, next) => {
    //get token from header
    const token = getTokenFromHeader(req);
    //verift the token
    const decodedUser = verifyToken(token);
    //save the user into req obj
    if (!decodedUser) {
        throw new Error("Invalid/Expired Token, please login again");
    }
    else {
        req.userAuthId = decodedUser?.id;
        next();
    }

}