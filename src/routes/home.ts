import { Router, Request, Response } from 'express';
import { getHtmlHead } from '../utils/htmlHead';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead("Milo's Personal Website")}
    <body>
      <div class="desktop">
        <div class="desktop-icons">
          <a href="/about" class="desktop-icon">
            <div class="icon-img">👤</div>
          </a>
          <a href="/all-books" class="desktop-icon">
            <div class="icon-img">📚</div>
          </a>
          <a href="/recommendations" class="desktop-icon">
            <div class="icon-img">💡</div>
          </a>
          <a href="/sokobox" class="desktop-icon">
            <div class="icon-img">🎮</div>
          </a>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default router;
