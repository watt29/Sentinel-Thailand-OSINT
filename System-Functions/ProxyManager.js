const fs = require('fs');
const path = require('path');
const logger = require('./Logger');

/**
 * ProxyManager: จัดการ IP Rotation แบบ Session-based
 * รองรับฟอร์แมต http://user:pass@ip:port
 */
class ProxyManager {
    constructor() {
        this.proxies = [];
        this.currentIndex = 0;
        this.loadProxies();
    }

    loadProxies() {
        const envProxies = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : [];
        if (envProxies.length > 0) {
            this.proxies = envProxies.map(p => p.trim()).filter(Boolean);
        } else {
            const proxyFile = path.join(__dirname, '../proxies.txt');
            if (fs.existsSync(proxyFile)) {
                this.proxies = fs.readFileSync(proxyFile, 'utf8').split('\n').map(p => p.trim()).filter(Boolean);
            }
        }

        if (this.proxies.length > 0) {
            logger.info(`ProxyManager: Loaded ${this.proxies.length} proxies for rotation.`);
        } else {
            logger.warn(`ProxyManager: No proxies configured. System will run on DIRECT IP (High Risk).`);
        }
    }

    getNextProxy() {
        if (this.proxies.length === 0) return null;
        
        const proxyStr = this.proxies[this.currentIndex];
        this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
        
        try {
            // รองรับฟอร์แมต: ip:port:user:pass หรือ http://user:pass@ip:port
            let server, username, password;

            if (proxyStr.includes('@')) {
                const url = new URL(proxyStr.startsWith('http') ? proxyStr : `http://${proxyStr}`);
                server = `${url.protocol}//${url.hostname}:${url.port}`;
                username = url.username ? decodeURIComponent(url.username) : null;
                password = url.password ? decodeURIComponent(url.password) : null;
            } else {
                const parts = proxyStr.split(':');
                if (parts.length === 4) {
                    server = `http://${parts[0]}:${parts[1]}`;
                    username = parts[2];
                    password = parts[3];
                } else if (parts.length === 2) {
                    server = `http://${parts[0]}:${parts[1]}`;
                } else {
                    throw new Error("Unknown proxy format");
                }
            }

            return { server, username, password };
        } catch (e) {
            logger.error(`ProxyManager: Failed to parse proxy config - ${proxyStr}`);
            return null;
        }
    }
}

module.exports = new ProxyManager();
