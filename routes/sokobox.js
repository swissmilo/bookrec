const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const getHtmlHead = require('../utils/htmlHead');

// Load highscores from JSON file
let highscores = {};
try {
  const scoresPath = path.join(__dirname, '..', 'data', 'highscores.json');
  if (fs.existsSync(scoresPath)) {
    highscores = JSON.parse(fs.readFileSync(scoresPath, 'utf8'));
  }
} catch (error) {
  console.error('Error loading highscores:', error);
  highscores = {};
}

// Save highscores to file
function saveHighscores() {
  const scoresPath = path.join(__dirname, '..', 'data', 'highscores.json');
  fs.writeFileSync(scoresPath, JSON.stringify(highscores, null, 2));
}

// Add a new highscore
router.post('/highscore', (req, res) => {
  const { level, time, name } = req.body;
  
  if (!level || !time || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Initialize level highscores if not exists
  if (!highscores[level]) {
    highscores[level] = [];
  }

  // Add new score
  highscores[level].push({
    name,
    time: parseFloat(time)
  });

  // Sort by time and keep top 5
  highscores[level].sort((a, b) => a.time - b.time);
  highscores[level] = highscores[level].slice(0, 5);

  // Save to file
  saveHighscores();

  res.json({ success: true, highscores: highscores[level] });
});

// Get highscores for a level
router.get('/highscore/:level', (req, res) => {
  const { level } = req.params;
  res.json({
    scores: highscores[level] || []
  });
});

router.get('/', (req, res) => {
  const level = req.query.level || req.session.lastLevel || '1';
  req.session.lastLevel = level;

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
        <body>
            <div class="win95-window sokobox-window">
                <div class="win95-titlebar">
                    <span>Sokobox</span>
                    <a href="/" class="win95-close">×</a>
                </div>
                <div class="win95-content">
                    <canvas id="gameCanvas" width="900" height="720" data-original-width="900" data-original-height="720"></canvas>
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
                </div>
            </div>

            <!-- Highscore Modal -->
            <div id="highscoreModal" class="win95-window" style="display: none; position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000; width: 300px;">
                <div class="win95-titlebar">
                    <span>Level Complete!</span>
                </div>
                <div class="win95-content">
                    <div id="completionTime"></div>
                    <div id="highscoreList">
                        <h3>Top Scores</h3>
                        <table class="win95-table">
                            <thead>
                                <tr>
                                    <th>Rank</th>
                                    <th>Name</th>
                                    <th>Time</th>
                                </tr>
                            </thead>
                            <tbody id="highscoreTableBody"></tbody>
                        </table>
                    </div>
                    <button onclick="closeHighscoreModal()" class="win95-button" style="margin-top: 15px;">Continue</button>
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
