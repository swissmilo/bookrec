1. Set up a local testing framework that can be triggered directly within Cursor IDE to generate and run end-to-end integration tests based on user stories.

2. Test Generation and Execution:
   - Tests will be auto-generated using AI analysis of the application's visual state and behavior
   - Route discovery will be guided by the application's sitemap.xml to ensure comprehensive coverage
   - The system will:
     * Crawl all routes defined in sitemap.xml
     * Capture screenshots of each route in different viewports
     * Identify interactive elements and state transitions
     * Generate user stories based on visual analysis
     * Convert user stories into executable Playwright tests
   - Tests will be generated and run on-demand during development
   - Focus on immediate feedback rather than long-term test persistence
   - Results and insights will be displayed directly in the Cursor IDE
   - Generated tests can be reviewed, modified, and saved if desired

3. Tests will run against a local development server (localhost:3000) using Playwright to:
   - Execute actual web requests
   - Validate user flows
   - Check both client and server-side behavior
   - Capture console logs and network activity

4. The framework will support:
   - Multiple browsers (Chrome, Firefox, Safari) via Playwright
   - Different viewport sizes for desktop and mobile testing
   - Visual testing and screenshot comparisons
   - Network request interception and validation

5. Error logging and analysis will include:
   - Client-side console logs and errors
   - Server-side logs and stack traces
   - Network request/response data
   - Screenshots of failure states
   - Performance metrics
   - Automated error pattern analysis for quick debugging

6. The system will maintain a temporary test results cache that includes:
   - Test execution history
   - Error patterns
   - Screenshots and traces
   - Performance metrics
   These results will be available during the development session but don't need to persist long-term.

7. AI-Driven Visual Testing:
   - Automated screenshot capture of all routes in both mobile and desktop viewports
   - State capture for interactive elements (hover, click, form inputs)
   - Authentication state variations
   - Visual regression detection between deployments
   - Automatic generation of user stories based on UI analysis
   - Identification of critical user flows and edge cases
   - Suggestion of additional test scenarios based on visual patterns
   - Detection of accessibility issues from visual analysis
   - Automated documentation of UI components and their states

8. Tech Stack Requirements:
   - Playwright for browser automation and screenshot capture
   - OpenAI GPT-4 Vision API for visual analysis and test generation
   - TypeScript for type safety and better IDE integration
   - Jest for test execution and assertions
   - Pixelmatch for visual diff comparisons
   - MSW (Mock Service Worker) for network interception
   - GitHub Actions for CI/CD integration
   - Local SQLite database for temporary test results storage
   - Winston for structured logging
   - Prettier and ESLint for code formatting and linting

9. AI Integration Requirements:
   - API integration with GPT-4 Vision for screenshot analysis
   - Prompt engineering for consistent test generation
   - Natural language processing for converting visual analysis into executable tests
   - Feedback loop for improving AI accuracy based on test results
   - Version control integration for tracking AI-generated test evolution
   - Automatic PR comments with visual testing results and AI insights
   - Rate limiting and caching to manage API costs
   - Fallback mechanisms for when AI services are unavailable
