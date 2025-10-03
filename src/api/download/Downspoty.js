const fetch = require("node-fetch");

module.exports = function (app) {
  app.get("/download/spotify", async (req, res) => {
    const { url } = req.query;

    if (!url) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'url' wajib diisi (link lagu Spotify)"
      });
    }

    const apiURL = 'https://spotify.downloaderize.com/wp-json/spotify-downloader/v1/fetch';
    const headers = {
      'accept': '*/*',
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
      'referer': 'https://spotify.downloaderize.com/'
    };

    try {
      const resp = await fetch(apiURL, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          type: 'song',
          url
        })
      });

      const json = await resp.json();

      if (!json.success || !json.data?.downloadLink) {
        return res.status(404).json({
          status: false,
          message: "Gagal mengambil data lagu dari Spotify."
        });
      }

      const { title, artist, album, cover, releaseDate, downloadLink } = json.data;

      res.json({
        status: true,
        creator: "FlowFalcon",
        result: {
          title,
          artist,
          album,
          releaseDate,
          download_url: downloadLink,
          cover
        }
      });
    } catch (e) {
      res.status(500).json({
        status: false,
        message: "Terjadi kesalahan saat memproses permintaan.",
        error: e.message || e
      });
    }
  });
};
