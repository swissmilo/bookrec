const express = require('express')

const OpenAI = require("openai")
const dotenv = require('dotenv')
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

app.use(express.json())

app.get('/', async (req, res) => {

    res.send('Usage: /books?genre=genre_name')
})

app.get('/books', async (req, res) => {
    try {
        const query = req.query.genre;
        //console.log(`Query is ${query}`)
        if (!query) {
            return res.status(400).json({ error: 'Genre is required' });
        }

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
            messages: [{ role: "user", content: `Provide me with 3 book recommendations for the following genre ${query}. Include the title, author name, Amazon link, and a description of the book. The response has to be formatted in HTML. Only use titles listed here: ${websiteContent}` }],
        });

        const cleanedContent = response.choices[0].message.content.replace(/^```html\s*/, '').replace(/```$/, '');
        res.set('Content-Type', 'text/html');
        res.type('html').send(cleanedContent);
        //res.send(response.choices[0].message.content);
        //res.json({ text: response.choices[0].message.content });

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