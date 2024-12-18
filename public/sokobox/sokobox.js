const TILE_SIZE = 40; // Size of each tile
const WIDTH = 30, HEIGHT = 30; // Game grid dimensions

// Tile codes
const LVL_CLEAR = 0, LVL_FLOOR = 1, LVL_WALL = 2, LVL_GOAL = 3, LVL_FLOOR_BOX = 4, LVL_GOAL_BOX = 5;
const PLY_UP = 0, PLY_DOWN = 1, PLY_LEFT = 2, PLY_RIGHT = 3;

// Game variables
let player = { x: 0, y: 0, state: PLY_UP, push: false };
let level = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(LVL_CLEAR));
let moveHistory = [];
let moves = 0, pushes = 0;
let levelComplete = false;

// Canvas setup
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const images = {};

function preloadImages() {

  const imagePaths = {
    LVL_CLEAR: './clear.png',
    LVL_WALL: './wall.png',
    LVL_GOAL: './goal.png',
    LVL_FLOOR: './floor.png',
    LVL_FLOOR_BOX: './box.png',
    LVL_GOAL_BOX: './goalbox.png',
    PLAYER: './player.png',
    PLAYER_PUSH: './pushplay.png',
    PLY_UP: './player_u.png',
    PLY_DOWN: './player_d.png',
    PLY_LEFT: './player_l.png',
    PLY_RIGHT: './player_r.png',
    PUSH_PLY_UP: './pushplay_u.png',
    PUSH_PLY_DOWN: './pushplay_d.png',
    PUSH_PLY_LEFT: './pushplay_l.png',
    PUSH_PLY_RIGHT: './pushplay_r.png',
  };

  for (const [key, path] of Object.entries(imagePaths)) {
      const img = new Image();
      img.src = path;
      images[key] = img;
  }
}

// Load a level file (equivalent to LoadLevel)
function loadLevel(levelData) {
  let lines = levelData.split("\n");
  level = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(LVL_CLEAR));
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
  drawLevel();
}  

// Move player (equivalent to Move)
function movePlayer(direction) {
  const dx = direction === PLY_LEFT ? -1 : direction === PLY_RIGHT ? 1 : 0;
  const dy = direction === PLY_UP ? -1 : direction === PLY_DOWN ? 1 : 0;

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
    moveHistory.push({ ...player });

    // Reset the current box position
    level[newY][newX] = isGoal(newX, newY) ? LVL_GOAL : LVL_FLOOR;

    // Move the box to the new position
    level[nextY][nextX] = isGoal(nextX, nextY) ? LVL_GOAL_BOX : LVL_FLOOR_BOX;

    player.x = newX;
    player.y = newY;
    player.push = true;
    moves++;
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

  if (lastMove.box) {
    let { x, y } = lastMove.box;
    level[y][x] = isGoal(x, y) ? LVL_GOAL_BOX : LVL_FLOOR_BOX;
    level[player.y][player.x] = isGoal(player.x, player.y) ? LVL_GOAL : LVL_FLOOR;
  }
  moves--;
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
function checkCompletion() {
  levelComplete = !level.flat().includes(LVL_GOAL);
}

// Draw the level
function drawLevel() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Centering offsets
    const xOffset = 0; //(canvas.width - WIDTH * TILE_SIZE) / 2;
    const yOffset = 0; //(canvas.height - HEIGHT * TILE_SIZE) / 2;
  
    for (let y = 0; y < HEIGHT; y++) {
      for (let x = 0; x < WIDTH; x++) {
        let tile = level[y][x];
        let imageKey;

        //console.log(`tile for ${x} ${y} is ${tile}`);
        if (tile === LVL_CLEAR) imageKey = 'LVL_CLEAR';
        if (tile === LVL_WALL) imageKey = 'LVL_WALL';
        if (tile === LVL_GOAL) imageKey = 'LVL_GOAL';
        if (tile === LVL_FLOOR_BOX) imageKey = 'LVL_FLOOR_BOX';
        if (tile === LVL_GOAL_BOX) imageKey = 'LVL_GOAL_BOX';
        if (tile === LVL_FLOOR) imageKey = 'LVL_FLOOR';

        if (imageKey) {
          //console.log(`imagekey for ${x} ${y} is ${imageKey}`);
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
      //images['PLAYER'],
      (player.push ? images[`PUSH_PLY_${['UP', 'DOWN', 'LEFT', 'RIGHT'][player.state]}`] : images[`PLY_${['UP', 'DOWN', 'LEFT', 'RIGHT'][player.state]}`]),
      player.x * TILE_SIZE + xOffset,
      player.y * TILE_SIZE + yOffset,
      TILE_SIZE,
      TILE_SIZE
    );
}

// Adjusted drawTile function with offsets
function drawTile(x, y, color, xOffset = 0, yOffset = 0) {
    ctx.fillStyle = color;
    ctx.fillRect(x * TILE_SIZE + xOffset, y * TILE_SIZE + yOffset, TILE_SIZE, TILE_SIZE);
  }

// Input handling
document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault(); // Prevent scrolling
      if (e.key === "ArrowUp") movePlayer(PLY_UP);
      if (e.key === "ArrowDown") movePlayer(PLY_DOWN);
      if (e.key === "ArrowLeft") movePlayer(PLY_LEFT);
      if (e.key === "ArrowRight") movePlayer(PLY_RIGHT);
    }
    if (e.key === "z") undoMove(); // Undo
  });

// Load a test level
preloadImages();
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