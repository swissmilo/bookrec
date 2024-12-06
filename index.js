const express = require('express')

const OpenAI = require("openai")
const dotenv = require('dotenv')
const path = require('path')
const axios = require('axios')
const cheerio = require('cheerio')
const expressOasGenerator = require('express-oas-generator')

dotenv.config()
const app = express()
expressOasGenerator.init(app, {
    writeIntervalMs: 0, // Write immediately after an endpoint is accessed
    writeSpec: true,    // Persist the spec to `oas.json`
    specOutputPath: './oas.json' // Path to save the file
  });

const port = process.env.PORT || 3000

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

app.get('/', async (req, res) => {

    res.send('Usage: /books?genre=genre_name')
})

app.get('/books', async (req, res) => {
    try {
        const query = req.query.genre  || 'switzerland'
        //console.log(`Query is ${query}`)

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OpenAI API key is not set.');
        }

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        const url = 'https://www.milo.run';

        // Fetch content
        const webdata = await axios.get(url);

        // Store content in a variable
        const websiteContent = webdata.data;

            // Load the HTML into Cheerio
        //const $ = cheerio.load(websiteContent);

        // Extract the content within <div class="post-outer">
        //const bookContent = $('.post-outer').html();
        //console.log(bookContent);

        // Check if content exists
        /*if (!bookContent) {
        return res.status(404).send('No content found within div class="post-outer".');
        }*/

        const response = await openai.chat.completions.create({
            model: "chatgpt-4o-latest",
            messages: [{ role: "user", content: `Provide me with 3 book recommendations for the following genre ${query}. The response has to be formatted as a valid HTML table, with columsn for the title linking to Amazon, author name linking to their Wikipedia, and a description of the book. Don't include any other information besides the table itself. Only use titles listed here: ${websiteContent}` }],
        });

        const recommendationsHtml = response.choices[0].message.content.replace(/^```html\s*/, '').replace(/```$/, '');
        //res.set('Content-Type', 'text/html');
        //res.type('html').send(recommendationsHtml);

        //res.send(response.choices[0].message.content);
        //res.json({ text: response.choices[0].message.content });

        //const recommendationsHtml = response.choices[0].message.content

        res.type('html').send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>Milo's Book Store</title>
              <link rel="stylesheet" href="/style.css">
            </head>
            <body>
                <div class="container">
                <h1>Milo's Book Store</h1>
                <form action="/books" method="get" class="search-form">
                    <label for="genre">Enter a genre:</label>
                    <input type="text" id="genre" name="genre" value="${query}" placeholder="e.g., scifi">
                    <button type="submit">Search</button>
                </form>
                <h2>Recommendations for "${query}"</h2>
                <div class="recommendations">
                    ${recommendationsHtml}
                </div>
                </div>
            </body>
            </html>
          `);

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

app.listen(port, () => {
    console.log(`Recommendation app listening on port ${port}`)
})

const fs = require('fs');

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