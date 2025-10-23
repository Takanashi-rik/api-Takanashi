const axios = require("axios");

async function ttdl(url) {
    return new Promise(async (resolve, reject) => {
        try {
            let data = [];

            function formatNumber(integer) {
                let numb = parseInt(integer);
                return Number(numb).toLocaleString().replace(/,/g, '.');
            }

            function formatDate(n, locale = 'en') {
                let d = new Date(n * 1000); // Convert to milliseconds
                return d.toLocaleDateString(locale, {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: 'numeric',
                    second: 'numeric'
                });
            }

            let domain = 'https://www.tikwm.com/api/';
            let res = await axios.post(domain + '?url=' + encodeURIComponent(url), {}, {
                headers: {
                    'Accept': 'application/json, text/javascript, */*; q=0.01',
                    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'Origin': 'https://www.tikwm.com',
                    'Referer': 'https://www.tikwm.com/',
                    'Sec-Ch-Ua': '"Not)A;Brand" ;v="24" , "Chromium" ;v="116"',
                    'Sec-Ch-Ua-Mobile': '?1',
                    'Sec-Ch-Ua-Platform': 'Android',
                    'Sec-Fetch-Dest': 'empty',
                    'Sec-Fetch-Mode': 'cors',
                    'Sec-Fetch-Site': 'same-origin',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                params: {
                    url: url,
                    count: 12,
                    cursor: 0,
                    web: 1,
                    hd: 1
                }
            });

            const responseData = res.data.data;

            if (!responseData) {
                throw new Error("Tidak dapat mengambil data dari URL TikTok");
            }

            if (responseData?.duration == 0) {
                responseData.images.map(v => data.push({ 
                    type: 'photo', 
                    url: 'https://www.tikwm.com' + v 
                }));
            } else {
                data.push(
                    {
                        type: 'watermark',
                        url: 'https://www.tikwm.com' + (responseData?.wmplay || "")
                    },
                    {
                        type: 'nowatermark',
                        url: 'https://www.tikwm.com' + (responseData?.play || "")
                    },
                    {
                        type: 'nowatermark_hd',
                        url: 'https://www.tikwm.com' + (responseData?.hdplay || "")
                    }
                );
            }

            let json = {
                status: true,
                title: responseData.title,
                taken_at: formatDate(responseData.create_time).replace('1970', ''),
                region: responseData.region,
                id: responseData.id,
                durations: responseData.duration,
                duration: responseData.duration + ' Seconds',
                cover: 'https://www.tikwm.com' + responseData.cover,
                size_wm: responseData.wm_size,
                size_nowm: responseData.size,
                size_nowm_hd: responseData.hd_size,
                data: data,
                music_info: {
                    id: responseData.music_info?.id,
                    title: responseData.music_info?.title,
                    author: responseData.music_info?.author,
                    album: responseData.music_info?.album ? responseData.music_info.album : null,
                    url: 'https://www.tikwm.com' + (responseData.music || responseData.music_info?.play || "")
                },
                stats: {
                    views: formatNumber(responseData.play_count),
                    likes: formatNumber(responseData.digg_count),
                    comment: formatNumber(responseData.comment_count),
                    share: formatNumber(responseData.share_count),
                    download: formatNumber(responseData.download_count)
                },
                author: {
                    id: responseData.author?.id,
                    fullname: responseData.author?.unique_id,
                    nickname: responseData.author?.nickname,
                    avatar: 'https://www.tikwm.com' + responseData.author?.avatar
                }
            };
            resolve(json);
        } catch (e) {
            reject(e);
        }
    });
}

module.exports = function (app) {
    app.get('/download/tiktok', async (req, res) => {
        const { url } = req.query;

        // Validasi parameter
        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'url' wajib diisi."
            });
        }

        if (typeof url !== "string" || url.trim().length === 0) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'url' harus berupa string yang tidak kosong."
            });
        }

        // Validasi URL TikTok
        if (!url.includes('tiktok.com') && !url.includes('vt.tiktok.com')) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "URL harus berupa link TikTok yang valid."
            });
        }

        try {
            const results = await ttdl(url.trim());
            
            res.json({
                status: true,
                creator: "Takanashi",
                result: results
            });
        } catch (error) {
            console.error("Error TikTok Download:", error.message);
            
            res.status(500).json({
                status: false,
                creator: "Takanashi",
                message: "Gagal mendownload video TikTok.",
                error: error.message
            });
        }
    });
};