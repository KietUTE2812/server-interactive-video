import jwt from "jsonwebtoken"

const generateToken = ({_id, role}) => {
    const stringId = _id.toString();
    return jwt.sign({ _id: stringId, role: role }, process.env.JWT_SECRET, { expiresIn: "1d" })
}
const generateRefreshToken = (_id) => {
    return jwt.sign({ _id }, process.env.JWT_SECRET, { expiresIn: "3d" })
}
export default { generateToken, generateRefreshToken }