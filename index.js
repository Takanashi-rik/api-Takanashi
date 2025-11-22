// index.js
const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

require("./function.js");

const app = express();
const PORT = process.env.PORT || 8080;

const TELEGRAM_BOT_TOKEN = '7623684118:AAHSPZCvzwSGzPxQFHuQBdXr_9i6bUf1n7w';
const TELEGRAM_CHAT_ID = '8062985789';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

let logBuffer = [];

// Inisialisasi stats
let serverStats = {
  totalRequests: 0,
  serverStartTime: Date.now(),
  totalEndpoints: 0,
  errorCount: 0
};

// Load stats dari file jika ada
const statsFilePath = path.join(__dirname, 'server-stats.json');
try {
  if (fs.existsSync(statsFilePath)) {
    const savedStats = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
    serverStats.totalRequests = savedStats.totalRequests || 0;
    serverStats.serverStartTime = savedStats.serverStartTime || Date.now();
    serverStats.errorCount = savedStats.errorCount || 0;
    console.log(chalk.green('✓ Stats loaded from file'));
  }
} catch (error) {
  console.log(chalk.yellow('⚠ No existing stats file, starting fresh'));
}

// Simpan stats ke file
function saveStatsToFile() {
  try {
    fs.writeFileSync(statsFilePath, JSON.stringify(serverStats, null, 2));
  } catch (error) {
    console.error('Error saving stats:', error);
  }
}

// Hitung total endpoints dari settings.json
function calculateTotalEndpoints() {
  try {
    const settingsPath = path.join(__dirname, './assets/settings.json');
    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    let total = 0;
    settings.categories.forEach(category => {
      total += category.items.length;
    });
    serverStats.totalEndpoints = total;
    return total;
  } catch (error) {
    console.error('Error calculating endpoints:', error);
    return 0;
  }
}

setInterval(() => {
  if (logBuffer.length === 0) return;

  const combinedLogs = logBuffer.join('\n');
  logBuffer = [];

  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: `\`\`\`ansi\n${combinedLogs}\n\`\`\``,
    parse_mode: 'MarkdownV2'
  };

  axios.post(TELEGRAM_API_URL, payload).catch(console.error);
}, 2000);

function queueLog({ method, status, url, duration, req, error = null }) {
  const info = req?._requestInfo || {};
  const name = info.name;
  const ip = info.ip;
  const endpoint = info.endpoint;
  const curl = `curl -X ${method} "${req.protocol}://${req.get('host')}${endpoint}"`;
  const markdownText =
`\`\`\`
Nama       : ${name}
IP         : ${ip}
Endpoint   : ${endpoint}
Status     : ${status}
Curl       : ${curl}
${error ? "Error      : " + (error.message || error) : ""}
\`\`\``;
  const plainText =
`Nama       : ${name}
IP         : ${ip}
Endpoint   : ${endpoint}
Status     : ${status}
Curl       : ${curl}
${error ? "Error      : " + (error.message || error) : ""}`;
  logBuffer.push(JSON.stringify({ markdownText, plainText }));
}


  logBuffer.push(line);
}

let requestCount = 0;
let isCooldown = false;

setInterval(() => {
  requestCount = 0;
}, 1000);

app.use((req, res, next) => {
  if (isCooldown) {
    queueLog({
      method: req.method,
      status: 503,
      url: req.originalUrl,
      duration: 0,
      error: 'Server is in cooldown'
    });
    return res.status(503).json({ error: 'Server is in cooldown, try again later.' });
  }

  requestCount++;

  if (requestCount > 10) {
    isCooldown = true;
    const cooldownTime = (Math.random() * (120000 - 60000) + 60000).toFixed(3);

    console.log(`⚠️ SPAM DETECT: Cooldown ${cooldownTime / 1000} detik`);
    
    const spamMsg = `⚠️ *SPAM DETECT* ⚠️\n\n❗ Too many requests, server cooldown for ${cooldownTime / 1000} sec!\n\n\`[${req.method}] 503 ${req.originalUrl} - 0ms\``;

    const payload = {
      chat_id: TELEGRAM_CHAT_ID,
      text: spamMsg,
      parse_mode: 'MarkdownV2'
    };

    axios.post(TELEGRAM_API_URL, payload).catch(console.error);

    setTimeout(() => {
      isCooldown = false;
      console.log('✅ Cooldown selesai, server aktif lagi');
    }, cooldownTime);

    return res.status(503).json({ error: 'Too many requests, server cooldown!' });
  }

  next();
});

app.enable("trust proxy");
app.set("json spaces", 2);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  req._requestInfo = {
    name: req.headers["x-user-name"] || req.query.name || (req.body && req.body.name) || "Unknown User",
    ip: req.ip || req.headers["x-forwarded-for"] || "Unknown IP",
    endpoint: req.originalUrl,
    method: req.method
  };
  next();
});


app.use(cors());

