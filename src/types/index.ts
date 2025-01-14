declare global {
  namespace NodeJS {
    interface ProcessEnv {
      WORKOS_API_KEY: string;
      WORKOS_CLIENT_ID: string;
      WORKOS_COOKIE_PASSWORD: string;
      WORKOS_REDIRECT_URI: string;
      SESSION_SECRET: string;
      OPENAI_API_KEY: string;
      SUPABASE_URL: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      NODE_ENV: 'development' | 'production' | 'test';
    }
  }

  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        is_admin: boolean;
      };
    }
  }
}

export {};

// Session Types
declare module 'express-session' {
  interface SessionData {
    lastLevel?: number;
    levelStartTime?: number;
    playerName?: string;
  }
}

// Book Types
export interface Book {
  category: string;
  name: string;
  author: string;
  link: string;
}

export interface AddBookRequestBody {
  category: string;
  name: string;
  author: string;
  link: string;
}

// Game Types
export interface Player {
  x: number;
  y: number;
  state: number;
  push: boolean;
}

export interface HighscoreEntry {
  name: string;
  time: number;
}

export interface Highscore {
  name: string;
  time: number;
  level: string;
}

export interface HighscoreResponse {
  success: boolean;
  highscores: HighscoreEntry[];
}

export interface HighscoreRequestBody {
  level: string;
  time: number;
  name: string;
}

export interface LevelState {
  level: number[];
  player: Player;
  moves: number;
  pushes: number;
  levelComplete: boolean;
  levelStartTime: number | null;
  levelTime: number;
}

// Error Types
export interface CustomError extends Error {
  status?: number;
}

// Utility Types
export interface SitemapLink {
  url: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority?: number;
}
