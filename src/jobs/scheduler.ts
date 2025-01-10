import { checkForNewVenues } from './venueChecker';

// This function is kept for manual testing and development
export async function startScheduler() {
  try {
    console.log('Running initial venue check...');
    await checkForNewVenues();
    console.log('Initial venue check completed');
  } catch (error) {
    console.error('Error in initial venue check:', error);
  }
} 