const TILE_SIZE = 40; // Size of each tile
const WIDTH = 30,
  HEIGHT = 30; // Game grid dimensions

// Tile codes
const LVL_CLEAR = 0,
  LVL_FLOOR = 1,
  LVL_WALL = 2,
  LVL_GOAL = 3,
  LVL_FLOOR_BOX = 4,
  LVL_GOAL_BOX = 5;
const PLY_UP = 0,
  PLY_DOWN = 1,
  PLY_LEFT = 2,
  PLY_RIGHT = 3;

// Game variables
let player = { x: 0, y: 0, state: PLY_UP, push: false };
let level = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(LVL_CLEAR));
let moveHistory = [];
let moves = 0,
  pushes = 0;
let levelComplete = false;
let levelStartTime = null;
let levelTime = 0;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const images = {};

const imagePaths = {
  LVL_CLEAR: './clear.png',
  LVL_WALL: './wall.png',
  LVL_GOAL: './goal.png',
  LVL_FLOOR: './floor.png',
  LVL_FLOOR_BOX: './box.png',
  LVL_GOAL_BOX: './goalbox.png',
  PLY_UP: './player_u.png',
  PLY_DOWN: './player_d.png',
  PLY_LEFT: './player_l.png',
  PLY_RIGHT: './player_r.png',
  PUSH_PLY_UP: './pushplay_u.png',
  PUSH_PLY_DOWN: './pushplay_d.png',
  PUSH_PLY_LEFT: './pushplay_l.png',
  PUSH_PLY_RIGHT: './pushplay_r.png',
};

const preloadPromises = Object.entries(imagePaths).map(([key, path]) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.src = path;
    images[key] = img;
  });
});

// Load a level file (equivalent to LoadLevel)
function loadLevel(levelData) {
  Promise.all(preloadPromises)
    .then(() => {
      let lines = levelData.split('\n');
      level = Array.from({ length: HEIGHT }, () =>
        Array(WIDTH).fill(LVL_CLEAR)
      );
      let yOffset = 0; //Math.floor((HEIGHT - lines.length) / 2);
      let xOffset = 0; //Math.floor((WIDTH - lines[0].length) / 2);

      lines.forEach((line, y) => {
        [...line].forEach((char, x) => {
          let tile = LVL_CLEAR;
          if (char === '#') tile = LVL_WALL;
          if (char === '.') tile = LVL_GOAL;
          if (char === '$') tile = LVL_FLOOR_BOX;
          if (char === '%') tile = LVL_GOAL_BOX;
          if (char === '-') tile = LVL_FLOOR;
          if (char === '@') {
            tile = LVL_FLOOR;
            player.x = x + xOffset;
            player.y = y + yOffset;
          }
          level[y + yOffset][x + xOffset] = tile;
        });
      });

      console.table(level);

      moves = pushes = 0;
      moveHistory = [];
      levelStartTime = Date.now();
      levelTime = 0;
      drawLevel();
    })
    .catch((err) => {
      console.error('Error preloading images:', err);
    });
}

// Move player (equivalent to Move)
function movePlayer(dx, dy) {
  const direction =
    dx === -1 ? PLY_LEFT : dx === 1 ? PLY_RIGHT : dy === -1 ? PLY_UP : PLY_DOWN;

  //const dx = direction === PLY_LEFT ? -1 : direction === PLY_RIGHT ? 1 : 0;
  //const dy = direction === PLY_UP ? -1 : direction === PLY_DOWN ? 1 : 0;

  let newX = player.x + dx;
  let newY = player.y + dy;
  let nextX = player.x + 2 * dx;
  let nextY = player.y + 2 * dy;

  player.state = direction;

  player.push = false;

  if (isWalkable(newX, newY)) {
    moveHistory.push({ ...player });
    player.x = newX;
    player.y = newY;
    moves++;
  } else if (isBox(newX, newY) && isWalkable(nextX, nextY)) {
    moveHistory.push({
      x: player.x,
      y: player.y,
      state: player.state,
      box: { from: { x: newX, y: newY }, to: { x: nextX, y: nextY } },
      push: true,
    });

    // Update the box's position
    level[newY][newX] = isGoal(newX, newY) ? LVL_GOAL : LVL_FLOOR;
    level[nextY][nextX] = isGoal(nextX, nextY) ? LVL_GOAL_BOX : LVL_FLOOR_BOX;

    player.x = newX;
    player.y = newY;
    pushes++;
  }

  checkCompletion();
  drawLevel();
}

