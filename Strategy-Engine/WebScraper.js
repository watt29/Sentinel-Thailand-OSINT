/**
 * WebScraper.js
 * ทำหน้าที่เป็น MCP Fetch จำลอง: เจาะลึกเข้าไปอ่านเนื้อหาในหน้าเว็บ
 */
const axios = require('axios');
const cheerio = require('cheerio');

class WebScraper {
  /**
   * ขุดเนื้อหาจาก URL (Scrape Text Content)
   */
  async fetchFullContent(url) {
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        },
        timeout: 10000
      });

      const $ = cheerio.load(response.data);
      
      // ลบแท็กที่ไม่จำเป็นออก
      $('script, style, nav, footer, header').remove();

      // ดึงข้อความจาก body
      let text = $('body').text();
      
      // ล้างช่องว่างและจำกัดความยาวเพื่อประหยัด Token
      text = text.replace(/\s\s+/g, ' ').substring(0, 5000); 
      
      return text;
    } catch (e) {
      return `[Error fetching content: ${e.message}]`;
    }
  }
}

module.exports = new WebScraper();
