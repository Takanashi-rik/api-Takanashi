const axios = require("axios");
const moment = require('moment-timezone');
const fs = require('fs');
const path = require('path');

function tanggal(numer) {
  const myMonths = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const myDays = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const tgl = new Date(numer);
  const day = tgl.getDate();
  const bulan = tgl.getMonth();
  let thisDay = tgl.getDay();
  thisDay = myDays[thisDay];
  const yy = tgl.getYear();
  const year = (yy < 1000) ? yy + 1900 : yy;
  const time = moment.tz('Asia/Jakarta').format('DD/MM HH:mm:ss');
  const d = new Date();
  const locale = 'id';
  const gmt = new Date(0).getTime() - new Date('1 January 1970').getTime();
  const weton = ['Pahing', 'Pon', 'Wage', 'Kliwon', 'Legi'][Math.floor(((d * 1) + gmt) / 84600000) % 5];
  
  return `${thisDay}, ${day}/${myMonths[bulan]}/${year}`;
}

const capital = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const getBuffer = async (url, options) => {
  try {
    options = options || {};
    const res = await axios({
      method: "get",
      url,
      headers: {
        'DNT': 1,
        'Upgrade-Insecure-Request': 1
      },
      ...options,
      responseType: 'arraybuffer'
    });
    return res.data;
  } catch (err) {
    return err;
  }
};

const fetchJson = async (url, options) => {
  try {
    options = options || {};
    const res = await axios({
      method: 'GET',
      url: url,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.69 Safari/537.36'
      },
      ...options
    });
    return res.data;
  } catch (err) {
    return err;
  }
};

const runtime = function(seconds = process.uptime()) {
  seconds = Number(seconds);
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor(seconds % (3600 * 24) / 3600);
  const m = Math.floor(seconds % 3600 / 60);
  const s = Math.floor(seconds % 60);
  const dDisplay = d > 0 ? d + (d == 1 ? "d " : "d ") : "";
  const hDisplay = h > 0 ? h + (h == 1 ? "h " : "h ") : "";
  const mDisplay = m > 0 ? m + (m == 1 ? "m " : "m ") : "";
  const sDisplay = s > 0 ? s + (s == 1 ? "s" : "s") : "";
  return dDisplay + hDisplay + mDisplay + sDisplay;
};

const detectIPInfo = async (ip) => {
  try {
    const response = await axios.get(`https://www.find-ip.net/${ip}`);
    return {
      ip: ip,
      country: response.data.country || 'Unknown',
      city: response.data.city || 'Unknown',
      browser: 'Unknown',
      system: 'Unknown'
    };
  } catch (error) {
    return {
      ip: ip,
      country: 'Unknown',
      city: 'Unknown',
      browser: 'Unknown',
      system: 'Unknown'
    };
  }
};

const detectBrowserAndSystem = (userAgent) => {
  let browser = 'Unknown';
  let system = 'Unknown';
  
  if (!userAgent) return { browser, system };
  
  if (userAgent.includes('Chrome')) browser = 'Chrome';
  else if (userAgent.includes('Firefox')) browser = 'Firefox';
  else if (userAgent.includes('Safari')) browser = 'Safari';
  else if (userAgent.includes('Edge')) browser = 'Edge';
  else if (userAgent.includes('Opera')) browser = 'Opera';
  
  if (userAgent.includes('Windows')) system = 'Windows';
  else if (userAgent.includes('Mac OS')) system = 'Mac OS';
  else if (userAgent.includes('Linux')) system = 'Linux';
  else if (userAgent.includes('Android')) system = 'Android';
  else if (userAgent.includes('iOS')) system = 'iOS';
  
  return { browser, system };
};

const blacklist = {
  ipList: new Map(),
  blockedIPsFile: path.join(__dirname, 'blocked_ips.json'),
  
  loadBlockedIPs: function() {
    try {
      if (fs.existsSync(this.blockedIPsFile)) {
        const data = JSON.parse(fs.readFileSync(this.blockedIPsFile, 'utf8'));
        for (const [ip, info] of Object.entries(data)) {
          this.ipList.set(ip, info);
        }
        console.log(`✅ Loaded ${this.ipList.size} blocked IPs from file`);
      }
    } catch (error) {
      console.error('Error loading blocked IPs:', error.message);
    }
  },
  
  saveBlockedIPs: function() {
    try {
      const data = {};
      for (const [ip, info] of this.ipList.entries()) {
        data[ip] = info;
      }
      fs.writeFileSync(this.blockedIPsFile, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('Error saving blocked IPs:', error.message);
    }
  },
  
  addIP: function(ip, reason = 'Spam request', userAgent = 'Unknown', endpoint = 'Unknown') {
    const blockedInfo = {
      timestamp: Date.now(),
      reason: reason,
      userAgent: userAgent,
      endpoint: endpoint,
      blockedDate: new Date().toLocaleString('id-ID')
    };
    
    this.ipList.set(ip, blockedInfo);
    this.saveBlockedIPs();
    console.log(`🚫 IP ${ip} permanently blacklisted. Reason: ${reason}`);
    return blockedInfo;
  },
  
  isBlocked: function(ip) {
    return this.ipList.has(ip);
  },
  
  removeIP: function(ip) {
    const removed = this.ipList.delete(ip);
    if (removed) {
      this.saveBlockedIPs();
      console.log(`✅ IP ${ip} removed from blacklist`);
    }
    return removed;
  },
  
  getAllBlockedIPs: function() {
    const blockedIPs = [];
    for (const [ip, data] of this.ipList.entries()) {
      blockedIPs.push({
        ip,
        reason: data.reason,
        blockedAt: data.blockedDate,
        userAgent: data.userAgent,
        endpoint: data.endpoint
      });
    }
    return blockedIPs;
  },
  
  getBlockInfo: function(ip) {
    return this.ipList.get(ip);
  }
};

blacklist.loadBlockedIPs();

global.getBuffer = getBuffer;
global.fetchJson = fetchJson;
global.runtime = runtime;
global.detectIPInfo = detectIPInfo;
global.detectBrowserAndSystem = detectBrowserAndSystem;
global.blacklist = blacklist;
global.totalreq = 0;