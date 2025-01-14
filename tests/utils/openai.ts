import OpenAI from 'openai';
import fs from 'fs/promises';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ElementAnalysis {
  element: string;
  description: string;
  testSuggestions: string[];
}

function isValidAnalysis(obj: any): obj is ElementAnalysis {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    typeof obj.element === 'string' &&
    typeof obj.description === 'string' &&
    Array.isArray(obj.testSuggestions) &&
    obj.testSuggestions.every((suggestion: any) => typeof suggestion === 'string')
  );
}

// Add delay helper
async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Add retry logic with exponential backoff
async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let retries = 0;
  while (true) {
    try {
      return await operation();
    } catch (error: any) {
      if (error?.status === 429 && retries < maxRetries) {
        const delayMs = initialDelay * Math.pow(2, retries);
        console.log(`Rate limited. Retrying in ${delayMs}ms...`);
        await delay(delayMs);
        retries++;
        continue;
      }
      throw error;
    }
  }
}

// Add function to truncate HTML source if too large
function truncateHtmlSource(html: string, maxTokens: number = 15000): string {
  // Rough estimate: 1 token ≈ 4 characters
  const maxChars = maxTokens * 4;
  if (html.length > maxChars) {
    console.log(`Truncating HTML source from ${html.length} to ${maxChars} characters`);
    return html.slice(0, maxChars) + '...';
  }
  return html;
}

export async function analyzeScreenshot(
  screenshotPath: string,
  htmlSource: string
): Promise<ElementAnalysis[]> {
  const imageData = await fs.readFile(screenshotPath, { encoding: 'base64' });
  
  // Truncate HTML source to avoid token limits
  const truncatedHtml = truncateHtmlSource(htmlSource);

  const prompt = `Analyze this webpage screenshot and its HTML source to identify key UI elements that should be tested. Focus on creating comprehensive, realistic test scenarios.

HTML Source:
${truncatedHtml}

For each testable element:
1. Describe its purpose and functionality
2. Suggest specific test cases including:
   - Basic functionality (visibility, interaction)
   - State changes and user interactions
   - Form validation and submission
   - Error handling and edge cases
3. Use precise selectors from the HTML source
4. Consider responsive design testing
5. Include data-testid attributes if present

Return a JSON object with an "elements" array containing objects with properties:
- element: the selector to use (class name, ID, data-testid, or appropriate CSS selector)
- description: its purpose and functionality
- testSuggestions: array of specific test cases as strings`;

  try {
    return await retryWithBackoff(async () => {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${imageData}`,
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        console.error('No content in OpenAI response');
        return [];
      }

      try {
        // No need to clean up markdown since we're using JSON mode
        const parsed = JSON.parse(content);
        
        // Expect the response to have an "elements" array
        const elements = parsed.elements;
        if (!Array.isArray(elements)) {
          console.error('OpenAI response does not contain elements array:', parsed);
          return [];
        }

        const validAnalyses = elements.filter(isValidAnalysis);
        if (validAnalyses.length < elements.length) {
          console.warn('Some analyses were invalid and filtered out');
        }

        return validAnalyses;
      } catch (parseError) {
        console.error('Error parsing OpenAI response as JSON:', parseError);
        console.log('Raw response:', content);
        return [];
      }
    });
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    return [];
  }
}

export function convertAnalysisToAssertions(
  analysis: ElementAnalysis[]
): string[] {
  const assertions: string[] = [];

  for (const element of analysis) {
    assertions.push(`// Testing ${element.element}`);
    assertions.push(`// ${element.description}`);

    for (const suggestion of element.testSuggestions) {
      // Convert test suggestions into Playwright assertions
      const assertion = convertSuggestionToAssertion(suggestion, element.element);
      if (assertion) {
        assertions.push(assertion);
      }
    }
    assertions.push('');
  }

  return assertions;
}

function convertSuggestionToAssertion(
  suggestion: string,
  elementName: string
): string | null {
  if (typeof suggestion !== 'string') {
    console.warn('Invalid suggestion type:', typeof suggestion);
    return null;
  }

  // Escape quotes in the selector
  const escapedSelector = elementName.replace(/'/g, '"');

  // Enhanced test assertion patterns
  const patterns = [
    {
      match: /visible|displayed/i,
      generate: () => `await expect(page.locator('${escapedSelector}')).toBeVisible();`
    },
    {
      match: /click/i,
      generate: () => `await page.locator('${escapedSelector}').click();`
    },
    {
      match: /type|input|fill/i,
      generate: () => `await page.locator('${escapedSelector}').fill('test value');`
    },
    {
      match: /submit|form/i,
      generate: () => [
        `await page.locator('${escapedSelector}').click();`,
        `await page.waitForLoadState('networkidle');`
      ].join('\n')
    },
    {
      match: /hover/i,
      generate: () => `await page.locator('${escapedSelector}').hover();`
    },
    {
      match: /enabled/i,
      generate: () => `await expect(page.locator('${escapedSelector}')).toBeEnabled();`
    },
    {
      match: /disabled/i,
      generate: () => `await expect(page.locator('${escapedSelector}')).toBeDisabled();`
    },
    {
      match: /text|content/i,
      generate: () => `await expect(page.locator('${escapedSelector}')).toHaveText(/./);`
    },
    {
      match: /aria|accessibility/i,
      generate: () => [
        `await expect(page.locator('${escapedSelector}')).toHaveAttribute('aria-label', /.+/);`,
        `await expect(page.locator('${escapedSelector}')).toBeFocused();`
      ].join('\n')
    },
    {
      match: /focus/i,
      generate: () => `await page.locator('${escapedSelector}').focus();`
    },
    {
      match: /keyboard|press/i,
      generate: () => `await page.keyboard.press('Enter');`
    },
    {
      match: /screenshot/i,
      generate: () => `await expect(page.locator('${escapedSelector}')).toHaveScreenshot();`
    }
  ];

  for (const pattern of patterns) {
    if (pattern.match.test(suggestion)) {
      return pattern.generate();
    }
  }

  // For suggestions that don't match patterns, return as comment
  return `// TODO: Implement test for: ${suggestion}`;
} 