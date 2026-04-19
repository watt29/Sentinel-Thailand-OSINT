const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('./Logger');

class Guardian {
    constructor() {
        this.backupDir = path.join(__dirname, '../backups');
        if (!fs.existsSync(this.backupDir)) fs.mkdirSync(this.backupDir, { recursive: true });
    }

    /**
     * Atomic Write: เขียนแบบปลอดภัยสูงสุด
     * 1. เขียนลงไฟล์ชั่วคราว (.tmp)
     * 2. ตรวจสอบความถูกต้อง (Checksum)
     * 3. เปลี่ยนชื่อทับไฟล์จริง (Rename)
     */
    async atomicWrite(filePath, data) {
        const tempPath = `${filePath}.tmp`;
        try {
            const content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            const hash = crypto.createHash('md5').update(content).digest('hex');
            
            // 1. เขียนไฟล์ Temp
            fs.writeFileSync(tempPath, content);
            
            // 2. ตรวจสอบ Integrity หลังเขียนทันที
            const verifyContent = fs.readFileSync(tempPath, 'utf8');
            const verifyHash = crypto.createHash('md5').update(verifyContent).digest('hex');
            
            if (hash !== verifyHash) {
                throw new Error("Data Integrity Check Failed: Checksum mismatch during write.");
            }

            // 3. เปลี่ยนชื่อทับ (Atomic Operation)
            fs.renameSync(tempPath, filePath);
            return true;
        } catch (e) {
            logger.error({ event: 'atomic_write_failed', path: filePath, error: e.message });
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            return false;
        }
    }

    /**
     * Backup Manager: ทำสำเนาย้อนหลัง 3 เวอร์ชัน
     */
    createBackup(sourcePath) {
        if (!fs.existsSync(sourcePath)) return;
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = path.basename(sourcePath);
        const backupPath = path.join(this.backupDir, `${filename}.${timestamp}.bak`);
        
        try {
            fs.copyFileSync(sourcePath, backupPath);
            this.rotateBackups(filename);
            logger.info({ event: 'backup_created', source: filename });
        } catch (e) {
            logger.error({ event: 'backup_failed', error: e.message });
        }
    }

    rotateBackups(filename) {
        const files = fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith(filename))
            .map(f => ({ name: f, time: fs.statSync(path.join(this.backupDir, f)).mtime }))
            .sort((a, b) => b.time - a.time);

        if (files.length > 3) {
            files.slice(3).forEach(f => {
                const p = path.join(this.backupDir, f.name);
                fs.unlinkSync(p);
                logger.debug({ event: 'backup_rotated', deleted: f.name });
            });
        }
    }
}

module.exports = new Guardian();
