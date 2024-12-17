const express = require('express')

const OpenAI = require("openai")
const dotenv = require('dotenv')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const expressOasGenerator = require('express-oas-generator')

dotenv.config()
const app = express()
expressOasGenerator.init(app, {
    writeIntervalMs: 0, // Write immediately after an endpoint is accessed
    writeSpec: true,    // Persist the spec to `oas.json`
    specOutputPath: './oas.json' // Path to save the file
});

const port = process.env.PORT || 3000

// public folder for stylesheets
app.use(express.static(path.join(__dirname, 'public')))

app.use(express.urlencoded({ extended: true }))
app.use(express.json())

// Main landing page
app.get('/', (req, res) => {
    res.type('html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Home</title>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="container">
                <h1>Welcome to Milo's Personal Website</h1>
                <nav>
                    <ul>
                        <li><a href="/about">About</a></li>
                        <li><a href="/all-books">Library</a></li>
                        <li><a href="/books">Recommendations</a></li>
                    </ul>
                </nav>
            </div>
        </body>
        </html>
    `);
});

// About page
app.get('/about', (req, res) => {
    res.type('html').send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>About Milo</title>
          <link rel="stylesheet" href="/style.css">
        </head>
        <body>
            <div class="container">
                <h1>About Me</h1>
                <p>Hi, I'm Milo Spirig. I'm born and raised in Switzerland and currently live in NYC.</p>
                <p>Find me here:</p>
                <ul>
                    <li><a href="https://www.linkedin.com/in/milospirig/" target="_blank">LinkedIn</a></li>
                    <li><a href="https://twitter.com/SwissMilo" target="_blank">Twitter</a></li>
                    <li><a href="https://github.com/swissmilo" target="_blank">GitHub</a></li>
                </ul>
            </div>
        </body>
        </html>
    `);
});

// Books page
app.get('/all-books', (req, res) => {
    try {
        const booksData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'books.json'), 'utf8'));
        const categories = [...new Set(booksData.map(book => book.category))];
        const selectedCategory = req.query.category || null;

        let filteredBooks = selectedCategory 
            ? booksData.filter(book => book.category === selectedCategory) 
            : booksData;

        let currentCategory = '';
        let tableRows = filteredBooks.map(book => {
            let sectionHeader = '';
            if (book.category !== currentCategory) {
                currentCategory = book.category;
                sectionHeader = `<tr><th colspan="2" class="category-header">${currentCategory}</th></tr>`;
            }
            return `${sectionHeader}<tr><td><a href="${book.link}" target="_blank">${book.name}${book.author ? ` - ${book.author}` : ''}</a></td></tr>`;
        }).join('');

        const categoryLinks = categories.map(cat => {
            return `<a href="/all-books?category=${encodeURIComponent(cat)}" class="category-link">${cat}</a>`;
        }).join(' | ');

        res.type('html').send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>All Books</title>
              <link rel="stylesheet" href="/style.css">
              <style>
                .category-header {
                    font-size: 1.4rem;
                    font-weight: bold;
                    background-color: #f6f9fc;
                    color: #32325d;
                    text-align: left;
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
              </style>
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
        res.status(500).send(`<p style="color:red;">Error loading books: ${error.message}</p>`);
    }
});

// Recommendations page
app.get('/books', async (req, res) => {
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
            const booksData = JSON.parse(fs.readFileSync(path.join(__dirname, 'public', 'books.json'), 'utf8'));
            const websiteContent = JSON.stringify(booksData);

            // Get 3 book recommendations from OpenAI
            const response = await openai.chat.completions.create({
                model: "chatgpt-4o-latest",
                messages: [{ role: "user", content: `Provide me with 3 book recommendations for the following genre ${query}. The response has to be formatted as a valid HTML table, with columns for the title linking to Amazon, author name linking to their Wikipedia, and a description of the book. Don't include any other information besides the table itself. Only use books listed in the following JSON blob: ${websiteContent}` }],
            });
            recommendationsHtml = response.choices[0].message.content.replace(/^```html\s*/, '').replace(/```$/, '');
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
        <head>
          <title>Milo's Book Recommendations</title>
          <link rel="stylesheet" href="/style.css">
          <style>
            .spinner {
                display: none;
                margin: 20px auto;
                width: 50px;
                height: 50px;
                border: 8px solid #f3f3f3;
                border-top: 8px solid #3498db;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
          </style>
          <script>
            function showSpinner() {
                document.getElementById('spinner').style.display = 'block';
            }
          </script>
        </head>
        <body>
            <div class="container">
            <h1>Milo's Book Recommendations</h1>
            <form action="/books" method="get" class="search-form" onsubmit="showSpinner()">
                <label for="genre">Enter a genre:</label>
                <input type="text" id="genre" name="genre" value="${query}" placeholder="e.g., scifi">
                <button type="submit">Search</button>
            </form>
            <div id="spinner" class="spinner"></div>
            ${query ? `<h2>Recommendations for "${query}"</h2><div class="recommendations">${recommendationsHtml}</div>` : ''}
            </div>
        </body>
        </html>
    `);
});

app.listen(port, () => {
    console.log(`Recommendation app listening on port ${port}`)
})

// Save updated OAS spec to file when the server is stopped
const saveSpecToFile = () => {
  const spec = expressOasGenerator.getSpec();
  fs.writeFileSync('./oas.json', JSON.stringify(spec, null, 2));
};

process.on('SIGINT', function() {
    saveSpecToFile
    process.exit();
  });
process.on('exit', function() {
saveSpecToFile
process.exit();
});

module.exports = app;
