const axios = require('axios');
const fs = require('fs');
const path = require('path');

// ดึง Token จากไฟล์ .env โดยตรง
const envPath = path.join(__dirname, '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const userTokenMatch = envContent.match(/FACEBOOK_PAGE_ACCESS_TOKEN=(.*)/);

if (!userTokenMatch) {
    console.error('❌ ไม่พบ FACEBOOK_PAGE_ACCESS_TOKEN ในไฟล์ .env');
    process.exit(1);
}

const userToken = userTokenMatch[1].trim();
const PAGE_ID = '713991985132270';

async function fetchPageToken() {
    console.log('🛰️ SENTINEL SYSTEM: Requesting Page Authority Token...');
    try {
        const url = `https://graph.facebook.com/v19.0/me/accounts?access_token=${userToken}`;
        const response = await axios.get(url);
        
        const accounts = response.data.data;
        const sentinelAccount = accounts.find(acc => acc.id === PAGE_ID);
        
        if (sentinelAccount) {
            console.log('✅ SUCCESS! FOUND SENTINEL PAGE TOKEN:');
            console.log(sentinelAccount.access_token);
        } else {
            console.log('❌ ไม่พบเพจ ID: ' + PAGE_ID + ' ในสิทธิ์ของกุญแจนี้');
            console.log('เพจที่กุญแจนี้เข้าถึงได้: ' + accounts.map(a => `${a.name} (${a.id})`).join(', '));
        }
    } catch (error) {
        console.error('❌ API ERROR:', error.response ? error.response.data : error.message);
    }
}

fetchPageToken();
