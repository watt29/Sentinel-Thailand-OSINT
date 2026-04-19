const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.DASHBOARD_PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, './')));

// Proxy endpoint for Binance Price (Node.js fetching)
app.get('/api/price/:symbol', async (req, res) => {
  const { symbol } = req.params;
  try {
    const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch price from Binance' });
  }
});

app.listen(PORT, () => {
  console.log(`\n🚀 Sentinel Thailand Intelligence Dashboard is running!`);
  console.log(`🔗 Local Interface: http://localhost:${PORT}`);
  console.log(`📡 Intelligence Proxy: Enabled\n`);
});
