import mongoose from "mongoose";
const dbConnect = async () => {
    try {
        mongoose.set("strictQuery", false);
        console.log(process.env.MONGODB_URI)
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB connected: ${(await conn).connection.host}`);

    } catch (error) {
        console.log(`Error: ${error.message}`);
        process.exit(1);
    }
}

export default dbConnect 