const settingsPath = path.join(__dirname, './assets/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
global.apikey = settings.apiSettings.apikey;

// Middleware untuk menangani request counting
app.use((req, res, next) => {
  // Increment total requests
  serverStats.totalRequests++;
  
  // Simpan ke file setiap 10 request untuk performance
  if (serverStats.totalRequests % 10 === 0) {
    saveStatsToFile();
  }

  const originalSend = res.send;
  const originalJson = res.json;
  
  res.send = function(data) {
    if (res.statusCode >= 400) {
      serverStats.errorCount++;
    }
    return originalSend.call(this, data);
  };
  
  res.json = function(data) {
    if (res.statusCode >= 400) {
      serverStats.errorCount++;
    }
    return originalJson.call(this, data);
  };
  
  next();
});

app.use((req, res, next) => {
  console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Request Route: ${req.path} `));
  global.totalreq += 1;

  const start = Date.now();
  const originalJson = res.json;

  res.json = function (data) {
    if (data && typeof data === 'object') {
      const responseData = {
        status: data.status,
        creator: settings.apiSettings.creator || "FlowFalcon",
        ...data
      };
      return originalJson.call(this, responseData);
    }
    return originalJson.call(this, data);
  };

  res.on('finish', () => {
    const duration = Date.now() - start;

    queueLog({
      method: req.method,
      status: res.statusCode,
      url: req.originalUrl,
      duration
    });

    if (res.statusCode >= 400) {
      serverStats.errorCount++;
    }
  });

  next();
});

// Endpoint untuk stats
app.get('/api/stats', (req, res) => {
  const now = Date.now();
  const uptimeMs = now - serverStats.serverStartTime;
  
  const stats = {
    totalRequests: serverStats.totalRequests,
    totalEndpoints: serverStats.totalEndpoints,
    uptime: uptimeMs,
    serverStartTime: serverStats.serverStartTime,
    errorCount: serverStats.errorCount
  };
  
  res.json(stats);
});

// Endpoint untuk reset stats (opsional, untuk development)
app.post('/api/stats/reset', (req, res) => {
  serverStats.totalRequests = 0;
  serverStats.serverStartTime = Date.now();
  serverStats.errorCount = 0;
  saveStatsToFile();
  res.json({ message: 'Stats reset successfully', stats: serverStats });
});

app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/src', (req, res) => {
  serverStats.errorCount++;
  res.status(403).json({ error: 'Forbidden access' });
});

let totalRoutes = 0;
const apiFolder = path.join(__dirname, './src/api');
fs.readdirSync(apiFolder).forEach((subfolder) => {
  const subfolderPath = path.join(apiFolder, subfolder);
  if (fs.statSync(subfolderPath).isDirectory()) {
    fs.readdirSync(subfolderPath).forEach((file) => {
      const filePath = path.join(subfolderPath, file);
      if (path.extname(file) === '.js') {
        try {
          const routeModule = require(filePath);
          
          if (typeof routeModule === 'function') {
            routeModule(app);
            totalRoutes++;
            console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` ✅ Loaded: ${path.basename(file)} `));
          } else {
            console.log(chalk.bgHex('#FF9999').hex('#333').bold(` ❌ Skipped (not a function): ${path.basename(file)} `));
          }
        } catch (error) {
          console.log(chalk.bgHex('#FF0000').hex('#FFF').bold(` 💥 ERROR: ${path.basename(file)} `));
          console.log(chalk.red(`   Error: ${error.message}`));
        }
      }
    });
  }
});

// Hitung total endpoints setelah semua route dimuat
serverStats.totalEndpoints = calculateTotalEndpoints();

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Endpoints: ${serverStats.totalEndpoints} `));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

app.use((req, res, next) => {
  serverStats.errorCount++;
  
  queueLog({
    method: req.method,
    status: 404,
    url: req.originalUrl,
    duration: 0,
    error: 'Not Found'
  });

  res.status(404).sendFile(process.cwd() + "/api-page/404.html");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  
  serverStats.errorCount++;

  queueLog({
    method: req.method,
    status: 500,
    url: req.originalUrl,
    duration: 0,
    error: err
  });

  res.status(500).sendFile(process.cwd() + "/api-page/500.html");
});

// Simpan stats saat server dimatikan
process.on('SIGINT', () => {
  console.log(chalk.yellow('⚠ Saving stats before shutdown...'));
  saveStatsToFile();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log(chalk.yellow('⚠ Saving stats before shutdown...'));
  saveStatsToFile();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Error tracking: ACTIVE `));
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Initial error count: ${serverStats.errorCount} `));
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total requests: ${serverStats.totalRequests} `));
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server start time: ${new Date(serverStats.serverStartTime).toLocaleString()} `));
  
  const startupMsg = `🚀 *Server Started* 🚀\n\n✅ Server is running on port ${PORT}\n✅ Error tracking: ACTIVE\n✅ Initial error count: ${serverStats.errorCount}\n✅ Total requests: ${serverStats.totalRequests}\n✅ Server start: ${new Date(serverStats.serverStartTime).toLocaleString()}`;
  
  const payload = {
    chat_id: TELEGRAM_CHAT_ID,
    text: startupMsg,
    parse_mode: 'MarkdownV2'
  };
  
  axios.post(TELEGRAM_API_URL, payload).catch(console.error);
});

// Simpan stats secara berkala (setiap 30 detik) untuk backup
setInterval(() => {
  saveStatsToFile();
}, 30000);

module.exports = app;
