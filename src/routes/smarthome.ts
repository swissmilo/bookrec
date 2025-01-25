import { Router, Request, Response, NextFunction } from 'express';
import { getHtmlHead } from '../utils/htmlHead';
import supabase from '../utils/supabase';
import { AppError } from '../utils/errorHandler';

const router = Router();

interface SensorReading {
  deviceId: string;
  readings: {
    co2: number;
    temperature: number;
    humidity: number;
    pressure: number;
    timestamp: string;
  };
}

// Middleware to validate API key
const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey || apiKey !== process.env.SENSOR_API_KEY) {
    throw new AppError('Invalid or missing API key', 401);
  }
  
  next();
};

// GET endpoint to display the dashboard
router.get('/', async (req: Request, res: Response) => {
  try {
    // Get today's date at midnight UTC for 7-day window
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    
    // Get 7 days ago at midnight UTC
    const sevenDaysAgo = new Date(todayUTC);
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);

    // Fetch the last 7 days of readings
    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .order('timestamp', { ascending: true })
      .gte('timestamp', sevenDaysAgo.toISOString());

    if (error) throw error;

    // Keep timestamps in UTC, let browser handle conversion
    const readingsEST = readings?.map(reading => ({
      ...reading,
      timestamp: reading.timestamp  // Keep the UTC timestamp
    })) || [];

    // Generate 24-hour timeline labels (00:00 to 24:00)
    const timeLabels = Array.from({ length: 25 }, (_, i) => {
      const hour = i.toString().padStart(2, '0');
      return `${hour}:00`;
    });

    // Process readings to get today's data and 7-day averages
    const todayMidnight = new Date(new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }));
    todayMidnight.setHours(0, 0, 0, 0);
    
    const todayReadings = readingsEST?.filter(r => {
      const date = new Date(r.timestamp);
      const localDate = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      return localDate >= todayMidnight;
    }) || [];
    
    // Calculate 7-day averages for each hour using local time
    const hourlyAverages = Array.from({ length: 25 }, (_, hour) => {
      const hourReadings = readingsEST?.filter(r => {
        const date = new Date(r.timestamp);
        const utcHour = (date.getUTCHours() + 19) % 24; // Convert UTC to EST (UTC-5)
        return utcHour === (hour % 24);
      }) || [];

      if (hourReadings.length === 0) return {
        temperature: null,
        humidity: null,
        co2: null,
        pressure: null
      };

      return {
        temperature: hourReadings.reduce((sum, r) => sum + ((r.temperature * 9/5) + 32), 0) / hourReadings.length,
        humidity: hourReadings.reduce((sum, r) => sum + r.humidity, 0) / hourReadings.length,
        co2: hourReadings.reduce((sum, r) => sum + r.co2, 0) / hourReadings.length,
        pressure: hourReadings.reduce((sum, r) => sum + r.pressure, 0) / hourReadings.length
      };
    });

    // Get the most recent reading
    const latestReading = todayReadings[todayReadings.length - 1];

    res.type('html').send(`
      <!DOCTYPE html>
      <html lang="en">
      ${getHtmlHead('Smart Home Dashboard')}
      <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
      <body>
        <div class="win95-window">
          <div class="win95-titlebar" role="banner">
            <span role="heading" aria-level="1">Smart Home Dashboard</span>
            <a href="/" class="win95-close" aria-label="Close window">×</a>
          </div>
          <div class="win95-content">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-bottom: 20px;">
              <div class="win95-window" style="padding: 10px;">
                <canvas id="tempChart"></canvas>
              </div>
              <div class="win95-window" style="padding: 10px;">
                <canvas id="humidityChart"></canvas>
              </div>
              <div class="win95-window" style="padding: 10px;">
                <canvas id="co2Chart"></canvas>
              </div>
              <div class="win95-window" style="padding: 10px;">
                <canvas id="pressureChart"></canvas>
              </div>
            </div>
          </div>
        </div>

        <script>
          const timeLabels = ${JSON.stringify(timeLabels)};
          const todayReadings = ${JSON.stringify(todayReadings)};
          const hourlyAverages = ${JSON.stringify(hourlyAverages)};
          const latestReading = ${JSON.stringify(latestReading)};

          // Helper function to get data point for each hour
          function getHourlyData(readings, valueKey, transform = (x) => x) {
            return Array.from({ length: 25 }, (_, hour) => {
              const hourReadings = readings.filter(r => {
                const date = new Date(r.timestamp);
                const utcHour = (date.getUTCHours() + 19) % 24; // Convert UTC to EST (UTC-5)
                return utcHour === (hour % 24);
              });
              if (hourReadings.length === 0) return null;
              return transform(hourReadings[hourReadings.length - 1][valueKey]);
            });
          }

          function createDualDatasetChart(ctx, config) {
            const { label, todayData, avgData, color, yAxisConfig } = config;
            
            // Get the latest non-null value
            const latestValue = todayData.reduce((latest, value) => value !== null ? value : latest, null);
            const formattedLatest = latestValue !== null ? latestValue.toFixed(1) : 'N/A';

            // Calculate min and max values from both datasets
            const allValues = [...todayData, ...avgData].filter(v => v !== null);
            const dataMin = Math.min(...allValues);
            const dataMax = Math.max(...allValues);
            const range = dataMax - dataMin;
            
            // Add 10% padding to the range
            const padding = range * 0.1;
            const yMin = Math.max(yAxisConfig?.min || -Infinity, Math.floor(dataMin - padding));
            const yMax = yAxisConfig?.max || Math.ceil(dataMax + padding);
            
            return new Chart(ctx, {
              type: 'line',
              data: {
                labels: timeLabels,
                datasets: [
                  {
                    label: \`Today's \${label} (Latest: \${formattedLatest})\`,
                    data: todayData,
                    borderColor: color,
                    tension: 0.1,
                    spanGaps: true,
                    pointStyle: (ctx) => {
                      const index = ctx.dataIndex;
                      const value = ctx.dataset.data[index];
                      if (value === todayData[todayData.length - 1] && value !== null) {
                        return 'circle';
                      }
                      return 'dot';
                    },
                    pointRadius: (ctx) => {
                      const index = ctx.dataIndex;
                      const value = ctx.dataset.data[index];
                      if (value === todayData[todayData.length - 1] && value !== null) {
                        return 6;
                      }
                      return 3;
                    }
                  },
                  {
                    label: \`7-Day Average \${label}\`,
                    data: avgData,
                    borderColor: color,
                    borderDash: [5, 5],
                    tension: 0.1,
                    pointRadius: 0
                  }
                ]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                  mode: 'index',
                  intersect: false
                },
                scales: {
                  y: {
                    ...yAxisConfig,
                    min: yMin,
                    max: yMax,
                    ticks: {
                      callback: (value) => value.toFixed(1),
                      count: 8  // Suggest approximately 8 tick marks on the Y axis
                    }
                  }
                }
              }
            });
          }

          // Create temperature chart (Fahrenheit only)
          createDualDatasetChart(document.getElementById('tempChart').getContext('2d'), {
            label: 'Temperature (°F)',
            todayData: getHourlyData(todayReadings, 'temperature', t => (t * 9/5) + 32),
            avgData: hourlyAverages.map(avg => avg.temperature),
            color: 'rgba(255, 99, 132, 1)',
            yAxisConfig: {
              title: {
                display: true,
                text: 'Fahrenheit (°F)'
              }
            }
          });

          // Create humidity chart
          createDualDatasetChart(document.getElementById('humidityChart').getContext('2d'), {
            label: 'Humidity (%)',
            todayData: getHourlyData(todayReadings, 'humidity'),
            avgData: hourlyAverages.map(avg => avg.humidity),
            color: 'rgba(54, 162, 235, 1)',
            yAxisConfig: {}
          });

          // Create CO2 chart
          createDualDatasetChart(document.getElementById('co2Chart').getContext('2d'), {
            label: 'CO2 (ppm)',
            todayData: getHourlyData(todayReadings, 'co2'),
            avgData: hourlyAverages.map(avg => avg.co2),
            color: 'rgba(75, 192, 192, 1)',
            yAxisConfig: {}
          });

          // Create pressure chart
          createDualDatasetChart(document.getElementById('pressureChart').getContext('2d'), {
            label: 'Pressure (hPa)',
            todayData: getHourlyData(todayReadings, 'pressure'),
            avgData: hourlyAverages.map(avg => avg.pressure),
            color: 'rgba(255, 159, 64, 1)',
            yAxisConfig: {}
          });
        </script>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('Error fetching sensor readings:', error);
    res.status(500).send('Error loading dashboard');
  }
});

// POST endpoint for sensor readings
router.post('/sensor', validateApiKey, async (req: Request<{}, {}, SensorReading>, res: Response) => {
  try {
    const { deviceId, readings } = req.body;

    if (!deviceId || !readings) {
      throw new AppError('Missing required fields', 400);
    }

    // Insert the reading into Supabase
    const { error } = await supabase
      .from('sensor_readings')
      .insert([{
        device_id: deviceId,
        temperature: readings.temperature,
        humidity: readings.humidity,
        co2: readings.co2,
        pressure: readings.pressure,
        timestamp: readings.timestamp
      }]);

    if (error) throw error;

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving sensor reading:', error);
    if (error instanceof AppError) {
      res.status(error.status).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Failed to save sensor reading' });
    }
  }
});

export default router; 