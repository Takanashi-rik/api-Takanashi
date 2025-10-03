const axios = require("axios");

async function waitModelReady(model) {
  let attempts = 0;
  while (attempts < 5) {
    const res = await axios.get(`https://huggingface.co/api/models/${model}`);
    if (!res.data?.error && !res.data?.disabled) return true;
    await new Promise(resolve => setTimeout(resolve, 4000)); // tunggu 4 detik
    attempts++;
  }
  throw new Error("Model tidak tersedia saat ini.");
}

module.exports = function (app) {
  app.get("/tools/gore-check", async (req, res) => {
    const { url } = req.query;
    const model = "Falconsai/nsfw_image_detection";

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' wajib diisi (link gambar)"
      });
    }

    try {
      await waitModelReady(model);

      const { data } = await axios.post(
        `https://api-inference.huggingface.co/models/${model}`,
        { inputs: url },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer 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",
            "User-Agent": "Mozilla/5.0"
          }
        }
      );

      const top = data.sort((a, b) => b.score - a.score)[0];

      res.json({
        status: true,
        creator: "FlowFalcon",
        result: {
          label: top.label,
          confidence: `${(top.score * 100).toFixed(2)}%`,
          raw: data
        }
      });
    } catch (e) {
      res.status(500).json({
        status: false,
        creator: "FlowFalcon",
        message: "Gagal mengecek konten dari gambar",
        error: e.response?.data || e.message
      });
    }
  });
};

