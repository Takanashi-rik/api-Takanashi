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
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let logBuffer = [];

let serverStats = {
    totalRequests: 0,
    serverStartTime: Date.now(),
    totalEndpoints: 0,
    errorCount: 0,
    spamCount: 0,
    bannedIPs: 0
};

const statsFilePath = path.join(__dirname, 'server-stats.json');
const ipBasePath = path.join(__dirname, './src/IP');

const ipDirs = {
    blacklist: path.join(ipBasePath, 'blacklist'),
    whitelist: path.join(ipBasePath, 'whitelist')
};

Object.values(ipDirs).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

function getBlacklist() {
    try {
        const files = fs.readdirSync(ipDirs.blacklist);
        return files.filter(file => file.endsWith('.json')).map(file => file.replace('.json', ''));
    } catch (error) {
        return [];
    }
}

function getWhitelist() {
    try {
        return fs.readdirSync(ipDirs.whitelist);
    } catch (error) {
        return [];
    }
}

let blacklist = getBlacklist();
let whitelist = getWhitelist();

try {
    if (fs.existsSync(statsFilePath)) {
        const savedStats = JSON.parse(fs.readFileSync(statsFilePath, 'utf-8'));
        serverStats.totalRequests = savedStats.totalRequests || 0;
        serverStats.serverStartTime = savedStats.serverStartTime || Date.now();
        serverStats.errorCount = savedStats.errorCount || 0;
        serverStats.spamCount = savedStats.spamCount || 0;
        serverStats.bannedIPs = savedStats.bannedIPs || blacklist.length;
        console.log(chalk.green('Stats loaded from file'));
    }
} catch (error) {
    console.log(chalk.yellow('No existing stats file, starting fresh'));
}

function saveStatsToFile() {
    try {
        serverStats.bannedIPs = blacklist.length;
        fs.writeFileSync(statsFilePath, JSON.stringify(serverStats, null, 2));
    } catch (error) {
        console.error('Error saving stats:', error);
    }
}

function addToBlacklist(ip, violation) {
    if (!blacklist.includes(ip)) {
        blacklist.push(ip);
        const blacklistFile = path.join(ipDirs.blacklist, `${ip}.json`);
        const violationData = {
            name: "Unknown User",
            ip: ip,
            status: "banned",
            violation: violation,
            timestamp: new Date().toISOString(),
            bannedAt: Date.now()
        };
        fs.writeFileSync(blacklistFile, JSON.stringify(violationData, null, 2));
        serverStats.bannedIPs = blacklist.length;
    }
}

function addToWhitelist(ip) {
    if (!whitelist.includes(ip)) {
        whitelist.push(ip);
        const whitelistDir = path.join(ipDirs.whitelist, ip);
        if (!fs.existsSync(whitelistDir)) {
            fs.mkdirSync(whitelistDir, { recursive: true });
        }
        
        const blacklistIndex = blacklist.indexOf(ip);
        if (blacklistIndex > -1) {
            blacklist.splice(blacklistIndex, 1);
            const blacklistFile = path.join(ipDirs.blacklist, `${ip}.json`);
            if (fs.existsSync(blacklistFile)) {
                fs.unlinkSync(blacklistFile);
            }
        }
    }
}

function logWhitelistActivity(ip, endpoint, req) {
    const whitelistDir = path.join(ipDirs.whitelist, ip);
    if (!fs.existsSync(whitelistDir)) return;

    const endpointDir = path.join(whitelistDir, endpoint);
    if (!fs.existsSync(endpointDir)) {
        fs.mkdirSync(endpointDir, { recursive: true });
    }

    const files = fs.readdirSync(endpointDir).filter(f => f.startsWith('endpoint-') && f.endsWith('.json'));
    const nextNumber = files.length + 1;
    const logFile = path.join(endpointDir, `endpoint-${nextNumber}.json`);

    const logData = {
        name: req._requestInfo?.name || "Unknown User",
        ip: ip,
        endpoint: endpoint,
        method: req.method,
        timestamp: new Date().toISOString(),
        userAgent: req.get('User-Agent') || 'Unknown',
        curl: `curl -X ${req.method} "${req.protocol}://${req.get('host')}${req.originalUrl}"`
    };

    fs.writeFileSync(logFile, JSON.stringify(logData, null, 2));
}

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

