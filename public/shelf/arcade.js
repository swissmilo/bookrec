(() => {
  const CLEAR = 0;
  const FLOOR = 1;
  const WALL = 2;
  const GOAL = 3;
  const BOX = 4;
  const GOALBOX = 5;
  const SPRITE_PX = 20;

  const SPRITES = {
    [FLOOR]: 'floor.png',
    [WALL]: 'wall.png',
    [GOAL]: 'goal.png',
    [BOX]: 'box.png',
    [GOALBOX]: 'goalbox.png',
    up: 'player_u.png',
    down: 'player_d.png',
    left: 'player_l.png',
    right: 'player_r.png',
    pushup: 'pushplay_u.png',
    pushdown: 'pushplay_d.png',
    pushleft: 'pushplay_l.png',
    pushright: 'pushplay_r.png',
  };

  const DIRS = {
    up: [0, -1],
    down: [0, 1],
    left: [-1, 0],
    right: [1, 0],
  };
  const KEYS = {
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right',
    w: 'up',
    s: 'down',
    a: 'left',
    d: 'right',
  };

  function store(key, value) {
    try {
      if (value === undefined) return JSON.parse(localStorage.getItem(key));
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return null;
    }
    return null;
  }

  window.createArcade = function createArcade() {
    const $ = (id) => document.getElementById(id);
    const canvas = $('ar-canvas');
    const ctx = canvas.getContext('2d');
    const banner = $('ar-banner');
    const images = {};
    let levels = [];
    let ready = null;
    let index = store('sokobox_level') || 0;
    let grid = [];
    let player = { x: 0, y: 0, dir: 'down', push: false };
    let history = [];
    let moves = 0;
    let pushes = 0;
    let startTime = null;
    let finalTime = null;
    let ticker = null;

    function load() {
      if (!ready) {
        const sprites = Object.entries(SPRITES).map(
          ([key, file]) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = resolve;
              img.onerror = resolve;
              img.src = `/sokobox/${file}`;
              images[key] = img;
            })
        );
        const data = fetch('/sokobox/levels')
          .then((r) => r.json())
          .then((l) => {
            levels = l;
          });
        ready = Promise.all([data, ...sprites]);
      }
      return ready;
    }

    function reset() {
      index = Math.max(0, Math.min(levels.length - 1, index));
      const lines = levels[index].split('\n');
      const cols = Math.max(...lines.map((l) => l.length));
      grid = lines.map((line, y) =>
        Array.from({ length: cols }, (_, x) => {
          const ch = line[x];
          if (ch === '@') player = { x, y, dir: 'down', push: false };
          return (
            {
              '#': WALL,
              '.': GOAL,
              $: BOX,
              '%': GOALBOX,
              '-': FLOOR,
              '@': FLOOR,
            }[ch] || CLEAR
          );
        })
      );
      history = [];
      moves = pushes = 0;
      startTime = finalTime = null;
      banner.classList.remove('on');
      canvas.width = (cols + 2) * SPRITE_PX;
      canvas.height = (grid.length + 2) * SPRITE_PX;
      store('sokobox_level', index);
      draw();
      hud();
    }

    const at = (x, y) => grid[y]?.[x] ?? CLEAR;
    const walkable = (x, y) => at(x, y) === FLOOR || at(x, y) === GOAL;
    const isBox = (x, y) => at(x, y) === BOX || at(x, y) === GOALBOX;
    const isGoal = (x, y) => at(x, y) === GOAL || at(x, y) === GOALBOX;

    function move(dir) {
      if (finalTime !== null) return;
      const [dx, dy] = DIRS[dir];
      const nx = player.x + dx;
      const ny = player.y + dy;
      const bx = nx + dx;
      const by = ny + dy;
      const before = { ...player };
      player.dir = dir;
      player.push = false;
      if (walkable(nx, ny)) {
        history.push({ player: before });
        moves++;
      } else if (isBox(nx, ny) && walkable(bx, by)) {
        history.push({ player: before, box: { from: [nx, ny], to: [bx, by] } });
        grid[ny][nx] = isGoal(nx, ny) ? GOAL : FLOOR;
        grid[by][bx] = isGoal(bx, by) ? GOALBOX : BOX;
        player.push = true;
        moves++;
        pushes++;
      } else {
        draw();
        return;
      }
      player.x = nx;
      player.y = ny;
      if (startTime === null) startTime = performance.now();
      if (!grid.flat().includes(GOAL)) complete();
      draw();
      hud();
    }

    function undo() {
      const last = history.pop();
      if (!last || finalTime !== null) return;
      if (last.box) {
        const [fx, fy] = last.box.from;
        const [tx, ty] = last.box.to;
        grid[ty][tx] = isGoal(tx, ty) ? GOAL : FLOOR;
        grid[fy][fx] = isGoal(fx, fy) ? GOALBOX : BOX;
        pushes--;
      }
      moves--;
      player = last.player;
      draw();
      hud();
    }

    function complete() {
      finalTime = (performance.now() - startTime) / 1000;
      const best = store('sokobox_best') || {};
      const isRecord = best[index] === undefined || finalTime < best[index];
      if (isRecord) best[index] = finalTime;
      store('sokobox_best', best);
      const last = index === levels.length - 1;
      banner.replaceChildren();
      const title = document.createElement('strong');
      title.textContent = last ? 'YOU WIN!' : 'LEVEL CLEAR!';
      const stats = document.createElement('div');
      stats.textContent = `TIME ${finalTime.toFixed(1)}S · BEST ${best[index].toFixed(1)}S${isRecord ? ' · NEW RECORD' : ''}`;
      const prompt = document.createElement('em');
      prompt.textContent = last
        ? 'PRESS ENTER TO PLAY AGAIN'
        : 'PRESS ENTER FOR NEXT LEVEL';
      const board = document.createElement('div');
      banner.append(title, stats, board, prompt);
      banner.classList.add('on');
      postScore(index, finalTime, board);
    }

    async function postScore(level, time, board) {
      try {
        const res = await fetch('/sokobox/highscore', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            level: String(level),
            time,
            name: localStorage.getItem('playerName') || 'Anonymous',
          }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (
          level !== index ||
          finalTime === null ||
          !Array.isArray(data.highscores)
        )
          return;
        board.textContent = data.highscores
          .map(
            (score, i) =>
              `${i + 1}. ${String(score.name).slice(0, 10).toUpperCase()} ${Number(score.time).toFixed(1)}S`
          )
          .join('   ');
      } catch (error) {
        board.textContent = '';
      }
    }

    function advance() {
      index = index === levels.length - 1 ? 0 : index + 1;
      reset();
    }

    function draw() {
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#05040a';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      grid.forEach((row, y) =>
        row.forEach((tile, x) => {
          if (tile !== CLEAR)
            ctx.drawImage(
              images[tile],
              (x + 1) * SPRITE_PX,
              (y + 1) * SPRITE_PX,
              SPRITE_PX,
              SPRITE_PX
            );
        })
      );
      const sprite = images[`${player.push ? 'push' : ''}${player.dir}`];
      ctx.drawImage(
        sprite,
        (player.x + 1) * SPRITE_PX,
        (player.y + 1) * SPRITE_PX,
        SPRITE_PX,
        SPRITE_PX
      );
    }

    function hud() {
      const elapsed =
        finalTime ??
        (startTime === null ? 0 : (performance.now() - startTime) / 1000);
      $('ar-level').textContent = String(index + 1).padStart(2, '0');
      $('ar-moves').textContent = String(moves).padStart(3, '0');
      $('ar-pushes').textContent = String(pushes).padStart(3, '0');
      $('ar-time').textContent = elapsed.toFixed(1).padStart(5, '0');
    }

    function onKey(ev) {
      const key = ev.key.length === 1 ? ev.key.toLowerCase() : ev.key;
      if (KEYS[key]) {
        ev.preventDefault();
        move(KEYS[key]);
      } else if (key === 'z' || key === 'u') {
        undo();
      } else if (key === 'r') {
        reset();
      } else if ((key === 'Enter' || key === ' ') && finalTime !== null) {
        ev.preventDefault();
        advance();
      }
    }

    document.querySelectorAll('.dpad [data-dir]').forEach((btn) => {
      btn.addEventListener('click', () => move(btn.dataset.dir));
    });
    $('ar-undo').addEventListener('click', undo);
    $('ar-reset').addEventListener('click', () => levels.length && reset());
    $('ar-prev').addEventListener('click', () => {
      if (!levels.length) return;
      index = (index - 1 + levels.length) % levels.length;
      reset();
    });
    $('ar-next').addEventListener('click', () => {
      if (!levels.length) return;
      index = (index + 1) % levels.length;
      reset();
    });
    banner.addEventListener('click', advance);

    const screen = document.querySelector('#arcade-modal .screen');
    let swipe = null;
    screen.addEventListener('pointerdown', (ev) => {
      swipe = { x: ev.clientX, y: ev.clientY };
    });
    screen.addEventListener('pointerup', (ev) => {
      if (!swipe) return;
      const dx = ev.clientX - swipe.x;
      const dy = ev.clientY - swipe.y;
      swipe = null;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
      if (Math.abs(dx) > Math.abs(dy)) move(dx > 0 ? 'right' : 'left');
      else move(dy > 0 ? 'down' : 'up');
    });
    screen.addEventListener('pointercancel', () => {
      swipe = null;
    });

    return {
      async start() {
        await load();
        if (!grid.length) reset();
        window.addEventListener('keydown', onKey);
        clearInterval(ticker);
        ticker = setInterval(hud, 100);
      },
      stop() {
        window.removeEventListener('keydown', onKey);
        clearInterval(ticker);
      },
    };
  };
})();
