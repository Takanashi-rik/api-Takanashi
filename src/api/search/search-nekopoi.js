const axios = require("axios");
const cheerio = require("cheerio");

async function scrapeNekopoiSearch(query) {
  const baseUrl = "https://nekopoi.care";
  const url = `${baseUrl}/search/${encodeURIComponent(query)}`;
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
      timeout: 10000,
    });
    const $ = cheerio.load(data);
    const results = [];
    $(".result ul li").each((i, el) => {
      const title = $(el).find("h2 a").text().trim();
      let link = $(el).find("h2 a").attr("href");
      let image = $(el).find(".limitnjg img").attr("src");
      const description = $(el).find(".desc").text().trim();
      if (link && !link.startsWith("http")) link = `${baseUrl}${link}`;
      if (image && !image.startsWith("http")) image = `${baseUrl}${image}`;
      if (title && link) {
        results.push({
          title,
          link,
          image,
          description: description || "Tidak ada deskripsi.",
        });
      }
    });
    return results;
  } catch (err) {
    console.error("Scraping error:", err.message);
    return [];
  }
}

module.exports = function (app) {
  app.get("/search/nekopoi", async (req, res) => {
    const { q } = req.query;

    if (!q) {
      return res.status(400).json({
        status: false,
        creator: "Takanashi",
        message: "Parameter 'q' wajib diisi."
      });
    }

    if (typeof q !== "string" || q.trim().length === 0) {
      return res.status(400).json({
        status: false,
        creator: "Takanashi",
        message: "Parameter 'q' harus berupa string yang tidak kosong."
      });
    }

    try {
      const results = await scrapeNekopoiSearch(q.trim());
      
      if (!results || results.length === 0) {
        return res.status(404).json({
          status: false,
          creator: "Takanashi",
          message: "Tidak ada hasil yang ditemukan di Nekopoi."
        });
      }

      res.json({
        status: true,
        creator: "Takanashi",
        result: results
      });
    } catch (error) {
      console.error("Error Nekopoi Search:", error.message);
      
      res.status(500).json({
        status: false,
        creator: "Takanashi",
        message: "Gagal mengambil hasil pencarian dari Nekopoi.",
        error: error.message
      });
    }
  });
};