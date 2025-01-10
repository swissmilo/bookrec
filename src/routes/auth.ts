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
    });

    res.redirect(authorizationUrl);
  } catch (error) {
    next(new AppError('Error generating authorization URL', 500));
  }
});

interface CallbackQuery {
  code?: string;
  error?: string;
}

router.get(
  '/callback',
  async (
    req: Request<{}, {}, {}, CallbackQuery>,
    res: Response,
    next: NextFunction
  ) => {
    const { code } = req.query;

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

      res.redirect('/');
    } catch (error) {
      console.error('Authentication error details:', error);
      const errorMessage = encodeURIComponent(
        error instanceof Error ? error.message : 'Authentication failed'
      );
      res.redirect(`/auth/login?error=${errorMessage}`);
    }
  }
);

router.post(
  '/logout',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await workos.userManagement.loadSealedSession({
        sessionData: req.cookies['wos-session'],
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
      });

      const url = await session.getLogoutUrl();

      res.clearCookie('wos-session');
      res.redirect(url);
    } catch (error) {
      next(new AppError('Error during logout', 500));
    }
  }
);

export default router;
