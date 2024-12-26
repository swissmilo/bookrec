const express = require('express');
const router = express.Router();
const { WorkOS } = require('@workos-inc/node');
const getHtmlHead = require('../utils/htmlHead');
const { withAuth, workos } = require('../middleware/auth');

//console.log('WorkOS API Key exists:', !!process.env.WORKOS_API_KEY);
//console.log('WorkOS Client ID exists:', !!process.env.WORKOS_CLIENT_ID);
//console.log('WorkOS instance:', !!workos);
//console.log('WorkOS userManagement exists:', !!workos.userManagement);

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

  //console.log(`User ${user.firstName} is logged in`);

  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead('Admin Dashboard')}
    <body>
      <div class="container">
        <h1>Admin Dashboard</h1>
        <p>Welcome, ${user.firstName} ${user.lastName}!</p>
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
