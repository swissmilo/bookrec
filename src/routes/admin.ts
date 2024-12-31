import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth, workos } from '../middleware/auth';
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

router.get(
  '/',
  withAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const session = await workos.userManagement.loadSealedSession({
        sessionData: req.cookies['wos-session'],
        cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
      });

      const authResult = await session.authenticate();
      if (authResult.authenticated) {
        // TypeScript now knows this is AuthenticateWithSessionCookieSuccessResponse
        const { user } = authResult;

        res.type('html').send(`
            <!DOCTYPE html>
            <html>
            ${getHtmlHead('Admin Dashboard')}
            <body>
              <div class="container">
                <h1>Admin Dashboard</h1>
                <p>Welcome, ${user.firstName} ${user.lastName || ''}!</p>
                <div class="admin-section">
                  <h2>Add book</h2>
                  <form action="/all-books/add" method="POST" class="book-form" accept-charset="UTF-8">
                    <div class="form-group">
                      <label for="category">Category:</label>
                      <input type="text" id="category" name="category" required>
                    </div>
                    <div class="form-group">
                      <label for="name">Book Title:</label>
                      <input type="text" id="name" name="name" required>
                    </div>
                    <div class="form-group">
                      <label for="author">Author:</label>
                      <input type="text" id="author" name="author" required>
                    </div>
                    <div class="form-group">
                      <label for="link">Amazon Link:</label>
                      <input type="url" id="link" name="link" required>
                    </div>
                    <button type="submit">Submit</button>
                  </form>
                </div>
                <form action="/admin/logout" method="POST">
                  <button type="submit">Logout</button>
                </form>
              </div>
            </body>
            </html>
          `);
      } else {
        // TypeScript now knows this is AuthenticateWithSessionCookieFailedResponse
        throw new AppError('User information not available', 401);
      }
    } catch (error) {
      next(
        error instanceof AppError
          ? error
          : new AppError('Error loading admin dashboard')
      );
    }
  }
);

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

      res.redirect('/admin');
    } catch (error) {
      console.error('Authentication error details:', error);
      const errorMessage = encodeURIComponent(
        error instanceof Error ? error.message : 'Authentication failed'
      );
      res.redirect(`/admin/login?error=${errorMessage}`);
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
