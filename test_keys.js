require('dotenv').config();
const keys = (process.env.GEMINI_API_KEYS || '').split(',');
console.log(`Loaded ${keys.length} keys.`);
keys.forEach((k, i) => {
    console.log(`Key #${i}: ${k.trim().substring(0, 10)}... (Length: ${k.trim().length})`);
});
