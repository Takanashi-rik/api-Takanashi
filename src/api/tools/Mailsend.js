const axios = require('axios');
const FormData = require('form-data');

module.exports = function (app) {
  app.get('/tools/mailsend', async (req, res) => {
    const { email, subject, message, base = '1', is_html = 'true' } = req.query;

    if (!email || !subject || !message) {
      return res.status(400).json({
        status: false,
        message: 'Parameter email, subject, dan message wajib diisi.'
      });
    }

    const balls = [
      "noreply@cloudku.click",
      "noreply@cloudkuimages.guru",
      "sender@cloudku.click",
      "sender@cloudkuimages.guru"
    ];
    const from_email = balls[(parseInt(base) - 1) % balls.length] || balls[0];

    try {
      const formData = new FormData();
      formData.append("to", email);
      formData.append("from_email", from_email);
      formData.append("subject", subject);
      formData.append("body", message);
      formData.append("is_html", String(is_html).toLowerCase() === 'true' ? 'true' : 'false');

      const response = await axios.post(
        "https://emailku.cloudku.click/api/sender.php",
        formData,
        {
          headers: {
            ...formData.getHeaders(),
            "accept": "*/*",
            "accept-language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "sec-ch-ua": "'Not-A.Brand';v='9', 'Chromium';v='124'",
            "sec-ch-ua-mobile": "?1",
            "sec-ch-ua-platform": "'Android'",
            "sec-fetch-dest": "empty",
            "sec-fetch-mode": "cors",
            "sec-fetch-site": "same-origin"
          },
          referrer: "https://emailku.cloudku.click/",
          referrerPolicy: "strict-origin-when-cross-origin",
        }
      );

      res.json({
        status: true,
        creator: "FlowFalcon",
        original: "https://emailku.cloudku.click/",
        result: response.data.data
      });

    } catch (err) {
      res.status(500).json({
        status: false,
        creator: "FlowFalcon",
        message: 'Gagal mengirim email',
        error: err.message
      });
    }
  });
};
