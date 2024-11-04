import User from "../models/User.js";

const isAdmin = async (req, res, next) => {
    //find user from db
    const user = await User.findById(req.query.userId || req.params.userid);
    if(!user)
        next(new Error("User not found"));
    //check if user is admin
    else if (user?.isAdmin) {
        next();
    } else {
        next(new Error("Access denied, admin only"));
    }
}
export default isAdmin