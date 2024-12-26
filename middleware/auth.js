const { WorkOS } = require('@workos-inc/node');

const workos = new WorkOS(process.env.WORKOS_API_KEY, {
    clientId: process.env.WORKOS_CLIENT_ID,
  });

// Middleware to check if user is authenticated
async function withAuth(req, res, next) {
    const session = await workos.userManagement.loadSealedSession({
      sessionData: req.cookies['wos-session'],
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    });
  
    const { authenticated, reason } = await session.authenticate();
  
    if (authenticated) {
      return next();
    }
  
    // If the cookie is missing, redirect to login
    if (!authenticated && reason === 'no_session_cookie_provided') {
      return res.redirect('/admin/login');
    }
  
    // If the session is invalid, attempt to refresh
    try {
      const { authenticated, sealedSession } = await session.refresh();
  
      if (!authenticated) {
        return res.redirect('/admin/login');
      }
  
      // update the cookie
      res.cookie('wos-session', sealedSession, {
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
      });
  
      // Redirect to the same route to ensure the updated cookie is used
      return res.redirect(req.originalUrl);
    } catch (e) {
      // Failed to refresh access token, redirect user to login page
      // after deleting the cookie
      res.clearCookie('wos-session');
      res.redirect('/admin/login');
    }
  }

  module.exports = {
    withAuth,
    workos
  };