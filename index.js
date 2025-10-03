const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const serverless = require('serverless-http');

require("./function.js");

const app = express();
const PORT = process.env.PORT || 8080;

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1396122030163628112/-vEj4HjREjbaOVXDu5932YjeHpTkjNSKyUKugBFF9yVCBeQSrdgK8qM3HNxVYTOD5BYP';

let logBuffer = [];
setInterval(() => {
    if (logBuffer.length === 0) return;
    const combinedLogs = logBuffer.join('\n');
    logBuffer = [];
    const payload = `\`\`\`ansi\n${combinedLogs}\n\`\`\``;
    axios.post(WEBHOOK_URL, { content: payload }).catch(() => {});
}, 2000);

function queueLog({ method, status, url, duration, error = null }) {
    let colorCode;
    if (status >= 500) colorCode = '\x1b[2;31m';
    else if (status >= 400) colorCode = '\x1b[2;31m';
    else if (status === 304) colorCode = '\x1b[2;34m';
    else colorCode = '\x1b[2;32m';
    let line = `${colorCode}[${method}] ${status} ${url} - ${duration}ms\x1b[0m`;
    if (error) line += `\n\x1b[2;31m[ERROR] ${error.message || error}\x1b[0m`;
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
        const cooldownTime = (Math.random() * (120000 - 60000) + 60000).toFixed(0);
        const spamMsg = `\`\`\`ansi
⚠️ [ SPAM DETECT ] ⚠️
[ ! ] Too many requests, server cooldown for ${cooldownTime / 1000} sec!
\x1b[2;31m[${req.method}] 503 ${req.originalUrl} - 0ms\x1b[0m
\`\`\``;
        axios.post(WEBHOOK_URL, { content: spamMsg }).catch(() => {});
        setTimeout(() => {
            isCooldown = false;
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

app.use((req, res) => {
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

if (process.env.VERCEL) {
    module.exports = app;
    module.exports.handler = serverless(app);
} else {
    app.listen(PORT, () => {
        console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
    });
}
