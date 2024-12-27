const express = require('express');
const dotenv = require('dotenv').config();
const path = require('path');
const cookieParser = require('cookie-parser');
const { SitemapStream, streamToPromise } = require('sitemap');
const { Readable } = require('stream');

// Import routes
const homeRouter = require('./routes/home');
const aboutRouter = require('./routes/about');
const libraryRouter = require('./routes/library');
const recommendationsRouter = require('./routes/recommendations');
const sokoboxRouter = require('./routes/sokobox');
const adminRouter = require('./routes/admin');


const app = express();

const port = process.env.PORT || 3000;

// public folder for stylesheets
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Mount routes
app.use('/', homeRouter);
app.use('/about', aboutRouter);
app.use('/all-books', libraryRouter);
app.use('/recommendations', recommendationsRouter);
app.use('/sokobox', sokoboxRouter);
app.use('/admin', adminRouter);

/*
 * sitemap
 */
app.get('/sitemap.xml', async (req, res) => {
  const links = [
    { url: '/', changefreq: 'weekly' },
    { url: '/about', changefreq: 'weekly' },
    { url: '/all-books', changefreq: 'weekly' },
    { url: '/recommendations', changefreq: 'weekly' },
    { url: '/sokobox', changefreq: 'weekly' }
  ];

  try {
    const stream = new SitemapStream({ hostname: 'https://milo.run' });
    res.header('Content-Type', 'application/xml');
    
    return streamToPromise(Readable.from(links).pipe(stream)).then((data) => {
      res.send(data);
    });
  } catch (error) {
    console.log(error);
    res.status(500).end();
  }
});

app.listen(port, () => {
  console.log(`Recommendation app listening on port ${port}`);
});

module.exports = app;
