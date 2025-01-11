import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth, workos, isAdmin } from '../middleware/auth';
import { AppError } from '../utils/errorHandler';

const router = Router();

router.get('/login', (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorizationUrl = workos.userManagement.getAuthorizationUrl({
      redirectUri: process.env.WORKOS_REDIRECT_URI || '',
      provider: 'authkit',
      clientId: process.env.WORKOS_CLIENT_ID || '',
      state: req.query.redirect ? JSON.stringify({ redirect: req.query.redirect }) : undefined,
    });

    res.redirect(authorizationUrl);
  } catch (error) {
    next(new AppError('Error generating authorization URL', 500));
  }
});

interface CallbackQuery {
  code?: string;
  error?: string;
  state?: string;
}

router.get(
  '/callback',
  async (
    req: Request<{}, {}, {}, CallbackQuery>,
    res: Response,
    next: NextFunction
  ) => {
    const { code, state } = req.query;

    if (!code) {
      next(new AppError('No code provided', 400));
      return;
    }

    try {
      const { user, sealedSession } =
        await workos.userManagement.authenticateWithCode({
          clientId: process.env.WORKOS_CLIENT_ID || '',
          code,
          session: {
            sealSession: true,
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
          },
        });

      res.cookie('wos-session', sealedSession, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });

      // Get the redirect URL from the state parameter
      let redirectUrl = '/';
      if (state) {
        try {
          const stateData = JSON.parse(state);
          if (stateData.redirect) {
            redirectUrl = stateData.redirect;
          }
        } catch (e) {
          console.error('Error parsing state:', e);
        }
      }
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error('Authentication error details:', error);
      const errorMessage = encodeURIComponent(
        error instanceof Error ? error.message : 'Authentication failed'
      );
      res.redirect(`/auth/login?error=${errorMessage}`);
    }
  }
);

// Handle both GET and POST requests for logout
async function handleLogout(req: Request, res: Response, next: NextFunction) {
  try {
    let logoutUrl = '/';

    // Try to get WorkOS logout URL if we have a session cookie
    if (req.cookies['wos-session']) {
      try {
        const session = await workos.userManagement.loadSealedSession({
          sessionData: req.cookies['wos-session'],
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
        });
        logoutUrl = await session.getLogoutUrl();
      } catch (error) {
        console.log('WorkOS session logout failed, will redirect to home');
      }
    }

    // Clear the session cookie after getting the logout URL
    res.clearCookie('wos-session', {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax'
    });

    // Redirect to either WorkOS logout URL or home
    res.redirect(logoutUrl);
  } catch (error) {
    console.error('Logout error:', error);
    next(new AppError('Error during logout', 500));
  }
}

router.get('/logout', handleLogout);
router.post('/logout', handleLogout);

export default router;
