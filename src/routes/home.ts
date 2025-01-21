import { Router, Request, Response } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { workos } from '../middleware/auth';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  let welcomeMessage = `<div class="welcome-message"><a href="/auth/login" style="text-decoration: none; color: inherit;">Login 🔑</a></div>`;
  
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
          welcomeMessage = `<div class="welcome-message">Welcome back, ${authResult.user.firstName}! 👋</div>`;
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
    ${getHtmlHead("Milo's Personal Website")}
    <body>
      <div class="desktop" role="main">
        <nav class="desktop-icons" role="navigation" aria-label="Main navigation">
          <a href="/about" class="desktop-icon" aria-label="About Me">
            <div class="icon-img" aria-hidden="true">👤</div>
          </a>
          <a href="/all-books" class="desktop-icon" aria-label="Book Library">
            <div class="icon-img" aria-hidden="true">📚</div>
          </a>
          <a href="/recommendations" class="desktop-icon" aria-label="Book Recommendations">
            <div class="icon-img" aria-hidden="true">💡</div>
          </a>
          <a href="/sokobox" class="desktop-icon" aria-label="Play Sokobox Game">
            <div class="icon-img" aria-hidden="true">🎮</div>
          </a>
          <a href="/venues" class="desktop-icon" aria-label="Venue Notifications">
            <div class="icon-img" aria-hidden="true">🗺️</div>
          </a>
          <a href="/music" class="desktop-icon" aria-label="My Music">
            <div class="icon-img" aria-hidden="true">🎵</div>
          </a>
          <a href="https://www.amazon.com/dp/B0DTFPDZWP" class="desktop-icon" aria-label="World Without Edges Book" target="_blank" rel="noopener noreferrer">
            <div class="icon-img" aria-hidden="true">🔮</div>
          </a>
        </nav>
      </div>
      ${welcomeMessage}
    </body>
    </html>
  `);
});

export default router;
