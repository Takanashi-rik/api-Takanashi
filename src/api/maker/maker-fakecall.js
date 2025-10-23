const axios = require("axios");

module.exports = function (app) {
    async function fakecall(nama, durasi, avatar) {
        try {
            const url = `https://api.zenzxz.my.id/maker/fakecall?nama=${encodeURIComponent(nama)}&durasi=${encodeURIComponent(durasi)}&avatar=${encodeURIComponent(avatar)}`;
            const response = await axios.get(url, { responseType: "arraybuffer" });
            return response.data;
        } catch (error) {
            throw error;
        }
    }

    app.get('/maker/fakecall', async (req, res) => {
        const { nama, durasi, avatar } = req.query;

        if (!nama || !durasi || !avatar) {
            return res.status(400).json({
                status: false,
                message: "Parameter 'nama', 'durasi', dan 'avatar' wajib diisi"
            });
        }

        try {
            const image = await fakecall(nama, durasi, avatar);
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': image.length
            });
            res.end(image);
        } catch (error) {
            res.status(500).json({
                status: false,
                message: "Gagal membuat fake call",
                error: error.message
            });
        }
    });
};