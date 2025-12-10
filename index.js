const express = require('express');
const chalk = require('chalk');
const fs = require('fs');
const cors = require('cors');
const path = require('path');
const { Telegraf } = require('telegraf');

require("./function.js");

const app = express();
const PORT = process.env.PORT || 8080;

const TELEGRAM_BOT_TOKEN = '7623684118:AAHSPZCvzwSGzPxQFHuQBdXr_9i6bUf1n7w';
const TELEGRAM_CHAT_ID = '8062985789';
const TELEGRAM_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const bot = new Telegraf(TELEGRAM_BOT_TOKEN);

let requestCounts = new Map();
const REQUEST_LIMIT = 10;
const TIME_WINDOW = 1000;

async function sendTelegramMessage(message, type = 'html') {
  try {
    if (type === 'markdown') {
      await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } else {
      await bot.telegram.sendMessage(TELEGRAM_CHAT_ID, message, {
        parse_mode: 'HTML'
      });
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error.message);
  }
}

setInterval(() => {
  requestCounts.clear();
}, TIME_WINDOW);

function consoleLog({ method, status, url, duration, error = null }) {
  let line = `[${method}] ${status} ${url} - ${duration}ms`;
  
  if (error) {
    line += `\n[ERROR] ${error.message || error}`;
  }
  
  console.log(chalk.hex('#3498db')(line));
}

async function logRequestToTelegram(req, res, responseData = null, error = null) {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const cleanIP = ip.replace('::ffff:', '');
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const { browser, system } = global.detectBrowserAndSystem(userAgent);
    
    let ipInfo;
    try {
      ipInfo = await global.detectIPInfo(cleanIP);
    } catch (ipError) {
      ipInfo = {
        ip: cleanIP,
        country: 'Unknown',
        city: 'Unknown'
      };
    }
    
    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID');
    const waktu = now.toLocaleTimeString('id-ID');
    
    let message = `📌 <b>Request Baru Masuk</b>\n\n`;
    message += `🌐 <b>IP</b>        : <code>${ipInfo.ip}</code>\n`;
    message += `🌍 <b>Country</b> : ${ipInfo.country}\n`;
    message += `🏙️ <b>City</b> : ${ipInfo.city}\n`;
    message += `🖥️ <b>Browser</b> : ${browser}\n`;
    message += `💻 <b>System</b> : ${system}\n`;
    message += `☘️ <b>Endpoint</b>  : <code>${req.originalUrl}</code>\n`;
    message += `🍄 <b>Method</b>    : ${req.method}\n\n`;
    
    if (error) {
      message += `❌ <b>Error</b> : ${error.message || error}\n\n`;
    }
    
    if (responseData) {
      const formattedJson = JSON.stringify(responseData, null, 2);
      if (formattedJson.length > 1000) {
        message += `📦 <b>Response JSON</b> :\n<pre><code class="language-json">${formattedJson.substring(0, 1000)}...</code></pre>\n\n`;
      } else {
        message += `📦 <b>Response JSON</b> :\n<pre><code class="language-json">${formattedJson}</code></pre>\n\n`;
      }
    }
    
    message += `<code>-------------------------</code>\n`;
    message += `⏰ <b>Tanggal</b> : ${tanggal}, ${waktu}`;
    
    await sendTelegramMessage(message);
  } catch (error) {
    console.error('Failed to log request to Telegram:', error.message);
  }
}

async function notifyBlacklistToTelegram(ip, reason, userAgent, endpoint) {
  try {
    let ipInfo;
    try {
      ipInfo = await global.detectIPInfo(ip);
    } catch (error) {
      ipInfo = { country: 'Unknown', city: 'Unknown' };
    }
    
    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID');
    const waktu = now.toLocaleTimeString('id-ID');
    
    const { browser, system } = global.detectBrowserAndSystem(userAgent);
    
    const message = `🚨 <b>IP PERMANENTLY BLACKLISTED</b>\n\n`;
    message += `🌐 <b>IP Address</b> : <code>${ip}</code>\n`;
    message += `🌍 <b>Country</b> : ${ipInfo.country}\n`;
    message += `🏙️ <b>City</b> : ${ipInfo.city}\n`;
    message += `🖥️ <b>Browser</b> : ${browser}\n`;
    message += `💻 <b>System</b> : ${system}\n`;
    message += `📝 <b>Reason</b> : ${reason}\n`;
    message += `🔗 <b>Endpoint</b> : ${endpoint}\n\n`;
    message += `📅 <b>Blocked At</b> : ${tanggal}, ${waktu}\n\n`;
    message += `<i>This IP is now permanently blocked from accessing the server.</i>\n\n`;
    message += `<b>🔧 Commands for Owner</b> :\n`;
    message += `<code>/unblock ${ip}</code> - Remove from blacklist\n`;
    message += `<code>/listblocked</code> - Show all blocked IPs`;
    
    await sendTelegramMessage(message);
  } catch (error) {
    console.error('Failed to send blacklist notification:', error.message);
  }
}

