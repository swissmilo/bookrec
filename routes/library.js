const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const getHtmlHead = require('../utils/htmlHead');

// Load highlights from CSV file
const highlights = {};
const highlightsFilePath = path.join(__dirname, '..', 'data', 'highlights.csv');
fs.createReadStream(highlightsFilePath)
  .pipe(csv())
  .on('data', (row) => {
    const bookId = row['Amazon Book ID'];
    const quote = row['Highlight'];
    if (bookId && quote) {
      if (!highlights[bookId]) highlights[bookId] = [];
      highlights[bookId].push(quote);
    }
  })
  .on('end', () => {
    //console.log('Highlights loaded successfully');
  });

router.get('/', (req, res) => {
  try {
    const booksData = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'public', 'books.json'),
        'utf8'
      )
    );
    const categories = [...new Set(booksData.map((book) => book.category))];
    const selectedCategory = req.query.category || null;

    let filteredBooks = selectedCategory
      ? booksData.filter((book) => book.category === selectedCategory)
      : booksData;

    let currentCategory = '';
    let tableRows = filteredBooks
      .map((book) => {
        let sectionHeader = '';
        if (book.category !== currentCategory) {
          currentCategory = book.category;
          sectionHeader = `<tr><th colspan="2" class="category-header">${currentCategory}</th></tr>`;
        }

        const bookIdMatch = book.link.match(
          /(?:product|dp)\/([A-Z0-9]+)(?:\/|$)/i
        );
        const bookId = bookIdMatch ? bookIdMatch[1] : null;
        const bookQuotes =
          bookId && highlights[bookId]
            ? highlights[bookId]
                .slice(0, 3)
                .map((quote) =>
                  quote.split(' ').length > 30
                    ? `${quote.split(' ').slice(0, 25).join(' ')}...`
                    : quote
                )
                .join('</li><li>')
            : 'No quotes available';

        return `
                  ${sectionHeader}
                  <tr class="book-row">
                      <td>
                          <div class="tooltip-container" onmousemove="showTooltip(event, this)" onmouseout="hideTooltip()">
                              <a href="${book.link}" target="_blank">${book.name}${book.author ? ` - ${book.author}` : ''}</a>
                              ${
                                bookQuotes !== 'No quotes available'
                                  ? `
                              <div class="tooltip">
                                  <strong>Example Highlights:</strong>
                                  <ul><li>${bookQuotes}</li></ul>
                              </div>`
                                  : ''
                              }
                          </div>
                      </td>
                  </tr>`;
      })
      .join('');

    const categoryLinks = categories
      .map((cat) => {
        return `<a href="/all-books?category=${encodeURIComponent(cat)}" class="category-link">${cat}</a>`;
      })
      .join(' | ');

    res.type('html').send(`
              <!DOCTYPE html>
              <html>
              ${getHtmlHead('Book Library')}
              <style>
                .category-header {
                    font-size: 1.4rem;
                    font-weight: bold;
                    background-color: #f6f9fc;
                    color: #32325d;
                    text-align: left;
                }
                .book-row td {
                    width: 100%;
                    padding: 12px;
                    border-bottom: 1px solid #ddd;
                    position: relative;
                }
                .category-link {
                    margin: 0 10px;
                    color: #5469d4;
                    text-decoration: none;
                    font-weight: bold;
                }
                .category-link:hover {
                    text-decoration: underline;
                }
                .tooltip-container {
                    position: relative;
                    display: inline-block;
                }
                .tooltip {
                    display: none;
                    position: fixed;
                    background-color: #fff;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                    padding: 10px;
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    z-index: 1000;
                    white-space: normal;
                    width: 400px;
                }
              </style>
              <script>
                let tooltip;
                function showTooltip(event, element) {
                    if (!tooltip) {
                        tooltip = document.createElement('div');
                        tooltip.className = 'tooltip';
                        document.body.appendChild(tooltip);
                    }
                    tooltip.innerHTML = element.querySelector('.tooltip').innerHTML;
                    tooltip.style.display = 'block';
                    tooltip.style.left = (event.clientX + 10) + 'px';
                    tooltip.style.top = (event.clientY + 10) + 'px';
                }
                function hideTooltip() {
                    if (tooltip) tooltip.style.display = 'none';
                }
              </script>
              </head>
              <body>
                  <div class="container">
                      <h1>All Books</h1>
                      <div class="categories">
                          <p>Filter by category: ${categoryLinks}</p>
                      </div>
                      <table>
                          <tbody>
                              ${tableRows}
                          </tbody>
                      </table>
                  </div>
              </body>
              </html>
          `);
  } catch (error) {
    res
      .status(500)
      .send(`<p style="color:red;">Error loading books: ${error.message}</p>`);
  }
});

module.exports = router;
