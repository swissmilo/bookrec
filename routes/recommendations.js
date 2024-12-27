const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const path = require('path');
const fs = require('fs');
const getHtmlHead = require('../utils/htmlHead');

router.get('/', async (req, res) => {
  const query = req.query.genre || '';
  let recommendationsHtml = '';

  if (query) {
    try {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key is not set.');
      }

      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });

      // Fetch content
      const booksData = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '..', 'public', 'books.json'),
          'utf8'
        )
      );
      const websiteContent = JSON.stringify(booksData);

      // Get 3 book recommendations from OpenAI
      const response = await openai.chat.completions.create({
        model: 'chatgpt-4o-latest',
        messages: [
          {
            role: 'user',
            content: `Provide me with 3 book recommendations for the following genre ${query}. The response has to be formatted as a valid HTML table, with columns for the title linking to Amazon, author name linking to their Wikipedia, and a description of the book. Don't include any other information besides the table itself. Only use books listed in the following JSON blob: ${websiteContent}`,
          },
        ],
      });
      recommendationsHtml = response.choices[0].message.content
        .replace(/^```html\s*/, '')
        .replace(/```$/, '');
      recommendationsHtml.replace(/<a\s+(.*?)>/g, (match, content) => {
        // Check if target="_blank" exists, and add it if missing
        if (!/target="_blank"/.test(content)) {
          content += ' target="_blank"';
        }
        if (!/rel="noopener noreferrer"/.test(content)) {
          content += ' rel="noopener noreferrer"';
        }
        return `<a ${content}>`;
      });
    } catch (error) {
      recommendationsHtml = `<p style="color:red;">Error fetching recommendations: ${error.message}</p>`;
    }
  }

  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead('Book Recommendations')}
    <body>
      <div class="win95-window">
        <div class="win95-titlebar">
          <span>Book Recommendations</span>
          <a href="/" class="win95-close">×</a>
        </div>
        <div class="win95-content">
          <form action="/recommendations" method="get" class="search-form" onsubmit="showSpinner()">
            <script>
              function showSpinner() {
                document.getElementById('spinner').style.display = 'block';
              }
            </script>
            <label for="genre">Enter a genre:</label>
            <input type="text" id="genre" name="genre" value="${query}" placeholder="e.g., scifi">
            <button type="submit">Search</button>
          </form>
          <div id="spinner" class="spinner"></div>
          ${query ? `<div class="recommendations">${recommendationsHtml}</div>` : ''}
        </div>
      </div>
    </body>
    </html>
  `);
});

module.exports = router;
