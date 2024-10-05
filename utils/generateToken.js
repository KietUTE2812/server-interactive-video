import jwt from "jsonwebtoken"

const generateToken = (_id) => {
    return jwt.sign({ _id }, process.env.JWT_SECRET, { expiresIn: "15m" })
}
const generateRefreshToken = (_id) => {
    return jwt.sign({ _id }, process.env.JWT_SECRET, { expiresIn: "1d" })
}
export default { generateToken, generateRefreshToken }