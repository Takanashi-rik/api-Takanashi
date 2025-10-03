const axios = require("axios");
const { randomUUID, randomBytes } = require("crypto");
const FormData = require("form-data");

module.exports = function (app) {
  app.get("/tools/toghibli", async (req, res) => {
    const { url, prompt } = req.query;
    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' wajib diisi (link gambar)"
      });
    }

    try {
      // Ambil buffer dari gambar
      const buffer = (await axios.get(url, { responseType: "arraybuffer" })).data;
      const mimetype = "image/jpeg"; // default
      const ext = ".jpg";
      const filename = `Fiony_${randomBytes(4).toString("hex")}${ext}`;
      const uuid = randomUUID();

      // Upload image ke Overchat
      const form = new FormData();
      form.append("file", buffer, { filename, contentType: mimetype });

      const headers = {
        ...form.getHeaders(),
        authorization: "Bearer",
        "x-device-language": "en",
        "x-device-platform": "web",
        "x-device-uuid": uuid,
        "x-device-version": "1.0.44"
      };

      const { data: uploadRes } = await axios.post(
        "https://widget-api.overchat.ai/v1/chat/upload",
        form,
        { headers }
      );

      const { link, croppedImageLink, chatId } = uploadRes;

      // Siapkan prompt dan payload
      const stylePrompt = prompt || "Ghibli Studio style, charming hand-drawn anime-style illustration.";
      const payload = {
        chatId,
        prompt: stylePrompt,
        model: "gpt-image-1",
        personaId: "image-to-image",
        metadata: {
          files: [{ path: filename, link, croppedImageLink }]
        }
      };

      const jsonHeaders = {
        ...headers,
        "content-type": "application/json"
      };

      // Generate image Ghibli
      const { data: result } = await axios.post(
        "https://widget-api.overchat.ai/v1/images/generations",
        payload,
        { headers: jsonHeaders }
      );

      res.json({
        status: true,
        creator: "FlowFalcon",
        result
      });
    } catch (err) {
      const detail = err.response?.data || err.message;
      res.status(500).json({
        status: false,
        creator: "FlowFalcon",
        message: "Gagal mengubah gambar ke gaya Ghibli",
        error: detail
      });
    }
  });
};
