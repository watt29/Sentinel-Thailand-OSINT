const line = require('@line/bot-sdk');
const logger = require('./Logger');

/**
 * LineProvider - The communication bridge for the Zero-Human Company.
 * Handles Messaging API interactions and Webhook events.
 */
class LineProvider {
    constructor() {
        this.config = {
            channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
            channelSecret: process.env.LINE_CHANNEL_SECRET
        };
        
        if (this.config.channelAccessToken && this.config.channelSecret) {
            this.client = new line.messagingApi.MessagingApiClient({
                channelAccessToken: this.config.channelAccessToken
            });
            this.middleware = line.middleware(this.config);
        } else {
            logger.warn("LineProvider: Missing LINE configuration in .env - Webhook will not verify signatures.");
            this.middleware = (req, res, next) => next();
        }
    }

    /**
     * ส่งข้อความกลับหาผู้ใช้ (Reply)
     */
    async reply(replyToken, messages) {
        if (!this.client) return;
        try {
            // หากส่งมาเป็น string ให้แปลงเป็น text message object
            const payload = typeof messages === 'string' 
                ? [{ type: 'text', text: messages }] 
                : (Array.isArray(messages) ? messages : [messages]);

            await this.client.replyMessage({
                replyToken: replyToken,
                messages: payload
            });
        } catch (e) {
            logger.error({ event: 'line_reply_failed', error: e.message });
        }
    }

    /**
     * ส่งข้อความประกาศ (Push Notification) ถึงบอร์ดบริหาร
     */
    async push(userId, messages) {
        if (!this.client) return;
        try {
            const payload = typeof messages === 'string' 
                ? [{ type: 'text', text: messages }] 
                : (Array.isArray(messages) ? messages : [messages]);

            await this.client.pushMessage({
                to: userId,
                messages: payload
            });
        } catch (e) {
            logger.error({ event: 'line_push_failed', error: e.message });
        }
    }

    /**
     * 🖼️ [Rich Image Support] : ส่งรูปภาพขนาดใหญ่ที่คลิกได้
     */
    async sendRichImage(userId, imageUrl, linkUrl, altText = "พบดีลทองคำใหม่ค๊าาา! ✨") {
        const message = {
            type: "imagemap",
            baseUrl: imageUrl,
            altText: altText,
            baseSize: { width: 1040, height: 1040 },
            actions: [
                {
                    type: "uri",
                    linkUri: linkUrl,
                    area: { x: 0, y: 0, width: 1040, height: 1040 }
                }
            ]
        };
        return await this.push(userId, [message]);
    }

    /**
     * 🏠 [Location Support] : ส่งพิกัดสถานที่
     */
    async sendLocation(userId, title, address, lat, lon) {
        const message = {
            type: "location",
            title: title,
            address: address,
            latitude: lat,
            longitude: lon
        };
        return await this.push(userId, [message]);
    }
}

module.exports = new LineProvider();
