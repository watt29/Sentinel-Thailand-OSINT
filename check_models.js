/**
 * check_models.js
 * ตรวจสอบสิทธิ์ของบัตร (API Key) ว่าใช้รุ่นไหนได้บ้าง
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

async function check() {
  const key = (process.env.GEMINI_API_KEY || '').trim();
  if (!key) {
    console.log("Error: ไม่พบ GEMINI_API_KEY ใน .env");
    return;
  }

  console.log("🔍 กำลังตรวจสอบรายชื่อโมเดลที่คุณเข้าถึงได้...");
  
  try {
    const genAI = new GoogleGenerativeAI(key);
    // ใช้ REST API เพราะ SDK บางรุ่นไม่มีคำสั่ง ListModels ที่ใช้ง่าย
    const axios = require('axios');
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`;
    const res = await axios.get(url);
    
    console.log("\n✅ โมเดลที่คุณใช้งานได้คิอ:");
    res.data.models.forEach(m => {
      console.log(`- ${m.name.replace('models/', '')} (${m.displayNames || 'Standard'})`);
    });
    console.log("\nลองนำชื่อโมเดลด้านบนไปใส่ใน AIScanner.js ได้เลยครับ");
  } catch (e) {
    console.log("❌ ไม่สามารถดึงข้อมูลได้: " + e.message);
  }
}

check();
