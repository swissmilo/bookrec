const express = require('express');
const router = express.Router();
const getHtmlHead = require('../utils/htmlHead');

router.get('/', (req, res) => {
  res.type('html').send(`
        <!DOCTYPE html>
        <html>
        ${getHtmlHead('Milo\'s Personal Website')}
        <body>
            <div class="desktop">
                <div class="desktop-icons">
                    <a href="/about" class="desktop-icon">
                        <div class="icon-img">👤</div>
                    </a>
                    <a href="/all-books" class="desktop-icon">
                        <div class="icon-img">📚</div>
                    </a>
                    <a href="/recommendations" class="desktop-icon">
                        <div class="icon-img">💡</div>
                    </a>
                    <a href="/sokobox" class="desktop-icon">
                        <div class="icon-img">🎮</div>
                    </a>
                </div>
            </div>
        </body>
        </html>
    `);
});

module.exports = router;
