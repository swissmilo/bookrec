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

const app: Express = express();
const port: number = parseInt(process.env.PORT || '3000', 10);

// Start the scheduler in production
//if (process.env.NODE_ENV === 'production') {
  startScheduler();
  console.log('Venue checker scheduler started');
//}

// public folder for stylesheets
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Session configuration
interface SessionConfig {
  secret: string;
  resave: boolean;
  saveUninitialized: boolean;
  cookie: {
    secure: boolean;
  };
}

const sessionConfig: SessionConfig = {
  secret: process.env.SESSION_SECRET || 'not-very-secret-key',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: process.env.NODE_ENV === 'production' }
};

app.use(session(sessionConfig));

// Mount routes
app.use('/', homeRouter);
app.use('/about', aboutRouter);
app.use('/all-books', libraryRouter);
app.use('/recommendations', recommendationsRouter);
app.use('/sokobox', sokoboxRouter);
app.use('/auth', authRoutes);
app.use('/admin', adminRouter);
app.use('/venues', venuesRouter);
app.use(notFoundRouter);

// Error handling middleware
app.use(errorHandler);

app.get('/sitemap.xml', async (req: Request, res: Response) => {
  const links: SitemapLink[] = [
    { url: '/', changefreq: 'weekly' },
    { url: '/about', changefreq: 'weekly' },
    { url: '/all-books', changefreq: 'weekly' },
    { url: '/recommendations', changefreq: 'weekly' },
    { url: '/sokobox', changefreq: 'weekly' }
  ];

  try {
    const stream = new SitemapStream({ hostname: 'https://milo.run' });
    res.header('Content-Type', 'application/xml');
    
    const data = await streamToPromise(Readable.from(links).pipe(stream));
    res.send(data);
  } catch (error) {
    console.error(error);
    res.status(500).end();
  }
});

app.listen(port, () => {
  console.log(`Recommendation app listening on port ${port}`);
});

export default app; 