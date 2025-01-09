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
          email: authResult.user.email || ''
        };
      }
      return next();
    }

    if (
      !authResult.authenticated &&
      authResult.reason === 'no_session_cookie_provided'
    ) {
      res.redirect('/admin/login');
      return;
    }

    try {
      const authResult = await session.refresh();
      if (authResult.authenticated) {
        const { authenticated: refreshed, sealedSession } = authResult;

        if (!refreshed) {
          res.redirect('/admin/login');
          return;
        }

        if (sealedSession) {
          res.cookie('wos-session', sealedSession, {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
          });

          if (req.session) {
            req.session.user = {
              id: authResult.session?.user.id || '',
              email: authResult.session?.user.email || ''
            };
          }
        }
        res.redirect(req.originalUrl);
      }
    } catch (e) {
      res.clearCookie('wos-session');
      res.redirect('/admin/login');
    }
  } catch (error) {
    next(new AppError('Authentication failed', 401));
  }
};