function cleanupWhitelistLogs() {
    try {
        const now = Date.now();
        const oneDayAgo = now - (24 * 60 * 60 * 1000);

        whitelist.forEach(ip => {
            const ipDir = path.join(ipDirs.whitelist, ip);
            if (fs.existsSync(ipDir)) {
                fs.readdirSync(ipDir).forEach(endpointDir => {
                    const endpointPath = path.join(ipDir, endpointDir);
                    if (fs.statSync(endpointPath).isDirectory()) {
                        fs.readdirSync(endpointPath).forEach(logFile => {
                            const logPath = path.join(endpointPath, logFile);
                            const stats = fs.statSync(logPath);
                            if (stats.mtimeMs < oneDayAgo) {
                                fs.unlinkSync(logPath);
                            }
                        });
                    }
                });
            }
        });
        console.log(chalk.blue('Whitelist logs cleaned up'));
    } catch (error) {
        console.error('Error cleaning whitelist logs:', error);
    }
}

setInterval(cleanupWhitelistLogs, 24 * 60 * 60 * 1000);

async function sendDailyReport() {
    const uptimeMs = Date.now() - serverStats.serverStartTime;
    
    const report = `DAILY SERVER REPORT

Total Requests: ${serverStats.totalRequests}
Total Errors: ${serverStats.errorCount}
Spam Incidents: ${serverStats.spamCount}
Banned IPs: ${blacklist.length}
Whitelisted IPs: ${whitelist.length}
Server Uptime: ${global.runtime(process.uptime())}
Endpoints Available: ${serverStats.totalEndpoints}

Report Time: ${new Date().toLocaleString()}`;

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: report,
        parse_mode: 'Markdown'
    };

    try {
        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, payload);
        console.log(chalk.blue('Daily report sent to Telegram'));
    } catch (error) {
        console.error('Error sending daily report:', error);
    }
}

setInterval(sendDailyReport, 24 * 60 * 60 * 1000);

async function sendSpamNotification(spammerIP, reason) {
    serverStats.spamCount++;
    
    const message = `SPAM DETECTED

Potential spam attack detected!
IP Address: ${spammerIP}
Reason: ${reason}
Time: ${new Date().toLocaleString()}

Choose action:`;

    const keyboard = {
        inline_keyboard: [
            [
                {
                    text: "Ban IP",
                    callback_data: `ban_${spammerIP}`
                },
                {
                    text: "Whitelist IP", 
                    callback_data: `whitelist_${spammerIP}`
                }
            ],
            [
                {
                    text: "View Blacklist",
                    callback_data: "view_blacklist"
                },
                {
                    text: "View Stats", 
                    callback_data: "view_stats"
                }
            ]
        ]
    };

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        reply_markup: keyboard
    };

    try {
        await axios.post(`${TELEGRAM_API_URL}/sendMessage`, payload);
    } catch (error) {
        console.error('Error sending spam notification:', error);
    }
}

app.post('/telegram-webhook', express.json(), (req, res) => {
    const callback = req.body.callback_query;
    if (!callback) return res.sendStatus(200);

    const chatId = callback.message.chat.id;
    const data = callback.data;
    const messageId = callback.message.message_id;

    if (data.startsWith('ban_')) {
        const ip = data.replace('ban_', '');
        addToBlacklist(ip, 'Manual ban via Telegram');
        
        const response = `IP ${ip} has been added to blacklist!`;
        axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
            chat_id: chatId,
            text: response,
            reply_to_message_id: messageId
        });
    } 
    else if (data.startsWith('whitelist_')) {
        const ip = data.replace('whitelist_', '');
        addToWhitelist(ip);
        
        const response = `IP ${ip} has been added to whitelist!`;
        axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
            chat_id: chatId,
            text: response,
            reply_to_message_id: messageId
        });
    }
    else if (data === 'view_blacklist') {
        const blacklistText = blacklist.length > 0 
            ? `Blacklisted IPs (${blacklist.length}):\n\`\`\`\n${blacklist.join('\n')}\n\`\`\``
            : 'No IPs in blacklist';
        
        axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
            chat_id: chatId,
            text: blacklistText,
            parse_mode: 'Markdown',
            reply_to_message_id: messageId
        });
    }
    else if (data === 'view_stats') {
        const statsText = `SERVER STATISTICS

Total Requests: ${serverStats.totalRequests}
Total Errors: ${serverStats.errorCount}
Spam Incidents: ${serverStats.spamCount}
Banned IPs: ${blacklist.length}
Whitelisted IPs: ${whitelist.length}
Server Uptime: ${global.runtime(process.uptime())}
Endpoints Available: ${serverStats.totalEndpoints}

Last Update: ${new Date().toLocaleString()}`;

        axios.post(`${TELEGRAM_API_URL}/sendMessage`, {
            chat_id: chatId,
            text: statsText,
            parse_mode: 'Markdown',
            reply_to_message_id: messageId
        });
    }

    res.sendStatus(200);
});

