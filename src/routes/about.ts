import { Router, Request, Response } from 'express';
import { getHtmlHead } from '../utils/htmlHead';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead('About')}
    <body>
      <div class="win95-window">
        <div class="win95-titlebar">
          <span>About Me</span>
          <a href="/" class="win95-close">×</a>
        </div>
        <div class="win95-content">
          <p>Hi, I'm Milo Spirig. I'm born and raised in Switzerland and currently live in NYC.</p>
          <p>Find me here:</p>
          <ul>
            <li><a href="https://www.linkedin.com/in/milospirig/" target="_blank">LinkedIn</a></li>
            <li><a href="https://twitter.com/SwissMilo" target="_blank">Twitter</a></li>
            <li><a href="https://github.com/swissmilo" target="_blank">GitHub</a></li>
          </ul>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default router;
