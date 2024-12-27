const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
const getHtmlHead = require('../utils/htmlHead');
const { withAuth, workos } = require('../middleware/auth');

// Add new book endpoint
router.post('/add', withAuth, async (req, res) => {
  try {
    const { category, name, author, link } = req.body;
    
    // Validate required fields
    if (!category || !name || !author || !link) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    name = name.trim();
    author = author.trim();
    category = category.trim();
    link = link.trim();

    // Read existing books
    const booksPath = path.join(__dirname, '..', 'public', 'books.json');
    const booksData = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

    // Add new book
    const newBook = {
      category,
      name,
      author,
      link
    };

    booksData.push(newBook);

    // Sort books: categories with "shortlist" first (newest year first), then others alphabetically
    booksData.sort((a, b) => {
      const aHasShortlist = a.category.toLowerCase().includes('shortlist');
      const bHasShortlist = b.category.toLowerCase().includes('shortlist');
      
      // If both are shortlists, sort by year in reverse order
      if (aHasShortlist && bHasShortlist) {
        const aYear = parseInt(a.category.match(/\d{4}/)?.[0] || '0');
        const bYear = parseInt(b.category.match(/\d{4}/)?.[0] || '0');
        return bYear - aYear; // Reverse order (newer years first)
      }
      
      // If only one is a shortlist, it should come first
      if (aHasShortlist && !bHasShortlist) return -1;
      if (!aHasShortlist && bHasShortlist) return 1;
      
      // Otherwise sort alphabetically
      return a.category.localeCompare(b.category);
    });

    // Write back to file
    fs.writeFileSync(booksPath, JSON.stringify(booksData, null, 2));

    // Redirect back to admin page with success message
    res.redirect('/admin?add_book_success=true');
  } catch (error) {
    console.error('Error adding book:', error);
    res.status(500).json({ error: 'Failed to add book' });
  }
});

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
                                  <strong>Personal Highlights:</strong>
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
              ${getHtmlHead('Library')}
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
              <body>
                  <div class="win95-window">
                      <div class="win95-titlebar">
                          <span>Library</span>
                          <a href="/" class="win95-close">×</a>
                      </div>
                      <div class="win95-content">
                          <div class="categories">
                              <p>Filter by category: ${categoryLinks}</p>
                          </div>
                          <table>
                              <tbody>
                                  ${tableRows}
                              </tbody>
                          </table>
                      </div>
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
