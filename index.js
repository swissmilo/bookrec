const express = require('express');
const dotenv = require('dotenv');
const path = require('path');

// Import routes
const homeRouter = require('./routes/home');
const aboutRouter = require('./routes/about');
const libraryRouter = require('./routes/library');
const recommendationsRouter = require('./routes/recommendations');
const sokoboxRouter = require('./routes/sokobox');

dotenv.config();
const app = express();

const port = process.env.PORT || 3000;

// public folder for stylesheets
app.use(express.static(path.join(__dirname, 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Mount routes
app.use('/', homeRouter);
app.use('/about', aboutRouter);
app.use('/all-books', libraryRouter);
app.use('/recommendations', recommendationsRouter);
app.use('/sokobox', sokoboxRouter);

app.listen(port, () => {
  console.log(`Recommendation app listening on port ${port}`);
});

module.exports = app;
