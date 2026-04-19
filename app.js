// Sentinel Thailand Command Center UI Logic
document.addEventListener('DOMContentLoaded', () => {
    initDashboard();
});

const initDashboard = () => {
    updateRiskGauge(50); // Default Risk
    fetchLatestIntel();
    
    // Auto refresh every 5 minutes
    setInterval(fetchLatestIntel, 300000);
};

// --- Update UI Components ---

const updateRiskGauge = (val) => {
    const gauge = document.getElementById('risk-gauge');
    const display = document.getElementById('risk-val');
    
    // Map 0-100 to rotation degree (approx 45 to 225)
    const deg = 45 + (val * 1.8);
    gauge.style.transform = `rotate(${deg}deg)`;
    display.innerText = `${val}%`;
    
    // Change color based on risk
    if (val > 75) display.style.color = '#ef4444';
    else if (val > 40) display.style.color = '#f59e0b';
    else display.style.color = '#22d3ee';
};

const fetchLatestIntel = async () => {
    const feedContainer = document.getElementById('intel-feed');
    const loading = document.getElementById('loading-spinner');

    try {
        // ในสถานการณ์จริง เราจะยิงไปที่ Local API ของเรา
        // แต่เพื่อความเสถียรตอนนี้ ผมจะจำลองการดึงข้อมูลจากโครงสร้างที่เรามี
        
        // สำหรับตอนนี้ผมจะใส่ข้อมูล "พิกัดสถานการณ์จริง" เพื่อให้หน้าจอไม่ว่างครับ
        const mockIntel = [
            {
                type: "DEEP_INTEL",
                time: "14:18 | 19 APR 2026",
                title: "เม็กซิโก-สเปน-บราซิล จับมือปกป้องอธิปไตยคิวบา",
                image: "https://www.aljazeera.com/wp-content/uploads/2024/04/2024-04-18T203117Z_1603953724_RC2C97AOTN32_RTRMADP_3_CUBA-USA.jpg",
                content: "การรวมกลุ่มกันของสามชาติใหญ่ในภูมิภาคลาตินอเมริกาและยุโรป เพื่อแสดงจุดยืนคัดค้านการกดดันทางเศรษฐกิจต่อคิวบา สะท้อนถึงการเปลี่ยนแปลงดุลอำนาจ (Power Shift) ในภูมิภาค..."
            },
            {
                type: "QUICK_SHARE",
                time: "13:45 | 19 APR 2026",
                title: "ศรชล. สกัดจับน้ำมันเถื่อน 3 แสนลิตร น่านน้ำไทย",
                image: "https://ภาพข่าวรัฐบาล.com/oil-seized.jpg",
                content: "ปฏิบัติการสายฟ้าแลบภายใต้นโยบายรัฐบาล สกัดกั้นขบวนการทำลายเศรษฐกิจชาติ ยึดของกลางปริมาณมหาศาล..."
            }
        ];

        renderIntel(mockIntel);
        if (loading) loading.style.display = 'none';

    } catch (err) {
        console.error("Dashboard Fetch Error:", err);
    }
};

const renderIntel = (items) => {
    const feedContainer = document.getElementById('intel-feed');
    // Clear old except header
    const header = feedContainer.querySelector('.feed-header');
    feedContainer.innerHTML = '';
    feedContainer.appendChild(header);

    items.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card intel-card';
        card.innerHTML = `
            <div class="intel-meta">
                <span class="tag-deep">${item.type}</span>
                <span class="tag-time">${item.time}</span>
            </div>
            ${item.image ? `<img src="${item.image}" class="intel-image" onerror="this.src='https://via.placeholder.com/800x400/0f172a/22d3ee?text=SENTINEL+INTEL+IMAGE'">` : ''}
            <h2 class="intel-title">${item.title}</h2>
            <div class="intel-content">${item.content}</div>
        `;
        feedContainer.appendChild(card);
    });
};
