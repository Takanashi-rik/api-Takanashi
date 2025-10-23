const axios = require('axios');

module.exports = function (app) {
    app.get("/random/nsfw/anal", async (req, res) => {
        try {
            const apiUrl = "https://api.nekolabs.my.id/random/nsfw/anal";
            
            const { data } = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
                }
            });

            if (!data || !data.result || !data.result.url) {
                return res.status(500).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Data anal tidak valid atau kosong.",
                    error: "Invalid data format"
                });
            }

            // Fetch the image
            const imageResponse = await axios.get(data.result.url, {
                responseType: 'arraybuffer',
                timeout: 30000
            });

            res.writeHead(200, {
                'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg',
                'Content-Length': imageResponse.data.length,
            });
            res.end(imageResponse.data);

        } catch (error) {
            if (error.code === 'ECONNABORTED') {
                return res.status(408).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Request timeout - Terlalu lama mengambil data.",
                    error: "Timeout"
                });
            }
            
            if (error.response) {
                return res.status(error.response.status).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Gagal mengambil data anal dari API.",
                    error: error.response.data?.message || error.response.statusText
                });
            } else if (error.request) {
                return res.status(503).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Tidak dapat terhubung ke API.",
                    error: "Network Error"
                });
            } else {
                return res.status(500).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Terjadi kesalahan internal.",
                    error: error.message
                });
            }
        }
    });
};