const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');

require("./function.js");

const app = express();
const PORT = process.env.PORT || 8080;

const BOT_TOKEN = '7623684118:AAEQLYvigbve0jCvzm8oL-0u8SJmCGAlcOY';
const CHAT_ID = '-1004428565913';
const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

async function sendToTelegram(message) {
    try {
        await axios.post(TELEGRAM_API, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
    } catch (err) {
        console.error('Telegram error:', err.message);
    }
}

let logBuffer = [];

setInterval(() => {
    if (logBuffer.length === 0) return;

    const combinedLogs = logBuffer.join('\n\n');
    logBuffer = [];

    const payload = `<pre>${combinedLogs}</pre>`;
    sendToTelegram(payload);
}, 2000);

function queueLog({ method, status, url, duration, error = null, timestamp = null }) {
    let colorCode;
    if (status >= 500) colorCode = '[2;31m';
    else if (status >= 400) colorCode = '[2;31m';
    else if (status === 304) colorCode = '[2;34m';
    else colorCode = '[2;32m';

    let lines = [];
    
    lines.push(`${colorCode}[${method}][0m`);
    lines.push(`${colorCode}${status}[0m`);
    lines.push(`${colorCode}${url}[0m`);
    lines.push(`${colorCode}${duration}ms[0m`);

    if (timestamp) {
        lines.push(`[2;37mTime: ${timestamp}[0m`);
    }

    if (error) {
        lines.push(`[2;31mError: ${error.message || error}[0m`);
    }

    logBuffer.push(lines.join('\n'));
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

        const spamMsg =
            `<b>⚠️ SPAM DETECT ⚠️</b>

Too many requests, server cooldown for ${cooldownTime / 1000} sec!

<code>[${req.method}]
${503}
${req.originalUrl}
0ms</code>`;

        sendToTelegram(spamMsg);

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

const settingsPath = path.join(__dirname, './assets/settings.json');
const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
global.apikey = settings.apiSettings.apikey;

app.use((req, res, next) => {
    console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Request Route: ${req.path} `));
    global.totalreq += 1;

    const start = Date.now();
    const originalJson = res.json;
    const timestamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    res.json = function(data) {
        const responseData = {
            status: data.status,
            creator: settings.apiSettings.creator || "FlowFalcon",
            ...data
        };

        queueLog({
            method: req.method,
            status: res.statusCode,
            url: req.originalUrl,
            duration: Date.now() - start,
            timestamp: timestamp
        });

        return originalJson.call(this, responseData);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;

        if (!res._hasLogged) {
            res._hasLogged = true;
        }
    });

    next();
});

app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/src', (req, res) => {
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
                require(filePath)(app);
                totalRoutes++;
                console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded Route: ${path.basename(file)} `));
            }
        });
    }
});

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! ✓ '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

app.use((req, res, next) => {
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

    queueLog({
        method: req.method,
        status: 500,
        url: req.originalUrl,
        duration: 0,
        error: err
    });

    res.status(500).sendFile(process.cwd() + "/api-page/500.html");
});

app.listen(PORT, () => {
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
});

module.exports = app;
