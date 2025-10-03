const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

require("./function.js");

const app = express();
const PORT = process.env.PORT || 8080;

// Konfigurasi Telegram Bot
const TELEGRAM_BOT_TOKEN = '7623684118:AAHSPZCvzwSGzPxQFHuQBdXr_9i6bUf1n7w';
const TELEGRAM_CHAT_ID = '8062985789';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

// Buffer untuk batch log
let logBuffer = [];

// Kirim batch log ke Telegram tiap 2 detik
setInterval(() => {
    if (logBuffer.length === 0) return;

    const combinedLogs = logBuffer.join('\n');
    logBuffer = [];

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: `\`\`\`\n${combinedLogs}\n\`\`\``,
        parse_mode: 'MarkdownV2'
    };

    axios.post(TELEGRAM_API_URL, payload).catch(error => {
        console.error('Error sending to Telegram:', error.message);
    });
}, 2000);

// Function log queue
function queueLog({ method, status, url, duration, error = null }) {
    let statusText;
    if (status >= 500) statusText = 'ERROR';
    else if (status >= 400) statusText = 'CLIENT_ERROR';
    else if (status === 304) statusText = 'NOT_MODIFIED';
    else statusText = 'SUCCESS';

    let line = `[${method}] ${status} ${statusText} ${url} - ${duration}ms`;

    if (error) {
        line += `\n[ERROR] ${error.message || error}`;
    }

    logBuffer.push(line);
}

// Cooldown vars
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
        
        const spamMsg = `⚠️ SPAM DETECT ⚠️\n\n[!] Too many requests, server cooldown for ${cooldownTime / 1000} sec!\n\n[${req.method}] 503 ${req.originalUrl} - 0ms`;

        const payload = {
            chat_id: TELEGRAM_CHAT_ID,
            text: `\`\`\`\n${spamMsg}\n\`\`\``,
            parse_mode: 'MarkdownV2'
        };

        axios.post(TELEGRAM_API_URL, payload).catch(error => {
            console.error('Error sending spam alert to Telegram:', error.message);
        });

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
app.use(cors());

// Load Settings
const settingsPath = path.join(__dirname, './assets/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
global.apikey = settings.apiSettings.apikey;

// Custom Log + Wrap res.json + Batch log semua response
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
    });

    next();
});

// Static & Src Protect
app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/src', (req, res) => {
    res.status(403).json({ error: 'Forbidden access' });
});

// Load API routes dinamis dari src/api/
let totalRoutes = 0;
const apiFolder = path.join(__dirname, './src/api');

function loadRoutes() {
    try {
        if (!fs.existsSync(apiFolder)) {
            console.error('API folder not found:', apiFolder);
            return;
        }

        const subfolders = fs.readdirSync(apiFolder);
        
        subfolders.forEach((subfolder) => {
            const subfolderPath = path.join(apiFolder, subfolder);
            
            if (fs.statSync(subfolderPath).isDirectory()) {
                const files = fs.readdirSync(subfolderPath);
                
                files.forEach((file) => {
                    const filePath = path.join(subfolderPath, file);
                    
                    if (path.extname(file) === '.js') {
                        try {
                            const routeModule = require(filePath);
                            
                            if (typeof routeModule === 'function') {
                                routeModule(app);
                                totalRoutes++;
                                console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded Route: ${path.basename(file)} `));
                            } else {
                                console.warn(chalk.yellow(`Warning: ${file} does not export a function`));
                            }
                        } catch (error) {
                            console.error(chalk.red(`Error loading route ${file}:`), error.message);
                        }
                    }
                });
            }
        });
    } catch (error) {
        console.error('Error loading routes:', error.message);
    }
}

// Panggil fungsi load routes
loadRoutes();

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));

// Index route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

// Error handler 404 & 500 + batch log
app.use((req, res, next) => {
    queueLog({
        method: req.method,
        status: 404,
        url: req.originalUrl,
        duration: 0,
        error: 'Not Found'
    });

    res.status(404).sendFile(path.join(__dirname, 'api-page', '404.html'));
});

app.use((err, req, res, next) => {
    console.error(err.stack);

    queueLog({
        method: req.method,
        status: 500,
        url: req.originalUrl,
        duration: 0,
        error: err.message
    });

    res.status(500).sendFile(path.join(__dirname, 'api-page', '500.html'));
});

app.listen(PORT, () => {
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
});

module.exports = app;
