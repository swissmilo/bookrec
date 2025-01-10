import { Router, Request, Response } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { workos } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let welcomeMessage = '';
  
  try {
    const sessionCookie = req.cookies['wos-session'];
    if (sessionCookie) {
      const session = await workos.userManagement.loadSealedSession({
        sessionData: sessionCookie,
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
      });

      const authResult = await session.authenticate();
      if (authResult.authenticated && authResult.user?.firstName) {
        welcomeMessage = `<div class="welcome-message">Welcome back, ${authResult.user.firstName}! 👋</div>`;
      }
    }
  } catch (error) {
    console.error('Error checking session:', error);
  }

  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead("Milo's Personal Website")}
    <style>
      .welcome-message {
        position: fixed;
        top: 20px;
        right: 20px;
        background: #c0c0c0;
        padding: 8px 16px;
        border: 2px solid;
        border-color: #ffffff #808080 #808080 #ffffff;
        font-family: 'MS Sans Serif', sans-serif;
        font-size: 14px;
        z-index: 1000;
        box-shadow: 1px 1px 0 #000;
      }
    </style>
    <body>
      ${welcomeMessage}
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
          <a href="/venues" class="desktop-icon">
            <div class="icon-img">🌟</div>
          </a>
        </div>
      </div>
    </body>
    </html>
  `);
});

export default router;
