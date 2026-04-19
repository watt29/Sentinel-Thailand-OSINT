const axios = require('axios');
const fs = require('fs');
const path = require('path');

const APP_ID = '1263958805236203';
const APP_SECRET = '5e7a53bc9151084ba026ed6395043eca';
const PAGE_ID = '61578195882983';

async function run() {
    console.log('🏛️ SENTINEL HQ: Master Key Exchange Operation Initiated...');
    
    const envPath = path.join(__dirname, '.env');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const userTokenMatch = envContent.match(/FACEBOOK_PAGE_ACCESS_TOKEN=(.*)/);
    
    if (!userTokenMatch) {
        console.error('❌ ไม่พบ Token ในไฟล์ .env');
        return;
    }
    
    const userToken = userTokenMatch[1].trim();

    try {
        console.log('🔄 STEP 1: Upgrading to Long-Lived User Access Token...');
        const longLivedUrl = `https://graph.facebook.com/v19.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${userToken}`;
        const authRes = await axios.get(longLivedUrl);
        const longUserToken = authRes.data.access_token;
        
        console.log('🔄 STEP 2: Extracting Permanent Page Authority...');
        const accRes = await axios.get(`https://graph.facebook.com/v19.0/me/accounts?access_token=${longUserToken}`);
        
        const sentinel = accRes.data.data.find(a => a.id === PAGE_ID);
        if (sentinel) {
            console.log('✅ CRITICAL SUCCESS! Page Token Acquired:');
            console.log(sentinel.access_token);
        } else {
            console.log('❌ ไม่พบเพจ Sentinel Thailand ในกุญแจนี้');
            console.log('เพจที่เข้าถึงได้: ' + accRes.data.data.map(a => a.name).join(', '));
        }
    } catch (e) {
        console.error('❌ SYSTEM ERROR:', e.response ? e.response.data : e.message);
    }
}

run();
