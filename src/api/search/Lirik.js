const fetch = require("node-fetch");
const cheerio = require("cheerio");

module.exports = function (app) {
  app.get("/search/lyrics", async (req, res) => {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({
        status: false,
        message: "Parameter 'query' wajib diisi (judul lagu)"
      });
    }

    try {
      const response = await fetch(`https://r.jina.ai/https://www.google.com/search?q=lirik+lagu+${encodeURIComponent(query)}&hl=en`, {
        headers: {
          "x-return-format": "html",
          "x-engine": "cf-browser-rendering"
        }
      });

      const html = await response.text();
      const $ = cheerio.load(html);
      const lirik = [];
      const output = [];
      const result = {};

      $("div.PZPZlf").each((i, e) => {
        const penemu = $(e).find('div[jsname="U8S5sf"]').text().trim();
        if (!penemu) output.push($(e).text().trim());
      });

      $("div[jsname='U8S5sf']").each((i, el) => {
        let out = "";
        $(el).find("span[jsname='YS01Ge']").each((_, span) => {
          out += $(span).text() + "\n";
        });
        lirik.push(out.trim());
      });

      result.lyrics = lirik.join("\n\n");
      result.title = output.shift();
      result.subtitle = output.shift();
      result.platform = output.filter(_ => !_.includes(":"));

      output.forEach(_ => {
        if (_.includes(":")) {
          const [name, value] = _.split(":");
          result[name.toLowerCase()] = value.trim();
        }
      });

      if (!result.lyrics) {
        return res.status(404).json({
          status: false,
          message: "Lirik tidak ditemukan!"
        });
      }

      res.json({
        status: true,
        creator: "FlowFalcon",
        result
      });

    } catch (err) {
      res.status(500).json({
        status: false,
        message: "Gagal mengambil lirik.",
        error: err.message
      });
    }
  });
};
