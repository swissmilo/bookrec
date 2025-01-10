import { Request, Response, NextFunction } from 'express';
import { WorkOS } from '@workos-inc/node';
import { AppError } from '../utils/errorHandler';

if (!process.env.WORKOS_API_KEY || !process.env.WORKOS_CLIENT_ID) {
  throw new Error('Missing WorkOS environment variables');
}

export const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
}) as WorkOS;

export const withAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const session = await workos.userManagement.loadSealedSession({
      sessionData: req.cookies['wos-session'],
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD || '',
    });

    const authResult = await session.authenticate();

    if (authResult.authenticated) {
      if (req.session && authResult.user) {
        req.session.user = {
          id: authResult.user.id,
          email: authResult.user.email || '',
          is_admin: authResult.user.email === 'milo.spirig@gmail.com'
        };
      }
      return next();
    }

    if (
      !authResult.authenticated &&
      authResult.reason === 'no_session_cookie_provided'
    ) {
      res.redirect('/auth/login');
      return;
    }

    try {
      const authResult = await session.refresh();
      if (authResult.authenticated) {
        const { authenticated: refreshed, sealedSession } = authResult;

        if (!refreshed) {
          res.redirect('/auth/login');
          return;
        }

        if (sealedSession) {
          res.cookie('wos-session', sealedSession, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
          });

          if (req.session && authResult.session?.user) {
            req.session.user = {
              id: authResult.session.user.id,
              email: authResult.session.user.email || '',
              is_admin: authResult.session.user.email === 'milo.spirig@gmail.com'
            };
          }
        }
        res.redirect(req.originalUrl);
      }
    } catch (e) {
      res.clearCookie('wos-session');
      res.redirect('/auth/login');
    }
  } catch (error) {
    next(new AppError('Authentication failed', 401));
  }
};

// New middleware that combines authentication and admin check
export const isAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // First run the normal authentication check
    await withAuth(req, res, async () => {
      // After successful authentication, check if user is admin
      const isUserAdmin = req.session?.user?.is_admin;
      
      if (!isUserAdmin) {
        res.status(403).json({
          success: false,
          message: 'Access denied. Admin privileges required.'
        });
        return;
      }

      // If we get here, user is authenticated and is an admin
      next();
    });
  } catch (error) {
    next(new AppError('Admin authorization failed', 403));
  }
};
