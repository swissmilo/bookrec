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
      if (authResult.user) {
        req.user = {
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

          if (authResult.session?.user) {
            req.user = {
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
    next(error);
  }
};

export const isAdmin = async (
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
    if (authResult.authenticated && authResult.user?.email === 'milo.spirig@gmail.com') {
      return next();
    }

    throw new AppError('Unauthorized', 401);
  } catch (error) {
    next(error);
  }
};
