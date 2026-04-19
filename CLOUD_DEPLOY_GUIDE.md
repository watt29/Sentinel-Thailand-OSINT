# ☁️ Cloud Deployment Guide: sentinel-hq-cloud
This document outlines the steps to deploy and run the Sentinel Thailand OSINT Engine on your Google Cloud VM.

## 1. Prerequisites on VM
Ensure the following are installed on your cloud instance:
*   **Node.js (v18+):** `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`
*   **PM2:** `sudo npm install pm2 -g`
*   **Git:** `sudo apt-get install git`

## 2. Synchronization
Upload your project files to the VM (e.g., using `scp`, `rsync`, or Git).
If using Git:
```bash
git clone [YOUR_REPO_URL]
cd Paperclip-AI-Trading
npm install
```

## 3. Environment Configuration
Create a `.env` file on the VM with all required keys:
```bash
nano .env
# Paste your keys (GEMINI_API_KEYS, GROQ_API_KEYS, FACEBOOK_PAGE_ACCESS_TOKEN, etc.)
```

## 4. Launching the System (Managed by PM2)
We have prepared a `ecosystem.config.js` for stable operation.

### Start all services:
```bash
pm2 start ecosystem.config.js
```

### Useful Management Commands:
*   **Monitor in real-time:** `pm2 monit`
*   **View Logs:** `pm2 logs`
*   **Check Status:** `pm2 list`
*   **Stop All:** `pm2 stop all`
*   **Restart All:** `pm2 restart all`

## 5. Persistence
To ensure Sentinel starts automatically if the VM restarts:
```bash
pm2 save
pm2 startup
# Then copy and paste the command provided by the terminal
```

## 6. Port Forwarding (GCP)
Ensure the GCP Firewall allows traffic on the required ports:
*   **Dashboard/Terminal:** (e.g., Port 3000)
*   **LINE Webhook:** (e.g., Port 3000)

---
*Sentinel Thailand Governance Center - Deployment Protocol*
