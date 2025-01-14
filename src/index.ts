import dotenv from 'dotenv';
import path from 'path';

// Load environment variables before any other imports
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import express, { Express, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import { SitemapStream, streamToPromise } from 'sitemap';
import { Readable } from 'stream';
import { SitemapLink } from './types/index';
import { startScheduler } from './jobs/scheduler';

// Import routes
import homeRouter from './routes/home';
import aboutRouter from './routes/about';
import libraryRouter from './routes/library';
import recommendationsRouter from './routes/recommendations';
import sokoboxRouter from './routes/sokobox';
import adminRouter from './routes/admin';
import notFoundRouter from './routes/404';
import { errorHandler } from './utils/errorHandler';
import venuesRouter from './routes/venues';
import authRoutes from './routes/auth';
import musicRouter from './routes/music';

const app: Express = express();
const port: number = parseInt(process.env.PORT || '3000', 10);

// public folder for stylesheets
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Minimal session configuration just for game state
app.use(session({
  secret: process.env.SESSION_SECRET || 'sokobox-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  }
}));

// Mount routes
app.use('/', homeRouter);
app.use('/about', aboutRouter);
app.use('/all-books', libraryRouter);
app.use('/recommendations', recommendationsRouter);
app.use('/sokobox', sokoboxRouter);
app.use('/auth', authRoutes);
app.use('/admin', adminRouter);
app.use('/venues', venuesRouter);
app.use('/music', musicRouter);

// Add sitemap route before 404 handler
app.get('/sitemap.xml', async (req: Request, res: Response) => {
  try {
    const links: SitemapLink[] = [
      { url: '/', changefreq: 'monthly'},
      { url: '/about', changefreq: 'monthly'},
      { url: '/all-books', changefreq: 'weekly'},
      { url: '/recommendations', changefreq: 'monthly'},
      { url: '/sokobox', changefreq: 'monthly'},
      { url: '/venues', changefreq: 'daily'},
      { url: '/auth/login', changefreq: 'weekly'},
      { url: '/music', changefreq: 'monthly'}
    ];

    const stream = new SitemapStream({ hostname: process.env.BASE_URL || 'http://localhost:3000' });
    const data = await streamToPromise(Readable.from(links).pipe(stream));
    
    res.header('Content-Type', 'application/xml');
    res.send(data.toString());
  } catch (error) {
    console.error('Error generating sitemap:', error);
    res.status(500).end();
  }
});

// 404 handler should be last
app.use(notFoundRouter);

// Error handling middleware
app.use(errorHandler);

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});

export default app; 