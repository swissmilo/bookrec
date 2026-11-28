import { Router, Request, Response } from 'express';
import { workos } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let welcomeMessage = `<a href="/auth/login">Login 🔑</a>`;
  
  try {
    const sessionCookie = req.cookies['wos-session'];
    if (sessionCookie) {
      try {
        const session = await workos.userManagement.loadSealedSession({
          sessionData: sessionCookie,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
        });

        const authResult = await session.authenticate();
        if (authResult.authenticated && authResult.user?.firstName) {
          welcomeMessage = `Welcome back, ${authResult.user.firstName}! 👋`;
        } 
      } catch (sessionError) {
        // If session is expired but user has valid credentials, refresh silently
        console.log('Session expired, attempting silent refresh...');
        const authorizationUrl = workos.userManagement.getAuthorizationUrl({
          redirectUri: process.env.WORKOS_REDIRECT_URI || '',
          provider: 'authkit',
          clientId: process.env.WORKOS_CLIENT_ID || '',
          state: JSON.stringify({ redirect: '/', silent: true }),
        });
        return res.redirect(authorizationUrl);
      }
    } 
  } catch (error) {
    console.error('Error checking session:', error);
  }

  res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="Milo's personal website">
      <meta name="author" content="Milo Spirig">
      <title>Milo's Personal Website</title>
      <link rel="icon" type="image/x-icon" href="/favicon.ico">
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Pinyon+Script&family=Press+Start+2P&display=swap" rel="stylesheet">
      <link rel="stylesheet" href="/shelf/shelf.css">
      <script type="importmap">
        {
          "imports": {
            "three": "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js",
            "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/"
          }
        }
      </script>
      <script defer src="/_vercel/insights/script.js"></script>
    </head>
    <body>

    <canvas id="scene" role="img" aria-label="Milo's bookshelf"></canvas>
    <nav class="visually-hidden" aria-label="Main navigation">
      <a href="/about">About Me</a>
      <a href="/all-books">Book Library</a>
      <a href="/sokobox">Play Sokobox Game</a>
      <a href="/music">My Music</a>
    </nav>
    <div class="corner">${welcomeMessage}</div>
    <div id="tip"></div>
    <aside id="card" aria-live="polite">
      <div class="cat"></div>
      <h1></h1>
      <div class="author"></div>
      <div class="quotes"></div>
      <div class="actions">
        <a class="buy" target="_blank" rel="noopener noreferrer">View on Amazon</a>
      </div>
    </aside>
    <div id="about-modal" class="modal">
      <div class="diploma-frame" role="dialog" aria-modal="true" aria-label="About Milo">
        <button type="button" class="modal-close" aria-label="Close">×</button>
        <div class="diploma">
          <div class="dip-pre">Hi, I'm</div>
          <h2>Milo Spirig</h2>
          <div class="dip-rule"></div>
          <p>I'm born and raised in Switzerland and currently live in NYC.</p>
          <div class="dip-find">Find me here</div>
          <ul class="dip-links">
            <li>
              <a href="https://www.linkedin.com/in/milospirig/" target="_blank" rel="noopener noreferrer">milospirig</a>
              <span>LinkedIn</span>
            </li>
            <li>
              <a href="https://twitter.com/SwissMilo" target="_blank" rel="noopener noreferrer">SwissMilo</a>
              <span>Twitter</span>
            </li>
            <li>
              <a href="https://github.com/swissmilo" target="_blank" rel="noopener noreferrer">swissmilo</a>
              <span>GitHub</span>
            </li>
          </ul>
          <div class="dip-seal" aria-hidden="true">MS</div>
        </div>
      </div>
    </div>
    <div id="arcade-modal" class="modal">
      <div class="cabinet" role="dialog" aria-modal="true" aria-label="Sokobox arcade">
        <button type="button" class="modal-close" aria-label="Close">×</button>
        <div class="marquee">SOKOBOX</div>
        <div class="hud">
          <span>LEVEL <b id="ar-level">01</b></span>
          <span>MOVES <b id="ar-moves">000</b></span>
          <span>PUSHES <b id="ar-pushes">000</b></span>
          <span>TIME <b id="ar-time">000.0</b></span>
        </div>
        <div class="screen">
          <canvas id="ar-canvas" width="400" height="300"></canvas>
          <div class="crt"></div>
          <div class="banner" id="ar-banner"></div>
        </div>
        <div class="deck">
          <div class="dpad">
            <button type="button" data-dir="up" aria-label="Up">▲</button>
            <button type="button" data-dir="left" aria-label="Left">◀</button>
            <div class="hub"></div>
            <button type="button" data-dir="right" aria-label="Right">▶</button>
            <button type="button" data-dir="down" aria-label="Down">▼</button>
          </div>
          <div class="level-select">
            <button type="button" id="ar-prev" aria-label="Previous level">◀</button>
            <span>LEVEL</span>
            <button type="button" id="ar-next" aria-label="Next level">▶</button>
          </div>
          <div class="round-buttons">
            <label><button type="button" class="round red" id="ar-undo" aria-label="Undo"></button>UNDO</label>
            <label><button type="button" class="round blue" id="ar-reset" aria-label="Reset"></button>RESET</label>
          </div>
        </div>
        <div class="coin">ARROWS MOVE · Z UNDO · R RESET · ESC EXIT</div>
      </div>
    </div>
    <div id="music-modal" class="modal">
      <div class="jukebox" role="dialog" aria-modal="true" aria-label="My Music">
        <button type="button" class="modal-close" aria-label="Close">×</button>
        <iframe
          title="Spotify Playlist Embed"
          data-src="https://open.spotify.com/embed/playlist/1mvwqgXF2hPdIt7DQtnvHE?utm_source=generator&theme=0"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
        ></iframe>
      </div>
    </div>
    <script type="module" src="/shelf/shelf.js"></script>
    </body>
    </html>
  `);
});

export default router;
