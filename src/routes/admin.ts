import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth, workos, isAdmin } from '../middleware/auth';
import { AppError } from '../utils/errorHandler';

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

export default router;
