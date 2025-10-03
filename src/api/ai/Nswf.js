const axios = require('axios');

module.exports = function (app) {
  app.get('/ai/kivotos', async (req, res) => {
    const {
      prompt,
      style = 'anime',
      width = 1024,
      height = 1024,
      guidance = 7,
      steps = 28
    } = req.query;

    if (!prompt) {
      return res.status(400).json({
        status: false,
        creator: 'FlowFalcon',
        message: 'Parameter "prompt" wajib diisi.'
      });
    }

    const styles = ['anime', 'real', 'photo'];
    if (!styles.includes(style)) {
      return res.status(400).json({
        status: false,
        creator: 'FlowFalcon',
        message: `Style tidak valid. Pilih salah satu: ${styles.join(', ')}`
      });
    }

    const base = `https://heartsync-nsfw-uncensored${style !== 'anime' ? `-${style}` : ''}.hf.space`;
    const session_hash = Math.random().toString(36).slice(2);
    const negative_prompt = 'lowres, bad anatomy, bad hands, text, error, missing finger, extra digits, cropped, worst quality, low quality, watermark, blurry';

    const headers = {
      'User-Agent': `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${Math.floor(Math.random() * 20) + 80}.0) Gecko/20100101 Firefox/${Math.floor(Math.random() * 20) + 80}.0`,
      'Referer': base,
      'Origin': base,
      'Accept': '*/*'
    };

    try {
      // Step 1: Join queue
      await axios.post(`${base}/gradio_api/queue/join`, {
        data: [
          prompt,
          negative_prompt,
          0,
          true,
          parseInt(width),
          parseInt(height),
          parseFloat(guidance),
          parseInt(steps)
        ],
        event_data: null,
        fn_index: 2,
        trigger_id: 16,
        session_hash
      }, { headers, timeout: 25000 });

      // Step 2: Polling max 20 detik
      let resultUrl = null;
      const startTime = Date.now();
      while (Date.now() - startTime < 20000) { // max 20 detik
        const { data: raw } = await axios.get(`${base}/gradio_api/queue/data?session_hash=${session_hash}`, {
          headers,
          timeout: 15000,
          responseType: 'text'
        });

        const lines = raw.split('\n\n');
        for (const line of lines) {
          if (line.startsWith('data:')) {
            const json = JSON.parse(line.slice(6));
            if (json.msg === 'process_completed') {
              resultUrl = json.output?.data?.[0]?.url;
              break;
            }
          }
        }

        if (resultUrl) break;
        await new Promise(r => setTimeout(r, 1500 + Math.floor(Math.random() * 1000)));
      }

      if (!resultUrl) {
        return res.status(429).json({
          status: false,
          creator: 'FlowFalcon',
          message: 'Limit telah tercapai, tunggu beberapa jam kedepan'
        });
      }

      // Step 3: Ambil gambar
      const img = await axios.get(resultUrl, {
        responseType: 'arraybuffer',
        headers
      });

      res.setHeader('Content-Type', 'image/png');
      return res.send(img.data);

    } catch (err) {
      return res.status(429).json({
        status: false,
        creator: 'FlowFalcon',
        message: 'Limit telah tercapai, tunggu beberapa jam kedepan'
      });
    }
  });
};
