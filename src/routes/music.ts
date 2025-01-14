import { Router, Request, Response } from 'express';
import { getHtmlHead } from '../utils/htmlHead';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
    ${getHtmlHead('Music')}
    <body>
      <div class="win95-window" role="main">
        <div class="win95-titlebar" role="banner">
          <span role="heading" aria-level="1">My Music</span>
          <a href="/" class="win95-close" aria-label="Close window">×</a>
        </div>
        <div class="win95-content">
          <iframe 
            title="Spotify Playlist Embed"
            style="border-radius:12px" 
            src="https://open.spotify.com/embed/playlist/1mvwqgXF2hPdIt7DQtnvHE?utm_source=generator&theme=0" 
            width="100%" 
            height="600" 
            frameBorder="0" 
            allowfullscreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy">
          </iframe>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default router; 