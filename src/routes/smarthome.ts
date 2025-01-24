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
    // Fetch the last 24 hours of readings
    const { data: readings, error } = await supabase
      .from('sensor_readings')
      .select('*')
      .order('timestamp', { ascending: true })
      .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

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
          const readings = ${JSON.stringify(readings)};
          const timeLabels = readings.map(r => new Date(r.timestamp).toLocaleTimeString());
          
          function createChart(ctx, label, data, color) {
            return new Chart(ctx, {
              type: 'line',
              data: {
                labels: timeLabels,
                datasets: [{
                  label: label,
                  data: data,
                  borderColor: color,
                  tension: 0.1
                }]
              },
              options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    beginAtZero: false
                  }
                }
              }
            });
          }

          // Create temperature chart with both C and F
          new Chart(document.getElementById('tempChart').getContext('2d'), {
            type: 'line',
            data: {
              labels: timeLabels,
              datasets: [
                {
                  label: 'Temperature (°C)',
                  data: readings.map(r => r.temperature),
                  borderColor: '#FF6384',
                  tension: 0.1,
                  yAxisID: 'celsius'
                },
                {
                  label: 'Temperature (°F)',
                  data: readings.map(r => (r.temperature * 9/5) + 32),
                  borderColor: '#FF9F40',
                  tension: 0.1,
                  yAxisID: 'fahrenheit'
                }
              ]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              interaction: {
                mode: 'index',
                intersect: false,
              },
              scales: {
                celsius: {
                  type: 'linear',
                  display: true,
                  position: 'left',
                  title: {
                    display: true,
                    text: 'Celsius (°C)'
                  }
                },
                fahrenheit: {
                  type: 'linear',
                  display: true,
                  position: 'right',
                  title: {
                    display: true,
                    text: 'Fahrenheit (°F)'
                  },
                  grid: {
                    drawOnChartArea: false
                  }
                }
              }
            }
          });

          // Create humidity chart
          createChart(
            document.getElementById('humidityChart').getContext('2d'),
            'Humidity (%)',
            readings.map(r => r.humidity),
            '#36A2EB'
          );

          createChart(
            document.getElementById('co2Chart').getContext('2d'),
            'CO2 (ppm)',
            readings.map(r => r.co2),
            '#4BC0C0'
          );

          createChart(
            document.getElementById('pressureChart').getContext('2d'),
            'Pressure (hPa)',
            readings.map(r => r.pressure),
            '#FF9F40'
          );
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