// Undo last move
function undoMove() {
  if (moveHistory.length === 0) return;

  const lastMove = moveHistory.pop();
  player.x = lastMove.x;
  player.y = lastMove.y;
  player.state = lastMove.state;

  // Reverse box movements if any
  if (lastMove.box) {
    const { from, to } = lastMove.box;

    // Move the box back to its original position
    level[to.y][to.x] = isGoal(to.x, to.y) ? LVL_GOAL : LVL_FLOOR;
    level[from.y][from.x] = isGoal(from.x, from.y)
      ? LVL_GOAL_BOX
      : LVL_FLOOR_BOX;
  }

  moves--;
  if (lastMove.push) pushes--;

  drawLevel();
}

// Helpers
function isWalkable(x, y) {
  return [LVL_FLOOR, LVL_GOAL].includes(level[y][x]);
}
function isBox(x, y) {
  return [LVL_FLOOR_BOX, LVL_GOAL_BOX].includes(level[y][x]);
}
function isGoal(x, y) {
  //return level[y][x] === LVL_GOAL;
  return [LVL_GOAL, LVL_GOAL_BOX].includes(level[y][x]);
}

// Check if level is complete
async function checkCompletion() {
  levelComplete = !level.flat().includes(LVL_GOAL);
  if (levelComplete) {
    levelTime = (Date.now() - levelStartTime) / 1000;
    console.log('Level completed!');
    await submitHighscore();
  }
}

function fadeOutAndLoadNextLevel() {
  const canvas = document.getElementById('gameCanvas');
  let opacity = 1;

  // Gradually decrease the opacity to create a fade-out effect
  const fadeOut = setInterval(() => {
    opacity -= 0.05;
    canvas.style.opacity = opacity;
    if (opacity <= 0) {
      clearInterval(fadeOut);
      loadNextLevel();
    }
  }, 50);
}

function loadNextLevel() {
  const currentLevel = parseInt(
    new URLSearchParams(window.location.search).get('level') || '1'
  );
  const nextLevel = currentLevel + 1;

  // Attempt to load the next level
  fetch(`/sokobox?level=${nextLevel}`)
    .then((response) => {
      if (response.ok) {
        window.location.href = `/sokobox?level=${nextLevel}`;
      } else {
        alert('Congratulations! No more levels available.');
        window.location.href = `/sokobox?level=1`; // Restart the game from level 1 or go to a different page
      }
    })
    .catch((err) => {
      console.error(`Error loading next level: ${err.message}`);
      alert('Error loading next level.');
    });
}

// Draw the level
function drawLevel() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Centering offsets
  const xOffset = 0;
  const yOffset = 0;

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      let tile = level[y][x];
      let imageKey;

      if (tile === LVL_CLEAR) imageKey = 'LVL_CLEAR';
      if (tile === LVL_WALL) imageKey = 'LVL_WALL';
      if (tile === LVL_GOAL) imageKey = 'LVL_GOAL';
      if (tile === LVL_FLOOR_BOX) imageKey = 'LVL_FLOOR_BOX';
      if (tile === LVL_GOAL_BOX) imageKey = 'LVL_GOAL_BOX';
      if (tile === LVL_FLOOR) imageKey = 'LVL_FLOOR';

      if (imageKey) {
        ctx.drawImage(
          images[imageKey],
          x * TILE_SIZE + xOffset,
          y * TILE_SIZE + yOffset,
          TILE_SIZE,
          TILE_SIZE
        );
      }
    }
  }
  ctx.drawImage(
    player.push
      ? images[`PUSH_PLY_${['UP', 'DOWN', 'LEFT', 'RIGHT'][player.state]}`]
      : images[`PLY_${['UP', 'DOWN', 'LEFT', 'RIGHT'][player.state]}`],
    player.x * TILE_SIZE + xOffset,
    player.y * TILE_SIZE + yOffset,
    TILE_SIZE,
    TILE_SIZE
  );
}

// Adjusted drawTile function with offsets
function drawTile(x, y, color, xOffset = 0, yOffset = 0) {
  ctx.fillStyle = color;
  ctx.fillRect(
    x * TILE_SIZE + xOffset,
    y * TILE_SIZE + yOffset,
    TILE_SIZE,
    TILE_SIZE
  );
}

