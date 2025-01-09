import cron from 'node-cron';
import { checkForNewVenues } from './venueChecker';

// Run every Monday at 9 AM
export function startScheduler() {
  cron.schedule('0 9 * * 1', async () => {
    console.log('Running venue checker job...');
    try {
      await checkForNewVenues();
      console.log('Venue checker job completed successfully');
    } catch (error) {
      console.error('Error in venue checker job:', error);
    }
  });
} 