async function notifyUnblockToTelegram(ip, unblockedBy = 'Owner') {
  try {
    const now = new Date();
    const tanggal = now.toLocaleDateString('id-ID');
    const waktu = now.toLocaleTimeString('id-ID');
    
    const message = `✅ <b>IP UNBLOCKED SUCCESSFULLY</b>\n\n`;
    message += `🌐 <b>IP Address</b> : <code>${ip}</code>\n`;
    message += `👤 <b>Unblocked By</b> : ${unblockedBy}\n`;
    message += `📅 <b>Unblocked At</b> : ${tanggal}, ${waktu}\n\n`;
    message += `<i>This IP can now access the server again.</i>`;
    
    await sendTelegramMessage(message);
  } catch (error) {
    console.error('Failed to send unblock notification:', error.message);
  }
}

bot.command('unblock', async (ctx) => {
  if (ctx.from.id.toString() !== TELEGRAM_OWNER_ID) {
    return ctx.reply('❌ Hanya owner yang bisa menggunakan command ini!');
  }
  
  const ip = ctx.message.text.split(' ')[1];
  
  if (!ip) {
    return ctx.reply('❌ Gunakan: /unblock <ip_address>');
  }
  
  const wasBlocked = global.blacklist.removeIP(ip);
  
  if (wasBlocked) {
    await ctx.reply(`✅ IP ${ip} berhasil di-unblock!`);
    await notifyUnblockToTelegram(ip, `Owner (${ctx.from.username || ctx.from.id})`);
  } else {
    await ctx.reply(`ℹ️ IP ${ip} tidak ditemukan dalam blacklist.`);
  }
});

bot.command('listblocked', async (ctx) => {
  if (ctx.from.id.toString() !== TELEGRAM_OWNER_ID) {
    return ctx.reply('❌ Hanya owner yang bisa menggunakan command ini!');
  }
  
  const blockedIPs = global.blacklist.getAllBlockedIPs();
  
  if (blockedIPs.length === 0) {
    return ctx.reply('✅ Tidak ada IP yang di-blacklist.');
  }
  
  let message = `<b>📋 Daftar IP yang di-Blacklist</b> (${blockedIPs.length} IP)\n\n`;
  
  blockedIPs.forEach((ipInfo, index) => {
    message += `<b>${index + 1}. ${ipInfo.ip}</b>\n`;
    message += `   📝 Reason: ${ipInfo.reason}\n`;
    message += `   📅 Blocked: ${ipInfo.blockedAt}\n`;
    message += `   🔗 Endpoint: ${ipInfo.endpoint}\n`;
    message += `   🖥️ User Agent: ${ipInfo.userAgent.substring(0, 50)}${ipInfo.userAgent.length > 50 ? '...' : ''}\n`;
    message += `   🔧 Unblock: <code>/unblock ${ipInfo.ip}</code>\n\n`;
  });
  
  if (message.length > 4000) {
    message = message.substring(0, 4000) + '\n... (pesan terlalu panjang)';
  }
  
  await ctx.reply(message, { parse_mode: 'HTML' });
});

bot.command('checkip', async (ctx) => {
  if (ctx.from.id.toString() !== TELEGRAM_OWNER_ID) {
    return ctx.reply('❌ Hanya owner yang bisa menggunakan command ini!');
  }
  
  const ip = ctx.message.text.split(' ')[1];
  
  if (!ip) {
    return ctx.reply('❌ Gunakan: /checkip <ip_address>');
  }
  
  const isBlocked = global.blacklist.isBlocked(ip);
  
  if (isBlocked) {
    const info = global.blacklist.getBlockInfo(ip);
    let message = `🚫 <b>IP ${ip} TERBLOCKIR</b>\n\n`;
    message += `📝 Reason: ${info.reason}\n`;
    message += `📅 Blocked: ${info.blockedDate}\n`;
    message += `🔗 Endpoint: ${info.endpoint}\n`;
    message += `🖥️ User Agent: ${info.userAgent}\n\n`;
    message += `🔧 Unblock: <code>/unblock ${ip}</code>`;
    await ctx.reply(message, { parse_mode: 'HTML' });
  } else {
    await ctx.reply(`✅ IP ${ip} tidak di-blacklist.`);
  }
});

bot.launch().then(() => {
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(' Telegram bot started successfully '));
}).catch(err => {
  console.error(chalk.bgHex('#FF0000').hex('#FFF').bold(' Telegram bot failed to start: '), err);
});

