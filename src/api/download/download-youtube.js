const yt = {
    baseUrl: 'https://ssvid.net',
    
    get baseHeaders() {
        return {
            'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'origin': this.baseUrl,
            'referer': this.baseUrl + '/youtube-to-mp3',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Mobile Safari/537.36'
        };
    },
 
    validateFormat: function (userFormat) {
        const validFormat = ['mp3', '360p', '720p', '1080p'];
        if (!validFormat.includes(userFormat)) {
            throw new Error(`Invalid format! Available formats: ${validFormat.join(', ')}`);
        }
    },
 
    handleFormat: function (userFormat, searchJson) {
        this.validateFormat(userFormat);
        let result;
        
        if (userFormat === 'mp3') {
            result = searchJson.links?.mp3?.mp3128?.k;
        } else {
            let selectedFormat;
            const allFormats = Object.entries(searchJson.links.mp4);
            const quality = allFormats.map(v => v[1].q)
                .filter(v => /\d+p/.test(v))
                .map(v => parseInt(v))
                .sort((a, b) => b - a)
                .map(v => v + 'p');
                
            if (!quality.includes(userFormat)) {
                selectedFormat = quality[0];
            } else {
                selectedFormat = userFormat;
            }
            
            const find = allFormats.find(v => v[1].q === selectedFormat);
            result = find?.[1]?.k;
        }
        
        if (!result) {
            throw new Error(`${userFormat} not available`);
        }
        
        return result;
    },

    getAllQualities: function (searchJson) {
        const qualities = {
            audio: [],
            video: []
        };

        if (searchJson.links?.mp3) {
            Object.entries(searchJson.links.mp3).forEach(([key, value]) => {
                qualities.audio.push({
                    format: 'mp3',
                    quality: value.q,
                    size: value.size,
                    key: value.k,
                    bitrate: key.replace('mp3', '') + 'kbps'
                });
            });
        }

        if (searchJson.links?.mp4) {
            Object.entries(searchJson.links.mp4).forEach(([key, value]) => {
                qualities.video.push({
                    format: 'mp4',
                    quality: value.q,
                    size: value.size,
                    key: value.k,
                    extension: 'mp4'
                });
            });
        }

        qualities.video.sort((a, b) => {
            const getQualityNum = (q) => parseInt(q.replace('p', '')) || 0;
            return getQualityNum(b.quality) - getQualityNum(a.quality);
        });

        return qualities;
    },
 
    hit: async function (path, payload) {
        try {
            const body = new URLSearchParams(payload);
            const response = await fetch(`${this.baseUrl}${path}`, {
                method: 'POST',
                headers: this.baseHeaders,
                body: body
            });
            
            if (!response.ok) {
                throw new Error(`${response.status} ${response.statusText}\n${await response.text()}`);
            }
            
            return await response.json();
        } catch (error) {
            throw new Error(`${path}\n${error.message}`);
        }
    },

    downloadAllQualities: async function (videoUrl) {
        const search = await this.hit('/api/ajax/search', {
            "query": videoUrl.trim(),
            "cf_token": "",
            "vt": "youtube"
        });

        const allQualities = this.getAllQualities(search);
        const results = [];

        for (const audio of allQualities.audio) {
            try {
                const vid = search.vid;
                const k = audio.key;

                const convert = await this.hit('/api/ajax/convert', {
                    k, vid
                });

                if (convert.c_status === 'CONVERTING') {
                    let convert2;
                    const limit = 5;
                    let attempt = 0;
                    
                    do {
                        attempt++;
                        
                        convert2 = await this.hit('/api/convert/check?hl=en', {
                            vid,
                            b_id: convert.b_id
                        });
                        
                        if (convert2.c_status === 'CONVERTED') {
                            const downloadUrl = convert2.dlink || convert2.d_url || convert2.url || convert2.download_url || convert2.link;
                            
                            if (downloadUrl) {
                                results.push({
                                    type: 'audio',
                                    format: 'mp3',
                                    title: search.t,
                                    duration: search.d,
                                    creator: search.a || 'Unknown',
                                    quality: audio.quality,
                                    bitrate: audio.bitrate,
                                    size: convert2.fsize || audio.size,
                                    download_url: downloadUrl,
                                    thumbnail: search.i
                                });
                            }
                            break;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } while (attempt < limit && convert2.c_status === 'CONVERTING');
                } else {
                    const downloadUrl = convert.dlink || convert.d_url || convert.url || convert.download_url || convert.link;
                    
                    if (downloadUrl) {
                        results.push({
                            type: 'audio',
                            format: 'mp3',
                            title: search.t,
                            duration: search.d,
                            creator: search.a || 'Unknown',
                            quality: audio.quality,
                            bitrate: audio.bitrate,
                            size: convert.fsize || audio.size,
                            download_url: downloadUrl,
                            thumbnail: search.i
                        });
                    }
                }
            } catch (error) {
            }
        }

        for (const video of allQualities.video) {
            try {
                const vid = search.vid;
                const k = video.key;

                const convert = await this.hit('/api/ajax/convert', {
                    k, vid
                });

                if (convert.c_status === 'CONVERTING') {
                    let convert2;
                    const limit = 5;
                    let attempt = 0;
                    
                    do {
                        attempt++;
                        
                        convert2 = await this.hit('/api/convert/check?hl=en', {
                            vid,
                            b_id: convert.b_id
                        });
                        
                        if (convert2.c_status === 'CONVERTED') {
                            const downloadUrl = convert2.dlink || convert2.d_url || convert2.url || convert2.download_url || convert2.link;
                            
                            if (downloadUrl) {
                                results.push({
                                    type: 'video',
                                    format: 'mp4',
                                    title: search.t,
                                    duration: search.d,
                                    creator: search.a || 'Unknown',
                                    quality: video.quality,
                                    size: convert2.fsize || video.size,
                                    download_url: downloadUrl,
                                    thumbnail: search.i
                                });
                            }
                            break;
                        }
                        
                        await new Promise(resolve => setTimeout(resolve, 5000));
                    } while (attempt < limit && convert2.c_status === 'CONVERTING');
                } else {
                    const downloadUrl = convert.dlink || convert.d_url || convert.url || convert.download_url || convert.link;
                    
                    if (downloadUrl) {
                        results.push({
                            type: 'video',
                            format: 'mp4',
                            title: search.t,
                            duration: search.d,
                            creator: search.a || 'Unknown',
                            quality: video.quality,
                            size: convert.fsize || video.size,
                            download_url: downloadUrl,
                            thumbnail: search.i
                        });
                    }
                }
            } catch (error) {
            }
        }

        return {
            id: search.vid,
            title: search.t,
            duration: search.d,
            thumbnail: search.i,
            creator: search.a || 'Unknown',
            all_qualities: allQualities,
            downloads: results
        };
    }
}

module.exports = function (app) {
    
    app.get('/download/ytmp3', async (req, res) => {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'url' wajib diisi."
            });
        }

        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "URL harus berupa link YouTube yang valid."
            });
        }

        try {
            const result = await yt.downloadAllQualities(url);
            
            const mp3Results = result.downloads.filter(item => item.type === 'audio');
            
            if (mp3Results.length === 0) {
                throw new Error('MP3 tidak tersedia');
            }
            
            res.json({
                status: true,
                creator: "Takanashi",
                result: {
                    id: result.id,
                    title: result.title,
                    duration: result.duration,
                    thumbnail: result.thumbnail,
                    creator: result.creator,
                    downloads: mp3Results
                }
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                creator: "Takanashi",
                message: "Gagal mendownload audio MP3 YouTube.",
                error: error.message
            });
        }
    });

    app.get('/download/youtube', async (req, res) => {
        const { url } = req.query;

        if (!url) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'url' wajib diisi."
            });
        }

        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "URL harus berupa link YouTube yang valid."
            });
        }

        try {
            const result = await yt.downloadAllQualities(url);
            
            if (result.downloads.length === 0) {
                throw new Error('Tidak ada kualitas yang berhasil didownload');
            }
            
            res.json({
                status: true,
                creator: "Takanashi",
                result: result
            });
        } catch (error) {
            res.status(500).json({
                status: false,
                creator: "Takanashi",
                message: "Gagal mendownload video YouTube.",
                error: error.message
            });
        }
    });
};