setInterval(() => {
    if (logBuffer.length === 0) return;

    const combinedLogs = logBuffer.join('\n');
    logBuffer = [];

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: `\`\`\`\n${combinedLogs}\n\`\`\``,
        parse_mode: 'Markdown'
    };

    axios.post(`${TELEGRAM_API_URL}/sendMessage`, payload).catch(console.error);
}, 2000);

function queueLog({ method, status, url, duration, req, responseData = null, error = null }) {
    const info = req?._requestInfo || {};
    const name = info.name || "Unknown User";
    const ip = info.ip || "Unknown IP";
    const endpoint = info.endpoint || url;
    
    let logEntry = `Nama: ${name}
IP: ${ip}
Endpoint: ${endpoint}
Method: ${method}
Status: ${status}
Duration: ${duration}ms`;

    if (responseData && status < 400) {
        logEntry += `\nResponse: ${typeof responseData === 'object' ? JSON.stringify(responseData).substring(0, 200) + '...' : responseData}`;
    }
    
    if (error) {
        logEntry += `\nError: ${error.message || error}`;
    }
    
    logEntry += '\n-------------------';
    
    logBuffer.push(logEntry);
    
    if (status >= 400) {
        global.updateErrorStats(status);
    }
}

let requestCount = 0;
let isCooldown = false;
const requestTimestamps = new Map();

app.use((req, res, next) => {
    const clientIP = req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress || "Unknown IP";
    
    if (whitelist.includes(clientIP)) {
        const endpoint = req.path.split('/')[1] || 'root';
        logWhitelistActivity(clientIP, endpoint, req);
        return next();
    }
    
    if (blacklist.includes(clientIP)) {
        serverStats.errorCount++;
        global.updateErrorStats(403);
        
        queueLog({
            method: req.method,
            status: 403,
            url: req.originalUrl,
            duration: 0,
            req: req,
            error: 'IP Banned - Access Denied'
        });

        return res.status(403).json({ 
            error: 'Access Denied', 
            message: 'Your IP address has been banned from accessing this service.',
            status: 403
        });
    }
    
    req._clientIP = clientIP;
    next();
});

app.use((req, res, next) => {
    const clientIP = req._clientIP;
    
    if (isCooldown && !whitelist.includes(clientIP)) {
        queueLog({
            method: req.method,
            status: 503,
            url: req.originalUrl,
            duration: 0,
            req: req,
            error: 'Server is in cooldown'
        });
        return res.status(503).json({ error: 'Server is in cooldown, try again later.' });
    }

    const now = Date.now();
    const windowStart = now - 1000;
    const timestamps = requestTimestamps.get(clientIP) || [];
    
    const recentTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
    
    if (recentTimestamps.length >= 8) {
        if (!blacklist.includes(clientIP)) {
            addToBlacklist(clientIP, 'Rate limit exceeded (8+ requests/second)');
            sendSpamNotification(clientIP, 'Rate limit exceeded (8+ requests/second)');
            console.log(chalk.red(`IP ${clientIP} automatically banned for spam`));
        }
        
        return res.status(403).json({ 
            error: 'Access Denied', 
            message: 'Your IP has been banned for excessive requests.',
            status: 403 
        });
    }
    
    recentTimestamps.push(now);
    requestTimestamps.set(clientIP, recentTimestamps);
    
    requestCount++;

    if (requestCount > 15 && !whitelist.includes(clientIP)) {
        isCooldown = true;
        const cooldownTime = Math.floor(Math.random() * (120000 - 60000) + 60000);

        console.log(`SPAM DETECT: Cooldown ${cooldownTime / 1000} detik`);
        sendSpamNotification(clientIP, 'Global rate limit triggered server cooldown');

        setTimeout(() => {
            isCooldown = false;
            console.log('Cooldown selesai, server aktif lagi');
        }, cooldownTime);

        return res.status(503).json({ error: 'Too many requests, server cooldown!' });
    }

    next();
});

