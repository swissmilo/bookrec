import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import csv from 'csv-parser';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth } from '../middleware/auth';
import { Book, AddBookRequestBody } from '../types/index';
import { AppError } from '../utils/errorHandler';

const router = Router();

interface Highlight {
  [key: string]: string[];
}

// Load highlights from CSV file
const highlights: Highlight = {};
const highlightsFilePath = path.join(
  __dirname,
  '..',
  '..',
  'data',
  'highlights.csv'
);

fs.createReadStream(highlightsFilePath)
  .pipe(csv())
  .on('data', (row: { 'Amazon Book ID': string; Highlight: string }) => {
    const bookId = row['Amazon Book ID'];
    const quote = row['Highlight'];
    if (bookId && quote) {
      if (!highlights[bookId]) highlights[bookId] = [];
      highlights[bookId].push(quote);
    }
  })
  .on('error', (error: Error) => {
    console.error('Error loading highlights:', error);
  });

// Add new book endpoint
router.post(
  '/add',
  withAuth,
  async (
    req: Request<{}, {}, AddBookRequestBody>,
    res: Response,
    next: NextFunction
  ) => {
    try {
      let { category, name, author, link } = req.body;

      if (!category || !name || !author || !link) {
        throw new AppError('All fields are required', 400);
      }

      name = name.trim();
      author = author.trim();
      category = category.trim();
      link = link.trim();

      const booksPath = path.join(
        __dirname,
        '..',
        '..',
        'public',
        'books.json'
      );
      const booksData: Book[] = JSON.parse(fs.readFileSync(booksPath, 'utf8'));

      const newBook: Book = {
        category,
        name,
        author,
        link,
      };

      booksData.push(newBook);

      // Sort books
      booksData.sort((a: Book, b: Book) => {
        const aHasShortlist = a.category.toLowerCase().includes('shortlist');
        const bHasShortlist = b.category.toLowerCase().includes('shortlist');

        if (aHasShortlist && bHasShortlist) {
          const aYear = parseInt(a.category.match(/\d{4}/)?.[0] || '0');
          const bYear = parseInt(b.category.match(/\d{4}/)?.[0] || '0');
          return bYear - aYear;
        }

        if (aHasShortlist && !bHasShortlist) return -1;
        if (!aHasShortlist && bHasShortlist) return 1;

        return a.category.localeCompare(b.category);
      });

      fs.writeFileSync(booksPath, JSON.stringify(booksData, null, 2));
      res.redirect('/admin?add_book_success=true');
    } catch (error) {
      next(
        error instanceof AppError ? error : new AppError('Failed to add book')
      );
    }
  }
);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const booksPath = path.join(__dirname, '..', '..', 'public', 'books.json');
    const booksData: Book[] = JSON.parse(fs.readFileSync(booksPath, 'utf8'));
    const categories = [...new Set(booksData.map((book) => book.category))];
    const selectedCategory = req.query.category as string | null;

    const filteredBooks = selectedCategory
      ? booksData.filter((book) => book.category === selectedCategory)
      : booksData;

    let currentCategory = '';
    let tableRows = filteredBooks
      .map((book: Book) => {
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
                    ? `<div class="tooltip">
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
      .map(
        (cat) =>
          `<a href="/all-books?category=${encodeURIComponent(cat)}" class="category-link">${cat}</a>`
      )
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
          <div class="win95-titlebar" role="banner">
            <span role="heading" aria-level="1">Library</span>
            <a href="/" class="win95-close" aria-label="Close window">×</a>
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
    next(new AppError('Error loading books', 500));
  }
});

export default router;
