import { AssemblyAI } from "assemblyai";
import dotenv from "dotenv";

dotenv.config();
const assemblyAI = new AssemblyAI({ apiKey: `${process.env.ASSEMBLYAI_API_KEY}` });

const audioUrl = `${process.env.NGROK_URL}/${process.env.MINIO_BUCKET_NAME}/MasterData_APIsInJavaScript.mp3`;

console.log("Audio URL:", audioUrl);
const config = {
    audio_url: "https://assembly.ai/sports_injuries.mp3"
}

const run = async () => {
    const transcript = await assemblyAI.transcripts.transcribe(config)
    console.log(transcript)

}
run().catch((error) => {
    console.error("Error:", error);
});