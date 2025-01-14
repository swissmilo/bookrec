import { chromium, Browser } from '@playwright/test';
import { analyzeScreenshot } from '../utils/openai';
import { generateTestFromScreenshot } from '../utils/generator';
import { parseStringPromise } from 'xml2js';
import fetch from 'node-fetch';

interface Viewport {
  name: string;
  width: number;
  height: number;
}

const VIEWPORTS: Viewport[] = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 375, height: 667 }
];

async function getSitemapRoutes(): Promise<string[]> {
  try {
    const response = await fetch('http://localhost:3000/sitemap.xml');
    if (!response.ok) {
      console.error(`Failed to fetch sitemap: ${response.status} ${response.statusText}`);
      return [];
    }

    const xml = await response.text();
    if (!xml) {
      console.error('Empty sitemap response');
      return [];
    }

    console.log('Fetched sitemap content (first 200 chars):', xml.substring(0, 200));

    const result = await parseStringPromise(xml);
    if (!result?.urlset?.url) {
      console.error('Invalid sitemap format:', result);
      return [];
    }

    return result.urlset.url.map((entry: any) => entry.loc[0]);
  } catch (error) {
    console.error('Error fetching/parsing sitemap:', error);
    // Fallback to default routes
    return [
      'http://localhost:3000/',
      'http://localhost:3000/venues',
      'http://localhost:3000/music',
      'http://localhost:3000/sokobox'
    ];
  }
}

function getFileNameFromRoute(route: string): string {
  const url = new URL(route);
  return url.pathname.replace(/\//g, '_') || '_';
}

async function captureScreenshots(browser: Browser, routes: string[]): Promise<void> {
  for (const viewport of VIEWPORTS) {
    console.log(`Processing viewport: ${viewport.name} (${viewport.width}x${viewport.height})`);
    
    const context = await browser.newContext({
      viewport: {
        width: viewport.width,
        height: viewport.height
      }
    });
    
    const page = await context.newPage();

    for (const route of routes) {
      try {
        console.log(`Processing route: ${route}`);
        await page.goto(route);
        await page.waitForLoadState('networkidle');

        const htmlSource = await page.content();
        const fileName = getFileNameFromRoute(route);
        const screenshotPath = `tests/screenshots/${viewport.name}/${fileName}.png`;
        
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`Captured screenshot: ${screenshotPath}`);

        const analysis = await analyzeScreenshot(screenshotPath, htmlSource);
        await generateTestFromScreenshot(route, analysis);
      } catch (error) {
        console.error(`Error processing route ${route}:`, error);
      }
    }

    await context.close();
  }
}

async function checkServerAvailable(): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:3000/');
    return response.ok;
  } catch (error) {
    return false;
  }
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('Error: OPENAI_API_KEY environment variable is not set');
    process.exit(1);
  }

  if (!(await checkServerAvailable())) {
    console.error('Error: Development server is not running. Please start it with npm run dev');
    process.exit(1);
  }

  const routes = await getSitemapRoutes();
  if (routes.length === 0) {
    console.error('No routes found to process');
    process.exit(1);
  }

  const browser = await chromium.launch();
  try {
    await captureScreenshots(browser, routes);
  } finally {
    await browser.close();
  }
}

main().catch(console.error); 