setInterval(() => {
    const now = Date.now();
    const windowStart = now - 1000;
    
    for (const [ip, timestamps] of requestTimestamps.entries()) {
        const recentTimestamps = timestamps.filter(timestamp => timestamp > windowStart);
        if (recentTimestamps.length === 0) {
            requestTimestamps.delete(ip);
        } else {
            requestTimestamps.set(ip, recentTimestamps);
        }
    }
}, 30000);

app.enable("trust proxy");
app.set("json spaces", 2);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
    req._requestInfo = {
        name: req.headers["x-user-name"] || req.query.name || (req.body && req.body.name) || "Unknown User",
        ip: req._clientIP || "Unknown IP",
        endpoint: req.originalUrl,
        method: req.method
    };
    next();
});

app.use(cors());

let settings;
try {
    const settingsPath = path.join(__dirname, './assets/settings.json');
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
    global.apikey = settings.apiSettings.apikey;
} catch (error) {
    console.error('Error loading settings:', error);
    global.apikey = 'default-key';
}

app.use((req, res, next) => {
    serverStats.totalRequests++;
    
    if (serverStats.totalRequests % 10 === 0) {
        saveStatsToFile();
    }

    const originalSend = res.send;
    const originalJson = res.json;
    
    let responseSent = false;
    
    res.send = function(data) {
        if (!responseSent) {
            responseSent = true;
            if (res.statusCode >= 400) {
                serverStats.errorCount++;
                global.updateErrorStats(res.statusCode);
            }
        }
        return originalSend.call(this, data);
    };
    
    res.json = function(data) {
        if (!responseSent) {
            responseSent = true;
            if (res.statusCode >= 400) {
                serverStats.errorCount++;
                global.updateErrorStats(res.statusCode);
            }
        }
        return originalJson.call(this, data);
    };
    
    next();
});

app.use((req, res, next) => {
    console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Request Route: ${req.path} `));
    if (typeof global.totalreq !== 'undefined') {
        global.totalreq += 1;
    }

    const start = Date.now();
    const originalJson = res.json;
    const originalSend = res.send;

    let responseData = null;
    let responseSent = false;

    res.json = function (data) {
        if (!responseSent) {
            responseSent = true;
            responseData = data;
            
            if (res.statusCode >= 400) {
                serverStats.errorCount++;
                global.updateErrorStats(res.statusCode);
            }
            
            const responseDataToLog = {
                status: data.status || 'success',
                creator: settings?.apiSettings?.creator || "FlowFalcon",
                ...data
            };
            
            return originalJson.call(this, responseDataToLog);
        }
        return originalJson.call(this, data);
    };

    res.send = function (data) {
        if (!responseSent) {
            responseSent = true;
            responseData = data;
            
            if (res.statusCode >= 400) {
                serverStats.errorCount++;
                global.updateErrorStats(res.statusCode);
            }
        }
        return originalSend.call(this, data);
    };

    res.on('finish', () => {
        const duration = Date.now() - start;

        queueLog({
            method: req.method,
            status: res.statusCode,
            url: req.originalUrl,
            duration: duration,
            req: req,
            responseData: responseData
        });
    });

    next();
});

app.get('/admin/blacklist', (req, res) => {
    const blacklistDetails = blacklist.map(ip => {
        const filePath = path.join(ipDirs.blacklist, `${ip}.json`);
        if (fs.existsSync(filePath)) {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        }
        return { ip: ip, status: 'banned' };
    });
    res.json({ blacklistedIPs: blacklistDetails, count: blacklist.length });
});

app.get('/admin/whitelist', (req, res) => {
    const whitelistDetails = whitelist.map(ip => {
        const ipDir = path.join(ipDirs.whitelist, ip);
        const activity = {};
        if (fs.existsSync(ipDir)) {
            fs.readdirSync(ipDir).forEach(endpoint => {
                const endpointDir = path.join(ipDir, endpoint);
                if (fs.statSync(endpointDir).isDirectory()) {
                    activity[endpoint] = fs.readdirSync(endpointDir).length;
                }
            });
        }
        return { ip: ip, activity: activity };
    });
    res.json({ whitelistedIPs: whitelistDetails, count: whitelist.length });
});

app.post('/admin/ban-ip', express.json(), (req, res) => {
    const { ip, violation = "Manual ban" } = req.body;
    if (ip) {
        addToBlacklist(ip, violation);
        res.json({ success: true, message: `IP ${ip} banned`, blacklist });
    } else {
        res.status(400).json({ success: false, message: 'Invalid IP' });
    }
});

app.post('/admin/unban-ip', express.json(), (req, res) => {
    const { ip } = req.body;
    const index = blacklist.indexOf(ip);
    if (index > -1) {
        blacklist.splice(index, 1);
        const blacklistFile = path.join(ipDirs.blacklist, `${ip}.json`);
        if (fs.existsSync(blacklistFile)) {
            fs.unlinkSync(blacklistFile);
        }
        res.json({ success: true, message: `IP ${ip} unbanned`, blacklist });
    } else {
        res.status(400).json({ success: false, message: 'IP not found in blacklist' });
    }
});

app.get('/api/stats', (req, res) => {
    const uptimeMs = Date.now() - serverStats.serverStartTime;
    
    const stats = {
        totalRequests: serverStats.totalRequests,
        totalEndpoints: serverStats.totalEndpoints,
        uptime: uptimeMs,
        serverStartTime: serverStats.serverStartTime,
        errorCount: serverStats.errorCount,
        spamCount: serverStats.spamCount,
        bannedIPs: blacklist.length,
        whitelistedIPs: whitelist.length,
        uptimeFormatted: global.runtime(process.uptime())
    };
    
    res.json(stats);
});

app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/src', (req, res) => {
    serverStats.errorCount++;
    global.updateErrorStats(403);
    res.status(403).json({ error: 'Forbidden access' });
});

let totalRoutes = 0;
const apiFolder = path.join(__dirname, './src/api');

if (fs.existsSync(apiFolder)) {
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
                            console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Loaded: ${path.basename(file)} `));
                        } else {
                            console.log(chalk.bgHex('#FF9999').hex('#333').bold(` Skipped (not a function): ${path.basename(file)} `));
                        }
                    } catch (error) {
                        console.log(chalk.bgHex('#FF0000').hex('#FFF').bold(` ERROR: ${path.basename(file)} `));
                        console.log(chalk.red(`   Error: ${error.message}`));
                    }
                }
            });
        }
    });
} else {
    console.log(chalk.yellow('API folder not found, skipping route loading'));
}

