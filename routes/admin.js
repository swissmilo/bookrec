const express = require('express');
const router = express.Router();
const { WorkOS } = require('@workos-inc/node');
const getHtmlHead = require('../utils/htmlHead');

const workos = new WorkOS(process.env.WORKOS_API_KEY, {
  clientId: process.env.WORKOS_CLIENT_ID,
});

console.log('WorkOS API Key exists:', !!process.env.WORKOS_API_KEY);
console.log('WorkOS Client ID exists:', !!process.env.WORKOS_CLIENT_ID);
console.log('WorkOS instance:', !!workos);
console.log('WorkOS userManagement exists:', !!workos.userManagement);

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

// Admin login page
router.get('/login', (req, res) => {
  const authorizationUrl = workos.userManagement.getAuthorizationUrl({
    redirectUri: process.env.WORKOS_REDIRECT_URI,
    provider: 'authkit',
    clientId: process.env.WORKOS_CLIENT_ID,
  });

  res.redirect(authorizationUrl);
});

// Protected admin dashboard
router.get('/', withAuth, async (req, res) => {
  const session = await workos.userManagement.loadSealedSession({
    sessionData: req.cookies['wos-session'],
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  });

  const { user } = await session.authenticate();

  console.log(`User ${user.firstName} is logged in`);

  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead('Admin Dashboard')}
    <body>
      <div class="container">
        <h1>Admin Dashboard</h1>
        <p>Welcome, ${user.firstName} ${user.lastName}!</p>
        <p>Email: ${user.email}</p>
        <form action="/admin/logout" method="POST">
          <button type="submit">Logout</button>
        </form>
      </div>
    </body>
    </html>
  `);
});

// Auth callback route
router.get('/callback', async (req, res) => {
  // The authorization code returned by AuthKit
  const code = req.query.code;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    const authenticateResponse =
      await workos.userManagement.authenticateWithCode({
        clientId: process.env.WORKOS_CLIENT_ID,
        code,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        },
      });

    const { user, sealedSession } = authenticateResponse;

    // Store the session in a cookie
    res.cookie('wos-session', sealedSession, {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
    });

    // Use the information in `user` for further business logic.

    // Redirect the user to the homepage
    return res.redirect('/admin');
  } catch (error) {
    console.error('Authentication error details:', error);
    const errorMessage = encodeURIComponent(
      error.message || 'Authentication failed'
    );
    res.redirect(`/admin/login?error=${errorMessage}`);
  }
});

// Logout route
router.post('/logout', async (req, res) => {
  const session = await workos.userManagement.loadSealedSession({
    sessionData: req.cookies['wos-session'],
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  });

  const url = await session.getLogoutUrl();

  res.clearCookie('wos-session');
  res.redirect(url);
});

module.exports = router;
