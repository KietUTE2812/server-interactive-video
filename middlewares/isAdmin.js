import User from "../model/User.js";

const isAdmin = async (req, res, next) => {

    //find user from db
    const user = await User.findById(req.userAuthId);

    //check if user is admin
    if (user.isAdmin) {
        next();
    } else {
        next(new Error("Access denied, admin only"));
    }
}
export default isAdmin