const express = require('express')
const app = express()
const OpenAI = require("openai");
const dotenv = require('dotenv')

const port = process.env.PORT || 3000

dotenv.config()

app.use(express.json())

app.get('/', (req, res) => {
    res.send('Hello Worlds!')
})

app.get('/books', async (req, res) => {
    try {
        var query = req.query.genre;
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


        const response = await openai.chat.completions.create({
            model: "chatgpt-4o-latest",
            messages: [{ role: "user", content: `Provide me with 3 book recommendations for the following genre ${query}. The response has to be formatted in HTML` }],
        });

        res.set('Content-Type', 'text/html');
        res.send(Buffer.from(response.choices[0].message.content));
        //res.json({ text: response.choices[0].message.content });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
})

app.listen(port, () => {
    console.log(`Recommendation app listening on port ${port}`)
})