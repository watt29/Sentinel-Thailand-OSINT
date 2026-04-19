# 🛰️ Sentinel Thailand: Sovereign OSINT Engine
### [Intelligence Automation Platform - Enterprise Edition 2026]

**Sentinel Thailand** is a state-of-the-art Autonomous Open Source Intelligence (OSINT) platform. It is engineered for high-fidelity news analysis, strategic content generation, and multi-channel publication without human intervention. The system operates on a **Triple-LLM Collaborative Architecture**, ensuring hallucination-free output and professional-grade reporting.

---

## 🏛️ System Architecture: The "Intelligence Office"
The system replicates a professional newsroom through a hierarchy of AI departments working in sequence:

### 1. 🔍 RECON Department (Scouting)
*   **Engine:** Groq Llama 3.1 / 70B
*   **Role:** Scans 20+ Global & Thai RSS feeds including AP News, Reuters, Al Jazeera, BBC, and local powerhouses like The Standard.
*   **Logic:** Filters 40+ raw headlines into 3 high-impact candidates based on the current **Content Strategy Mode**.

### 2. ✍️ WRITER Department (Drafting)
*   **Engine:** Gemini 2.5 Flash (API Key Pooling)
*   **Role:** Transforms raw facts into sophisticated Thai drafts.
*   **Adaptability:** Switches tone based on 3 modes: `DEEP_INTEL`, `QUICK_SHARE`, and `SYSTEM_BRANDING`.

### 3. 🛡️ EDITOR Department (Refining & Fact-Check)
*   **Engine:** Groq 70B
*   **Role:** Polishes drafts into "High-Fidelity" intelligence briefs.
*   **Tasks:** Ensures authoritative tone, removes AI artifacts, adds Exactly 8 strategic hashtags, and verifies cultural relevance.

---

## 📊 Content Strategy: The 70/20/10 Governance
Sentinel follows global standards for audience engagement and authority building:

| Ratio | Mode | Description | Objective |
| :--- | :--- | :--- | :--- |
| **70%** | **DEEP_INTEL** | In-depth analysis and global impact reports. | Provide Value & Authority |
| **20%** | **QUICK_SHARE** | Breaking news and rapid updates. | High Speed & Visibility |
| **10%** | **SYSTEM_BRANDING** | Self-promotional content / AI updates. | Trust & Identity |

---

## 🛠️ Key Technical Features
*   **🛡️ Hallucination-Free Logic:** Implements "Sovereign Armored" checks to prevent AI from generating fictional events (e.g., Border check logic).
*   **🧠 Intelligent Memory:** Uses `intelligence_memory.db` (SQLite) and keyword-overlap deduplication to prevent posting redundant news within short cycles.
*   **🖼️ Visual Integrity:** **"No Real Image, No Post"** policy. Scrapes `og:image` and `media:content` directly from source articles to ensure authenticity.
*   **📡 Multi-Channel Distribution:**
    *   **Facebook:** Automated photo posts with long-form captions.
    *   **Telegram:** Real-time Audit logs and Critical Briefings.
    *   **LINE:** System status monitoring and on-demand Market Analysis.
*   **🔑 API Resiliency:** Dynamic API Key rotation for Gemini and Groq to bypass rate limits (`429 Too Many Requests`).

---

## 📂 Project Structure
```text
📦 Sentinel-Thailand
 ┣ 📂 Strategy-Engine
 ┃ ┣ 📜 AIScanner.js            # Triple-LLM Logic & API Pooling
 ┃ ┣ 📜 FacebookPublisher.js    # Facebook Graph API Connector
 ┃ ┣ 📜 TelegramNotifier.js     # Audit & Alert System
 ┃ ┗ 📜 IntelligenceStorage.js  # SQLite Memory Manager
 ┣ 📂 System-Functions
 ┃ ┣ 📜 Logger.js               # Enterprise Winston Logging
 ┃ ┣ 📜 Database.js             # Core DB Operations
 ┃ ┣ 📜 LineProvider.js         # LINE Messaging Integration
 ┃ ┗ 📜 SheetLogger.js          # Google Sheets Data Archiving
 ┣ 📜 Scan-Global-News.js       # The "Governor" (Main Loop)
 ┣ 📜 Start-Bot.js              # LINE Webhook & Dashboard API
 ┗ 📜 .env                      # Intelligence Configuration
```

---

## 🚀 Operational Workflow
1.  **HEARTBEAT:** The system triggers every `SCAN_INTERVAL_MINUTES` (Default: 10-15 mins).
2.  **SCOUT:** RECON scans global feeds.
3.  **AUDIT:** Checks database for news redundancy.
4.  **ANALYZE:** Triple-LLM pipeline generates the draft.
5.  **EXECUTE:** 
    *   Posts to **Facebook** Page if an image exists.
    *   Logs the success/fail to **Telegram Audit**.
    *   Archives the data to **Google Sheets** and **Local SQLite**.

---

## ⚙️ Requirements & Set-up
*   **Node.js:** v18+
*   **API Keys Required:**
    *   `GEMINI_API_KEYS`: (Support Multiple, Comma-separated)
    *   `GROQ_API_KEYS`: (Support Multiple, Comma-separated)
    *   `FACEBOOK_PAGE_TOKEN` & `PAGE_ID`
    *   `TELEGRAM_BOT_TOKEN` & `CHAT_ID`
    *   `LINE_CHANNEL_ACCESS_TOKEN` & `SECRET`

---

## 🛡️ Governance Statement
> "In an era of information warfare, accuracy is the only weapon that matters. Sentinel Thailand stands as a digital vanguard, ensuring that intelligence remains sovereign, factual, and actionable."
>
> — **Sentinel Thailand Governance Center**