serverStats.totalEndpoints = calculateTotalEndpoints();

console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Load Complete! '));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Routes Loaded: ${totalRoutes} `));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total Endpoints: ${serverStats.totalEndpoints} `));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Banned IPs: ${blacklist.length} `));
console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Whitelisted IPs: ${whitelist.length} `));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

app.use((req, res, next) => {
    serverStats.errorCount++;
    global.updateErrorStats(404);
    
    queueLog({
        method: req.method,
        status: 404,
        url: req.originalUrl,
        duration: 0,
        req: req,
        error: 'Not Found'
    });

    res.status(404).sendFile(path.join(__dirname, "api-page", "404.html"));
});

app.use((err, req, res, next) => {
    console.error(err.stack);
    
    serverStats.errorCount++;
    global.updateErrorStats(500);

    queueLog({
        method: req.method,
        status: 500,
        url: req.originalUrl,
        duration: 0,
        req: req,
        error: err.message
    });

    res.status(500).sendFile(path.join(__dirname, "api-page", "500.html"));
});

process.on('SIGINT', () => {
    console.log(chalk.yellow('Saving stats before shutdown...'));
    saveStatsToFile();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log(chalk.yellow('Saving stats before shutdown...'));
    saveStatsToFile();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Error tracking: ACTIVE `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` IP Protection: ACTIVE `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Banned IPs: ${blacklist.length} `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Whitelisted IPs: ${whitelist.length} `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Initial error count: ${serverStats.errorCount} `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Total requests: ${serverStats.totalRequests} `));
    console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server start time: ${new Date(serverStats.serverStartTime).toLocaleString()} `));
    
    const startupMsg = `Server Started

Server is running on port ${PORT}
Error tracking: ACTIVE  
IP Protection: ACTIVE
Banned IPs: ${blacklist.length}
Whitelisted IPs: ${whitelist.length}
Initial error count: ${serverStats.errorCount}
Total requests: ${serverStats.totalRequests}
Server start: ${new Date(serverStats.serverStartTime).toLocaleString()}`;

    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: startupMsg,
        parse_mode: 'Markdown'
    };
    
    axios.post(`${TELEGRAM_API_URL}/sendMessage`, payload).catch(console.error);
});

setInterval(() => {
    saveStatsToFile();
}, 30000);

module.exports = app;