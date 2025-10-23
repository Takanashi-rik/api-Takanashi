const axios = require('axios');

module.exports = function (app) {
    app.get("/ai/gpt3", async (req, res) => {
        const { prompt, text } = req.query;

        if (!text) {
            return res.status(400).json({
                status: false,
                creator: "Takanashi",
                message: "Parameter 'text' wajib diisi"
            });
        }

        try {
            const apiUrl = `https://api.siputzx.my.id/api/ai/gpt3?prompt=${encodeURIComponent(prompt || "You are a helpful assistant.")}&content=${encodeURIComponent(text)}`;
            
            const { data } = await axios.get(apiUrl);

            res.json({
                status: true,
                creator: "Takanashi",
                result: data.result || data
            });

        } catch (error) {
            res.status(500).json({
                status: false,
                creator: "Takanashi",
                message: "Gagal mengambil respons dari GPT-3",
                error: error.response?.data?.message || error.message
            });
        }
    });
};