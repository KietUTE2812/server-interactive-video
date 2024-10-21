import jwt from "jsonwebtoken"

const generateToken = (_id) => {
    const stringId = _id.toString();
    return jwt.sign({ _id: stringId }, process.env.JWT_SECRET, { expiresIn: "15m" })
}
const generateRefreshToken = (_id) => {
    return jwt.sign({ _id }, process.env.JWT_SECRET, { expiresIn: "3d" })
}
export default { generateToken, generateRefreshToken }