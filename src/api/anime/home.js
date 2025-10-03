const axios = require('axios');
const cheerio = require('cheerio');

module.exports = function(app) {
  app.get('/anime/doujin/home', async (req, res) => {
    const page = req.query.page || 1;
    const url = `https://www.maid.my.id/page/${page}/`;

    try {
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);
      const mangaList = [];

      const containers = ['.flexbox3', '.flexbox4'];
      for (const container of containers) {
        $(container).find('.flexbox3-item, .flexbox4-item').each((_, element) => {
          const title = $(element).find('.title a').text().trim();
          const mangaUrl = $(element).find('.title a').attr('href');
          const image = $(element).find('.flexbox3-thumb img, .flexbox4-thumb img').attr('src');

          const chapters = [];
          $(element).find('.chapter li').each((_, chEl) => {
            chapters.push({
              chapterTitle: $(chEl).find('a').text().trim(),
              chapterUrl: $(chEl).find('a').attr('href'),
              date: $(chEl).find('.date').text().trim()
            });
          });

          mangaList.push({
            title,
            url: mangaUrl,
            image,
            chapters
          });
        });
      }

      res.json({
        status: true,
        creator: 'FlowFalcon',
        page: parseInt(page),
        result: mangaList
      });

    } catch (err) {
      res.status(500).json({
        status: false,
        creator: 'FlowFalcon',
        message: 'Gagal scrape data',
        error: err.message
      });
    }
  });
};
