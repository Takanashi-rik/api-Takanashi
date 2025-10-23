const axios = require('axios');

module.exports = function (app) {
    app.get("/ai/claude", async (req, res) => {
        const { text, systemPrompt } = req.query;

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'text' wajib diisi."
            });
        }

        if (typeof text !== "string" || text.trim().length === 0) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'text' harus berupa string yang tidak kosong."
            });
        }

        try {
            console.log("Mengirim request ke Claude 3.5 Haiku API...");
            
            const apiUrl = `https://api.nekolabs.my.id/ai/claude/3.5-haiku?text=${encodeURIComponent(text.trim())}&systemPrompt=${encodeURIComponent(systemPrompt?.trim() || "You are a helpful AI assistant")}`;
            
            const { data } = await axios.get(apiUrl, {
                timeout: 30000,
                headers: {
                    "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
                }
            });

            if (!data) {
                return res.status(500).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Gagal mengambil respons dari Claude 3.5 Haiku API.",
                    error: "Response kosong dari API"
                });
            }

            const result = data.result || data.response || data.content || data;

            res.json({
                status: true,
                creator: "Takanashi",
                result: result
            });

        } catch (error) {
            console.error("Error Claude 3.5 Haiku API:", error.message);
            
            if (error.code === 'ECONNABORTED') {
                return res.status(408).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Request timeout - API terlalu lama merespons.",
                    error: "Timeout"
                });
            }
            
            if (error.response) {
                return res.status(error.response.status).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Gagal mengambil respons dari Claude 3.5 Haiku API.",
                    error: error.response.data?.message || error.response.statusText
                });
            } else if (error.request) {
                return res.status(503).json({
                    status: false,
                    creator: "Takanashi",
                    message: "Tidak dapat terhubung ke Claude 3.5 Haiku API.",
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