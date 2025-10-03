const axios = require('axios');

module.exports = function (app) {
  app.get("/ai/deepimg", async (req, res) => {
    const { prompt, size = "3:2", style = "3d" } = req.query;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'prompt' wajib diisi."
      });
    }

    const styleList = [
      'default',
      'ghibli',
      'cyberpunk',
      'anime',
      'portrait',
      'chibi',
      'pixel art',
      'oil painting',
      '3d'
    ];

    const stylePrompt = {
      default: '-style Realism',
      ghibli: '-style Ghibli Art',
      cyberpunk: '-style Cyberpunk',
      anime: '-style Anime',
      portrait: '-style Portrait',
      chibi: '-style Chibi',
      'pixel art': '-style Pixel Art',
      'oil painting': '-style Oil Painting',
      '3d': '-style 3D'
    };

    const sizeList = {
      '1:1': '1024x1024',
      '3:2': '1080x720',
      '2:3': '720x1080'
    };

    if (!styleList.includes(style)) {
      return res.status(400).json({
        status: false,
        message: `Style tidak valid. Pilihan: ${styleList.join(", ")}`
      });
    }

    if (!sizeList[size]) {
      return res.status(400).json({
        status: false,
        message: `Size tidak valid. Pilihan: ${Object.keys(sizeList).join(", ")}`
      });
    }

    const payload = {
      device_id: [...Array(32)].map(() => Math.floor(Math.random() * 16).toString(16)).join(""),
      prompt: `${prompt} ${stylePrompt[style]}`,
      size: sizeList[size],
      n: '1',
      output_format: 'png'
    };

    try {
      const { data } = await axios.post(
        'https://api-preview.apirouter.ai/api/v1/deepimg/flux-1-dev',
        payload,
        {
          headers: {
            'content-type': 'application/json',
            origin: 'https://deepimg.ai',
            referer: 'https://deepimg.ai/'
          }
        }
      );

      const imageUrl = data?.data?.images?.[0]?.url;
      if (!imageUrl) {
        return res.status(500).json({
          status: false,
          message: "Gagal mendapatkan gambar dari DeepImg."
        });
      }

      const imageRes = await axios.get(imageUrl, { responseType: "arraybuffer" });

      res.set('Content-Type', 'image/png');
      return res.send(imageRes.data);

    } catch (e) {
      return res.status(500).json({
        status: false,
        message: "Terjadi kesalahan saat memproses prompt.",
        error: e?.response?.data || e.message
      });
    }
  });
};
