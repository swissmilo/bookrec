import { Router, Request, Response } from 'express';
import { getHtmlHead } from '../utils/htmlHead';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html lang="en">
    ${getHtmlHead('About')}
    <body>
      <div class="win95-window" role="main">
        <div class="win95-titlebar" role="banner">
          <span>About Me</span>
          <a href="/" class="win95-close" aria-label="Close window">×</a>
        </div>
        <div class="win95-content">
          <p>Hi, I'm Milo Spirig. I'm born and raised in Switzerland and currently live in NYC.</p>
          <p>Find me here:</p>
          <nav aria-label="Social links">
            <ul>
              <li><a href="https://www.linkedin.com/in/milospirig/" target="_blank" rel="noopener noreferrer" aria-label="Visit my LinkedIn profile">LinkedIn</a></li>
              <li><a href="https://twitter.com/SwissMilo" target="_blank" rel="noopener noreferrer" aria-label="Visit my Twitter profile">Twitter</a></li>
              <li><a href="https://github.com/swissmilo" target="_blank" rel="noopener noreferrer" aria-label="Visit my GitHub profile">GitHub</a></li>
            </ul>
          </nav>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default router;
