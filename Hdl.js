const axios = require('axios');
const FormData = require('form-data');

module.exports = function (app) {
  app.get('/tools/hdr', async (req, res) => {
    const { url, resolution = '1080p', enhance = 'true' } = req.query;

    if (!url) {
      return res.status(400).json({ status: false, message: 'Parameter url wajib diisi.' });
    }

    if (!/^https?:\/\/.+\.(jpe?g|png|webp|gif)$/i.test(url)) {
      return res.status(400).json({ status: false, message: 'URL gambar tidak valid.' });
    }

    const validRes = ['480p', '720p', '1080p', '2k', '4k', '8k', '12k'];
    if (!validRes.includes(resolution.toLowerCase())) {
      return res.status(400).json({ status: false, message: `Resolusi tidak valid. Pilih salah satu: ${validRes.join(', ')}` });
    }

    try {
      // Ambil image buffer
      const { data: imageBuffer } = await axios.get(url, { responseType: 'arraybuffer' });

      // Buat form
      const form = new FormData();
      form.append('image', imageBuffer, { filename: 'image.jpg' });
      form.append('resolution', resolution.toLowerCase());
      form.append('enhance', enhance.toString());

      // Kirim ke server
      const { data } = await axios.post('https://upscale.cloudkuimages.guru/hd.php', form, {
        headers: {
          ...form.getHeaders(),
          origin: 'https://upscale.cloudkuimages.guru',
          referer: 'https://upscale.cloudkuimages.guru/'
        },
        maxBodyLength: Infinity
      });

      if (data?.status !== 'success') {
        return res.status(500).json({ status: false, message: 'Upscale gagal', result: data });
      }

      const result = data.data;
      res.json({
        status: true,
        creator: 'FlowFalcon',
        result: {
          url: result.url,
          filename: result.filename,
          original: result.original,
          resolution_from: result.original_resolution,
          resolution_to: result.resolution_now,
          enhanced: result.enhanced,
          size_before: result.original_size,
          size_after: result.new_size
        }
      });

    } catch (err) {
      res.status(500).json({
        status: false,
        message: 'Terjadi error saat memproses',
        error: err.message
      });
    }
  });
};
