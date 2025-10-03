const axios = require("axios");

const client_id = "3ac7d9b75ec644cb9ae627ee5db358e6";
const client_secret = "462c7edd060548f3b181dbf8d8c673dc";

let access_token = "";
let token_expiry = 0;

async function getSpotifyToken() {
  if (access_token && Date.now() < token_expiry) {
    return access_token;
  }

  const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");
  const res = await axios.post(
    "https://accounts.spotify.com/api/token",
    "grant_type=client_credentials",
    {
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  access_token = res.data.access_token;
  token_expiry = Date.now() + res.data.expires_in * 1000;
  return access_token;
}

module.exports = function (app) {
  app.get("/search/spotify", async (req, res) => {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'query' wajib diisi."
      });
    }

    try {
      const token = await getSpotifyToken();

      const searchRes = await axios.get(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const tracks = searchRes.data.tracks.items.map(item => ({
        title: item.name,
        artist: item.artists.map(a => a.name).join(", "),
        link: item.external_urls.spotify,
        image: item.album.images?.[0]?.url,
        duration_ms: item.duration_ms,
        popularity: item.popularity
      }));

      res.json({
        status: true,
        creator: "FlowFalcon",
        result: tracks
      });
    } catch (e) {
      res.status(500).json({
        status: false,
        message: "Gagal mengambil data dari Spotify.",
        error: e.response?.data || e.message
      });
    }
  });
};
