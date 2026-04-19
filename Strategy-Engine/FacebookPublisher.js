/**
 * FacebookPublisher.js
 * Sovereign-Automation Suite [2026]
 */
const axios = require('axios');
require('dotenv').config();

class FacebookPublisher {
  constructor() {
    this.accessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
    this.pageId = process.env.FACEBOOK_PAGE_ID;
    this.isEnabled = !!(this.accessToken && this.pageId);
  }

  async publish(message) {
    if (!this.isEnabled) {
      // console.log("   [SOCIAL] Facebook Auto-Post is disabled. Missing Tokens.");
      return { success: false, error: 'DISABLED' };
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
      const errMsg = e.response?.data?.error?.message || e.message;
      return { success: false, error: errMsg };
    }
  }

  async postPhotoWithCaption(imageUrl, message) {
    if (!this.isEnabled) return { success: false, error: 'DISABLED' };

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
      const errMsg = e.response?.data?.error?.message || e.message;
      console.log(`   [SOCIAL] ❌ Facebook Photo API Error: ${errMsg}`);
      return { success: false, error: errMsg };
    }
  }
}

module.exports = new FacebookPublisher();
