import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import { withAuth } from '../middleware/auth';
import { AppError } from '../utils/errorHandler';
import { VenuePreferences } from '../types/venues';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  res.type('html').send(`
    <!DOCTYPE html>
    <html>
    ${getHtmlHead('Venue Notifications')}
    <body>
      <div class="win95-window">
        <div class="win95-titlebar">
          <span>Venue Notifications</span>
          <a href="/" class="win95-close">×</a>
        </div>
        <div class="win95-content">
          <div id="map" style="height: 400px; width: 100%; margin-bottom: 20px;"></div>
          
          <form id="venuePreferences" class="venue-form">
            <div class="form-group">
              <label for="address">Address:</label>
              <input type="text" id="address" name="address" required>
            </div>

            <div class="form-group">
              <label for="radius">Radius: <span id="radiusDisplay">1.0</span> miles</label>
              <input 
                type="range" 
                id="radius" 
                name="radius" 
                min="0.1" 
                max="3.0" 
                step="0.1" 
                value="1.0" 
                class="slider" 
                required
              >
            </div>

            <div class="form-group">
              <label for="venueTypes">Venue Types:</label>
              <div id="venueTypes" class="checkbox-group"></div>
            </div>

            <div class="form-group">
              <label for="rating">Minimum Rating:</label>
              <input type="number" id="rating" name="rating" min="1" max="5" step="0.5" value="4" required>
            </div>

            <div class="form-group">
              <label for="months">Months to Look Back:</label>
              <input type="number" id="months" name="months" min="1" max="24" value="12" required>
            </div>

            <button type="submit" class="win95-button">Subscribe to Updates</button>
          </form>
        </div>
      </div>

      <script src="https://maps.googleapis.com/maps/api/js?key=${process.env.GOOGLE_MAPS_API_KEY}&libraries=places,geometry"></script>
      <script src="/venues/map.js"></script>
    </body>
    </html>
  `);
});

export default router; 