app.use((req, res, next) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
  const cleanIP = ip.replace('::ffff:', '');
  
  if (global.blacklist.isBlocked(cleanIP)) {
    const blockInfo = global.blacklist.getBlockInfo(cleanIP);
    
    consoleLog({
      method: req.method,
      status: 403,
      url: req.originalUrl,
      duration: 0,
      error: `IP Blocked: ${blockInfo.reason}`
    });
    
    return res.status(403).json({
      status: false,
      error: 'Access Denied',
      message: 'Your IP address has been permanently blocked.',
      reason: blockInfo.reason,
      blocked_at: blockInfo.blockedDate
    });
  }
  
  const currentCount = requestCounts.get(cleanIP) || 0;
  
  if (currentCount > REQUEST_LIMIT) {
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const blockedInfo = global.blacklist.addIP(cleanIP, 'Spam/Rate limit exceeded', userAgent, req.originalUrl);
    
    consoleLog({
      method: req.method,
      status: 403,
      url: req.originalUrl,
      duration: 0,
      error: 'IP Permanently Blacklisted'
    });
    
    notifyBlacklistToTelegram(cleanIP, 'Spam/Rate limit exceeded', userAgent, req.originalUrl);
    
    return res.status(403).json({
      status: false,
      error: 'Access Denied',
      message: 'Your IP address has been permanently blocked for spam/rate limit violation.',
      reason: 'Spam/Rate limit exceeded',
      blocked_at: blockedInfo.blockedDate
    });
  }
  
  requestCounts.set(cleanIP, currentCount + 1);
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

app.use(async (req, res, next) => {
  console.log(chalk.bgHex('#FFFF99').hex('#333').bold(` Request Route: ${req.path} `));
  global.totalreq += 1;
  
  const start = Date.now();
  const originalJson = res.json;
  
  res.json = function (data) {
    const duration = Date.now() - start;
    
    consoleLog({
      method: req.method,
      status: res.statusCode,
      url: req.originalUrl,
      duration
    });
    
    if (data && typeof data === 'object') {
      const responseData = {
        status: data.status,
        creator: settings.apiSettings.creator || "FlowFalcon",
        ...data
      };
      
      if (req.path.startsWith('/src/api/')) {
        logRequestToTelegram(req, res, responseData);
      }
      
      return originalJson.call(this, responseData);
    }
    
    if (req.path.startsWith('/src/api/')) {
      logRequestToTelegram(req, res, data);
    }
    
    return originalJson.call(this, data);
  };
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    if (res.statusCode >= 400 && req.path.startsWith('/src/api/')) {
      const errorData = {
        status: false,
        error: `Request failed with status code ${res.statusCode}`
      };
      logRequestToTelegram(req, res, errorData);
    }
  });
  
  next();
});

app.use('/', express.static(path.join(__dirname, 'api-page')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.use('/src', (req, res) => {
  res.status(403).json({ error: 'Forbidden access' });
});

// Route untuk root domain (index.html)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-page', 'index.html'));
});

// Route untuk docs.html via /docs/
app.get('/docs', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-page', 'docs.html'));
});

// Route untuk docs.html via /docs (tanpa slash)
app.get('/docs/', (req, res) => {
  res.sendFile(path.join(__dirname, 'api-page', 'docs.html'));
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

app.use((req, res, next) => {
  consoleLog({
    method: req.method,
    status: 404,
    url: req.originalUrl,
    duration: 0,
    error: 'Not Found'
  });
  
  if (req.path.startsWith('/src/api/')) {
    const errorData = {
      status: false,
      error: 'Endpoint not found'
    };
    logRequestToTelegram(req, res, errorData);
  }
  
  res.status(404).sendFile(process.cwd() + "/api-page/404.html");
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  
  consoleLog({
    method: req.method,
    status: 500,
    url: req.originalUrl,
    duration: 0,
    error: err
  });
  
  if (req.path.startsWith('/src/api/')) {
    const errorData = {
      status: false,
      error: `Server error: ${err.message}`
    };
    logRequestToTelegram(req, res, errorData);
  }
  
  res.status(500).sendFile(process.cwd() + "/api-page/500.html");
});

app.listen(PORT, () => {
  console.log(chalk.bgHex('#90EE90').hex('#333').bold(` Server is running on port ${PORT} `));
  
  const blockedCount = global.blacklist.ipList.size;
  const startupMsg = `<b>🚀 Server Started Successfully</b>\n\n`;
  startupMsg += `<b>📊 Server Information</b>\n`;
  startupMsg += `• Port: <code>${PORT}</code>\n`;
  startupMsg += `• Total Routes: <code>${totalRoutes}</code>\n`;
  startupMsg += `• Blocked IPs: <code>${blockedCount}</code>\n`;
  startupMsg += `• Time: ${new Date().toLocaleString('id-ID')}\n`;
  startupMsg += `• Environment: ${process.env.NODE_ENV || 'Development'}\n\n`;
  startupMsg += `<b>🔧 Available Commands:</b>\n`;
  startupMsg += `<code>/listblocked</code> - Show blocked IPs\n`;
  startupMsg += `<code>/checkip &lt;ip&gt;</code> - Check IP status\n`;
  startupMsg += `<code>/unblock &lt;ip&gt;</code> - Unblock IP\n\n`;
  startupMsg += `<b>🔧 Ready to receive requests!</b>`;
  
  sendTelegramMessage(startupMsg).catch(console.error);
});

module.exports = app;