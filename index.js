const express = require('express');
const dotenv = require('dotenv').config();
const path = require('path');
const cookieParser = require('cookie-parser');

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

app.listen(port, () => {
  console.log(`Recommendation app listening on port ${port}`);
});

module.exports = app;
