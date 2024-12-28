const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const getHtmlHead = require('../utils/htmlHead');
const supabase = require('../utils/supabase');

router.post('/highscore', async (req, res) => {
  const { level, time, name } = req.body;
  
  if (!level || !time || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Insert the new score
    const { error: insertError } = await supabase
      .from('highscores')
      .insert([{ level, name, time: parseFloat(time) }]);

    if (insertError) throw insertError;

    // Get top 5 scores for this level
    const { data: highscores, error: fetchError } = await supabase
      .from('highscores')
      .select('name, time')
      .eq('level', level)
      .order('time', { ascending: true })
      .limit(5);

    if (fetchError) throw fetchError;

    res.json({ success: true, highscores });
  } catch (error) {
    console.error('Error handling highscore:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/highscore/:level', async (req, res) => {
  const { level } = req.params;
  try {
    const { data: scores, error } = await supabase
      .from('highscores')
      .select('name, time')
      .eq('level', level)
      .order('time', { ascending: true })
      .limit(5);

    if (error) throw error;

    res.json({ scores: scores || [] });
  } catch (error) {
    console.error('Error fetching highscores:', error);
    res.status(500).json({ error: 'Server error' });
  }
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
