/**
 * FacebookPublisher.js
 * Sovereign-Automation Suite [2026]
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Error codes ที่ Facebook ส่งมาเมื่อ token หมดอายุหรือไม่ถูกต้อง
const TOKEN_EXPIRED_CODES = [190, 102, 467, 463, 460];

class FacebookPublisher {
  constructor() {
    this._loadToken();
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.isEnabled = !!(this.accessToken && this.pageId);
    this.tokenExpired = false;
  }

  _loadToken() {
    // โหลด token ใหม่จาก .env ทุกครั้งที่เรียก (รองรับการ restart pm2 หรือ update .env)
    const envPath = process.env.ENV_PATH || path.resolve(__dirname, '../.env');
    try {
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const match = content.match(/^FACEBOOK_PAGE_ACCESS_TOKEN=(.+)$/m);
        if (match) this.accessToken = match[1].trim();
        else this.accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
      }
    } catch (e) {
      this.accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    }
  }

  _isTokenError(errorCode) {
    return TOKEN_EXPIRED_CODES.includes(errorCode);
  }

  async _handleTokenExpiry(errMsg) {
    if (!this.tokenExpired) {
      this.tokenExpired = true;
      console.error(`   [SOCIAL] ❌ Facebook Token หมดอายุหรือไม่ถูกต้อง: ${errMsg}`);
      // แจ้ง Telegram อัตโนมัติ
      try {
        const notifier = require('./TelegramNotifier');
        await notifier.sendMessage(
          `🔑 <b>[SENTINEL ALERT] Facebook Token หมดอายุ!</b>\n` +
          `━━━━━━━━━━━━━━━━━━\n` +
          `❌ Error: ${errMsg}\n\n` +
          `<b>วิธีแก้ไข (Auto-Refresh):</b>\n` +
          `1. ไปที่ Facebook Developers → รับ Short-lived User Token ใหม่\n` +
          `2. รันคำสั่งบน Server:\n` +
          `<code>node LongLivedTokenGenerator.js &lt;SHORT_TOKEN&gt;</code>\n` +
          `3. <code>pm2 restart all</code>\n\n` +
          `ระบบจะหยุดโพสต์ Facebook ชั่วคราวจนกว่าจะอัปเดต Token`
        );
      } catch (e) { /* silent */ }
    }
  }

  async publish(message) {
    if (!this.isEnabled || this.tokenExpired) {
      return { success: false, error: this.tokenExpired ? 'TOKEN_EXPIRED' : 'DISABLED' };
    }

    try {
      const url = `https://graph.facebook.com/v19.0/me/feed`;
      const response = await axios.post(url, {
        message: message,
        published: true,
        access_token: this.accessToken
      });

      if (response.data && response.data.id) {
        console.log(`   [SOCIAL] ✅ Post Successfully Published! ID: ${response.data.id}`);
        return { success: true, postId: response.data.id };
      }
      return { success: false, error: 'UNKNOWN_RESPONSE' };
    } catch (e) {
      const errCode = e.response?.data?.error?.code;
      const errMsg = e.response?.data?.error?.message || e.message;
      if (this._isTokenError(errCode)) await this._handleTokenExpiry(errMsg);
      return { success: false, error: errMsg };
    }
  }

  async _isImageAccessible(imageUrl) {
    try {
      const res = await axios.head(imageUrl, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0' } });
      const ct = res.headers['content-type'] || '';
      return res.status === 200 && ct.startsWith('image/');
    } catch (e) { return false; }
  }

  async postPhotoWithCaption(imageUrl, message) {
    if (!this.isEnabled || this.tokenExpired) {
      return { success: false, error: this.tokenExpired ? 'TOKEN_EXPIRED' : 'DISABLED' };
    }

    // ตรวจสอบ URL รูปก่อนส่งให้ Facebook
    const accessible = await this._isImageAccessible(imageUrl);
    if (!accessible) {
      console.log(`   [SOCIAL] ⚠️ Image URL ไม่สามารถเข้าถึงได้ — โพสต์เป็น text แทน`);
      return this.publish(message);
    }

    try {
      const url = `https://graph.facebook.com/v19.0/me/photos`;
      const response = await axios.post(url, {
        url: imageUrl,
        caption: message,
        access_token: this.accessToken
      });

      if (response.data && response.data.id) {
        console.log(`   [SOCIAL] 🖼️ Photo Successfully Published! ID: ${response.data.id}`);
        return { success: true, postId: response.data.id };
      }
      return { success: false, error: 'UNKNOWN_RESPONSE' };
    } catch (e) {
      const errCode = e.response?.data?.error?.code;
      const errMsg = e.response?.data?.error?.message || e.message;
      if (this._isTokenError(errCode)) await this._handleTokenExpiry(errMsg);
      console.log(`   [SOCIAL] ❌ Facebook Photo API Error: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }

  /**
   * ตรวจสอบอายุ token ที่เหลืออยู่ผ่าน Facebook Debug API
   * คืนค่า { valid, expiresAt, daysLeft } หรือ null ถ้าเช็คไม่ได้
   */
  async checkTokenHealth() {
    const appId = process.env.FACEBOOK_APP_ID;
    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appId || !appSecret || !this.accessToken) return null;

    try {
      const url = `https://graph.facebook.com/debug_token?input_token=${this.accessToken}&access_token=${appId}|${appSecret}`;
      const res = await axios.get(url);
      const data = res.data.data;
      // expires_at = 0 หมายถึง Page token แบบถาวร (never expires)
      const isPermanent = !data.expires_at || data.expires_at === 0;
      const expiresAt = isPermanent ? null : new Date(data.expires_at * 1000);
      const daysLeft = isPermanent ? Infinity : Math.ceil((expiresAt - Date.now()) / 86400000);
      return { valid: data.is_valid, expiresAt, daysLeft, isPermanent };
    } catch (e) {
      return null;
    }
  }
}

module.exports = new FacebookPublisher();
