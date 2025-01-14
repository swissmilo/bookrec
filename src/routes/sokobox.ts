import { Router, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { getHtmlHead } from '../utils/htmlHead';
import supabase from '../utils/supabase';
import { AppError } from '../utils/errorHandler';
import { HighscoreEntry, HighscoreResponse } from '../types/index';
import { HighscoreRequestBody } from '../types/index';

const router = Router();

router.post(
  '/highscore',
  async (
    req: Request<{}, {}, HighscoreRequestBody>,
    res: Response<HighscoreResponse>,
    next: NextFunction
  ) => {
    const { level, time, name } = req.body;

    if (!level || !time || !name) {
      next(new AppError('Missing required fields', 400));
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from('highscores')
        .insert([{ level, name, time: parseFloat(time.toString()) }]);

      if (insertError) throw insertError;

      const { data: highscores, error: fetchError } = await supabase
        .from('highscores')
        .select('name, time')
        .eq('level', level)
        .order('time', { ascending: true })
        .limit(5);

      if (fetchError) throw fetchError;

      res.json({ success: true, highscores: highscores || [] });
    } catch (error) {
      next(new AppError('Error handling highscore', 500));
    }
  }
);

router.get(
  '/highscore/:level',
  async (
    req: Request<{ level: string }>,
    res: Response<{ scores: HighscoreEntry[] }>,
    next: NextFunction
  ) => {
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
      next(new AppError('Error fetching highscores', 500));
    }
  }
);

router.get('/', (req: Request, res: Response, next: NextFunction) => {
  const level = Number(
    req.query.level?.toString() || req.session.lastLevel || '1'
  );
  req.session.lastLevel = level;

  const levelPath = path.join(
    __dirname,
    '..',
    '..',
    'data/levels/',
    `${level}.lvl`
  );

  fs.readFile(levelPath, 'utf8', (err, data) => {
    if (err) {
      next(new AppError(`Error loading level: ${err.message}`, 500));
      return;
    }

    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      ${getHtmlHead('Sokobox')}
      <body>
        <div class="win95-window sokobox-window">
          <div class="win95-titlebar" role="banner">
            <span role="heading" aria-level="1">Sokobox</span>
            <a href="/" class="win95-close" aria-label="Close window">×</a>
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
          <div class="win95-titlebar" role="banner">
            <span role="heading" aria-level="2">Level Complete!</span>
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

export default router;
