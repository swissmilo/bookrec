import { Router, Request, Response, NextFunction } from 'express';
import OpenAI from 'openai';
import path from 'path';
import fs from 'fs';
import { getHtmlHead } from '../utils/htmlHead';
import { Book } from '../types/index';
import { AppError } from '../utils/errorHandler';

interface RecommendationsQuery {
  genre?: string;
}

const router = Router();

router.get(
  '/',
  async (
    req: Request<{}, {}, {}, RecommendationsQuery>,
    res: Response,
    next: NextFunction
  ) => {
    const query = req.query.genre || '';
    let recommendationsHtml = '';

    if (query) {
      try {
        if (!process.env.OPENAI_API_KEY) {
          throw new AppError('OpenAI API key is not set.', 500);
        }

        const openai = new OpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });

        // Fetch content and strip unnecessary data
        const booksPath = path.join(
          __dirname,
          '..',
          '..',
          'public',
          'books.json'
        );
        const booksData: Book[] = JSON.parse(
          fs.readFileSync(booksPath, 'utf8')
        );
        // Only send name, author, and link to OpenAI
        const simplifiedBooks = booksData.map(({ name, author, link }) => ({
          name,
          author,
          link
        }));
        const websiteContent = JSON.stringify(simplifiedBooks);
        //console.log(websiteContent);

        try {
          const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
              {
                role: 'user',
                content: `Provide me with 3 book recommendations for the following genre ${query}. The response has to be formatted as a valid HTML table, with columns for the title linking to Amazon, author name linking to their Wikipedia, and a description of the book. Don't include any other information besides the table itself. Only use books listed in the following JSON blob: ${websiteContent}`,
              },
            ],
          });

          recommendationsHtml = response.choices[0].message.content || '';
          recommendationsHtml = recommendationsHtml
            .replace(/^```html\s*/, '')
            .replace(/```$/, '')
            .replace(/<a\s+(.*?)>/g, (match, content) => {
              if (!/target="_blank"/.test(content)) {
                content += ' target="_blank"';
              }
              if (!/rel="noopener noreferrer"/.test(content)) {
                content += ' rel="noopener noreferrer"';
              }
              return `<a ${content}>`;
            });
        } catch (openaiError) {
          console.error('OpenAI API Error:', openaiError);
          throw new AppError(`OpenAI API Error: ${(openaiError as Error).message}`, 500);
        }
      } catch (error) {
        console.error('Full error:', error);
        next(
          error instanceof AppError
            ? error
            : new AppError('Error fetching recommendations')
        );
        return;
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
  }
);

export default router;
