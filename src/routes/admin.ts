import { Router, Request, Response, NextFunction, RequestHandler } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth, workos, isAdmin } from '../middleware/auth';
import { AppError } from '../utils/errorHandler';
import supabase from '../utils/supabase';
import sgMail from '@sendgrid/mail';

sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

const router = Router();

router.get(
  '/',
  isAdmin,
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
                <form action="/auth/logout" method="POST">
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

// Add cron endpoint for daily stats
const dailyStatsHandler: RequestHandler = async (req, res, next) => {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const oneDayAgoStr = oneDayAgo.toISOString();

    // Get new users
    const { data: newUsers, error: usersError } = await supabase
      .from('users')
      .select('email, created_at')
      .gte('created_at', oneDayAgoStr)
      .order('created_at', { ascending: false });

    if (usersError) throw usersError;

    // Get new highscores
    const { data: newHighscores, error: highscoresError } = await supabase
      .from('highscores')
      .select('time, level, name, created_at')
      .gte('created_at', oneDayAgoStr)
      .order('created_at', { ascending: false });

    if (highscoresError) throw highscoresError;

    // Get new subscriptions
    const { data: newSubscriptions, error: subscriptionsError } = await supabase
      .from('venue_subscriptions')
      .select('address, radius, rating, types, user_email, created_at')
      .gte('created_at', oneDayAgoStr)
      .order('created_at', { ascending: false });

    if (subscriptionsError) throw subscriptionsError;

    // If there are no changes, don't send an email
    if (!newUsers.length && !newHighscores.length && !newSubscriptions.length) {
      console.log('No changes in the last 24 hours');
      res.json({ message: 'No changes to report' });
      return;
    }

    // Prepare email content
    let emailContent = '<h2>Daily Stats Update</h2>';

    if (newHighscores.length) {
        emailContent += `
          <h3>New Highscores (${newHighscores.length})</h3>
          <ul>
            ${newHighscores.map(score => `
              <li>${score.name} scored ${score.time.toFixed(1)}s on level ${score.level} 
              (${new Date(score.created_at).toLocaleString()})</li>
            `).join('')}
          </ul>
        `;
      }

    if (newUsers.length) {
      emailContent += `
        <h3>New Users (${newUsers.length})</h3>
        <ul>
          ${newUsers.map(user => `
            <li>${user.email} (joined ${new Date(user.created_at).toLocaleString()})</li>
          `).join('')}
        </ul>
      `;
    }

    if (newSubscriptions.length) {
      emailContent += `
        <h3>New Venue Subscriptions (${newSubscriptions.length})</h3>
        <ul>
          ${newSubscriptions.map(sub => `
            <li>${sub.user_email} subscribed to updates near ${sub.address} 
            (${sub.radius} miles, min rating: ${sub.rating}, types: ${sub.types.join(', ')})
            (${new Date(sub.created_at).toLocaleString()})</li>
          `).join('')}
        </ul>
      `;
    }

    // Send email
    await sgMail.send({
      to: 'milo.spirig@gmail.com',
      from: 'info@milo.run',
      subject: 'Daily Website Stats Update',
      html: emailContent,
    });

    res.json({ 
      success: true,
      message: 'Daily stats email sent',
      stats: {
        newUsers: newUsers.length,
        newHighscores: newHighscores.length,
        newSubscriptions: newSubscriptions.length
      }
    });
  } catch (error) {
    next(error);
  }
};

router.get('/cron/daily-stats', dailyStatsHandler);

export default router;
