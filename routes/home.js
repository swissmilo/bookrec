const express = require('express');
const router = express.Router();
const getHtmlHead = require('../utils/htmlHead');

router.get('/', (req, res) => {
  res.type('html').send(`
        <!DOCTYPE html>
        <html>
        ${getHtmlHead('Milo\'s Personal Website')}
        <body>
            <div class="container">
                <h1>Welcome to Milo's Personal Website</h1>
                <nav>
                    <ul>
                        <li><a href="/about">About</a></li>
                        <li><a href="/all-books">Library</a></li>
                        <li><a href="/recommendations">Recommendations</a></li>
                        <li><a href="/sokobox">Games</a></li>
                    </ul>
                </nav>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
