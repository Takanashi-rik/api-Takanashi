const axios = require("axios");

module.exports = function (app) {
  app.get("/tools/removebg", async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' wajib diisi (link gambar)"
      });
    }

    try {
      // Ambil gambar dan konversi ke base64
      const response = await axios.get(url, { responseType: "arraybuffer" });
      const mime = response.headers["content-type"] || "image/jpeg";
      const ext = mime.split("/")[1];
      const rand = Math.floor(Math.random() * 99999);
      const title = `FlowRemove-${rand}.${ext}`;
      const base64 = `data:${mime};base64,${Buffer.from(response.data).toString("base64")}`;

      // Kirim ke endpoint background-remover
      const { data } = await axios.post(
        "https://background-remover.com/removeImageBackground",
        {
          encodedImage: base64,
          title,
          mimeType: mime
        },
        {
          headers: {
            "accept": "*/*",
            "content-type": "application/json; charset=utf-8",
            "referer": "https://background-remover.com/upload"
          }
        }
      );

      const outB64 = data.encodedImageWithoutBackground?.split(",")[1];
      if (!outB64) {
        return res.status(500).json({
          status: false,
          message: "Gagal menghapus background."
        });
      }

      const imageBuffer = Buffer.from(outB64, "base64");

      res.writeHead(200, {
        "Content-Type": mime,
        "Content-Length": imageBuffer.length
      });
      return res.end(imageBuffer);
    } catch (e) {
      const detail = e.response?.data || e.message;
      return res.status(500).json({
        status: false,
        message: "Terjadi kesalahan saat proses background remover.",
        error: detail
      });
    }
  });
};
