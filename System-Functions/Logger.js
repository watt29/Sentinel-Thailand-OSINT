const winston = require('winston');
const path = require('path');

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json() // ผลลัพธ์เป็น JSON สำหรับ Production
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
                    const msg = typeof message === 'object' ? JSON.stringify(message) : message;
                    return `[${timestamp}] ${level}: ${msg} ${metaStr}`;
                })
            )
        }),
        new winston.transports.File({ 
            filename: path.join(__dirname, '../logs/system.json'),
            maxsize: 10 * 1024 * 1024, // 10MB
            maxFiles: 5
        })
    ]
});

module.exports = logger;