// Input handling
document.addEventListener('keydown', (e) => {
  if (
    e.key === 'ArrowUp' ||
    e.key === 'ArrowDown' ||
    e.key === 'ArrowLeft' ||
    e.key === 'ArrowRight'
  ) {
    e.preventDefault(); // Prevent scrolling
    if (e.key === 'ArrowUp') movePlayer(0, -1);
    if (e.key === 'ArrowDown') movePlayer(0, 1);
    if (e.key === 'ArrowLeft') movePlayer(-1, 0);
    if (e.key === 'ArrowRight') movePlayer(1, 0);
  }
  if (e.key === 'z') undoMove(); // Undo
});

function resizeCanvas() {
  const canvas = document.getElementById('gameCanvas');
  const originalWidth = parseInt(canvas.dataset.originalWidth);
  const originalHeight = parseInt(canvas.dataset.originalHeight);
  
  const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
  };
  
  // Calculate the maximum size that maintains the game's aspect ratio
  const gameAspectRatio = originalWidth / originalHeight;
  const viewportAspectRatio = viewport.width / viewport.height;
  
  let newWidth, newHeight;
  
  if (viewportAspectRatio > gameAspectRatio) {
      // Viewport is wider than game ratio
      newHeight = viewport.height * 0.80; // 90% of viewport height
      newWidth = newHeight * gameAspectRatio;
  } else {
      // Viewport is taller than game ratio
      newWidth = viewport.width * 0.90; // 90% of viewport width
      newHeight = newWidth / gameAspectRatio;
  }
  
  canvas.style.width = `${newWidth}px`;
  canvas.style.height = `${newHeight}px`;
  
  // Maintain internal canvas resolution
  canvas.width = originalWidth;
  canvas.height = originalHeight;
}

// Load a test level
window.addEventListener('load', () => {
  Promise.all(preloadPromises).then(() => {
    console.log('All images preloaded.');
  });
  resizeCanvas();
  drawLevel();
});

window.addEventListener('resize', () => {
  Promise.all(preloadPromises).then(() => {
    console.log('All images preloaded.');
  });
  resizeCanvas();
  drawLevel();
});

/*loadLevel(
`    #####
    #---#
    #$--#
  ###--$##
  #--$-$-#
###-#-##-#   ######
#---#-##-#####--..#
#-$--$----------..#
#####-###-#@##--..#
    #-----#########
    #######`);
*/

// Submit highscore
async function submitHighscore() {
  const currentLevel = parseInt(
    new URLSearchParams(window.location.search).get('level') || '1'
  );
  
  const playerName = localStorage.getItem('playerName');
  if (!playerName) {
    // Ask for player name if not stored
    const name = prompt('Enter your nickname for the highscore:');
    if (name) {
      localStorage.setItem('playerName', name);
    } else {
      // If user cancels prompt, use 'Anonymous'
      localStorage.setItem('playerName', 'Anonymous');
    }
  }

  // Get the name again after potentially setting it
  const finalName = localStorage.getItem('playerName');

  const payload = {
    level: currentLevel.toString(),
    time: levelTime,
    name: finalName
  };

  try {
    const response = await fetch('/sokobox/highscore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Server error:', data);
      return;
    }
    
    // Show completion time
    document.getElementById('completionTime').textContent = 
      `Your time: ${levelTime.toFixed(1)}s`;
    
    // Update highscore table
    const tbody = document.getElementById('highscoreTableBody');
    tbody.innerHTML = data.highscores.map((score, index) => `
      <tr${score.name === finalName && score.time === levelTime ? ' class="current-score"' : ''}>
        <td>${index + 1}</td>
        <td>${score.name}</td>
        <td>${score.time.toFixed(1)}s</td>
      </tr>
    `).join('');
    
    // Show the modal
    document.getElementById('highscoreModal').style.display = 'block';

  } catch (error) {
    console.error('Error submitting highscore:', error);
    fadeOutAndLoadNextLevel(); // Continue to next level even if highscore submission fails
  }
}

function closeHighscoreModal() {
  document.getElementById('highscoreModal').style.display = 'none';
  fadeOutAndLoadNextLevel();
}
