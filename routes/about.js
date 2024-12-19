const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
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

module.exports = router;
