const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const getHtmlHead = require('../utils/htmlHead');

router.get('/', (req, res) => {
  const level = req.query.level || '1';
  const levelPath = path.join(__dirname, '..', 'data/levels/', level + '.lvl');

  fs.readFile(levelPath, 'utf8', (err, data) => {
    if (err) {
      console.error(`Error loading level file: ${err.message}`);
      res.status(500).send(`Error loading level: ${err.message}`);
      return;
    }

    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        ${getHtmlHead('Sokobox')}
        <style>
            canvas { background: #ddd; display: block; margin: 20px auto; }
        </style>
        <body>
            <canvas id="gameCanvas" width="900" height="720"></canvas>
            <div class="controls-container">
                <div class="vertical-controls">
                    <button class="control-button up">▲</button>
                </div>
                <div class="horizontal-controls">
                    <button class="control-button left">◀</button>
                    <button class="control-button down">▼</button>
                    <button class="control-button right">▶</button>
                </div>
            </div>
            <script>
                const levelData = \`${data}\`;
            </script>
            <script src="/sokobox/sokobox.js"></script>
        <script>
                loadLevel(levelData);

                const upButton = document.querySelector('.control-button.up');
                const downButton = document.querySelector('.control-button.down'); 
                const leftButton = document.querySelector('.control-button.left');
                const rightButton = document.querySelector('.control-button.right');

                upButton.addEventListener('click', () => movePlayer(0, -1));
                downButton.addEventListener('click', () => movePlayer(0, 1));
                leftButton.addEventListener('click', () => movePlayer(-1, 0));
                rightButton.addEventListener('click', () => movePlayer(1, 0));

                upButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    movePlayer(0, -1);
                });
                downButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    movePlayer(0, 1);
                });
                leftButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    movePlayer(-1, 0);
                });
                rightButton.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    movePlayer(1, 0);
                });

            </script>
        </body>
        </html>
    `);
  });
});

module.exports = router;
