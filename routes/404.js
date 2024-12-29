const express = require('express');
const router = express.Router();
const getHtmlHead = require('../utils/htmlHead');

router.get('*', (req, res) => {
  res.status(404).send(`
    <!DOCTYPE html>
    <html lang="en">
    ${getHtmlHead('404 - Page Not Found')}
    <body>
      <div class="desktop">
        <div class="win95-window" style="max-width: 500px; margin: 50px auto;">
          <div class="win95-titlebar">
            <span>Error</span>
            <a href="/" class="win95-close">×</a>
          </div>
          <div class="win95-content" style="text-align: center;">
            <div style="font-size: 64px; margin: 20px 0;">💾</div>
            <h1 style="margin: 0; font-size: 24px;">Page Not Found</h1>
            </p>
            <a href="/" class="win95-button" style="text-decoration: none; display: inline-block;">Return Home</a>
          </div>
        </div>
      </div>
    </body>
    </html>
  `);
});

module.exports = router; 