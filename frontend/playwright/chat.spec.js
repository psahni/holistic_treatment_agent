const { test, expect } = require('@playwright/test');

test.describe('Naturopathy Agent Chat Interface', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to local home page
    await page.goto('/');
  });

  test('should load landing page and start chat session directly', async ({ page }) => {
    // 1. Verify landing page elements
    await expect(page.locator('h1')).toContainText('Natural Healing.');
    
    // 2. Click "Start Your Healing Journey" to initialize session
    const startBtn = page.getByRole('button', { name: /start your healing journey/i });
    await startBtn.click();
    
    // 3. Verify chat welcome loads
    const firstMessage = page.getByTestId('assistant-message').first();
    await expect(firstMessage).toContainText('Welcome to NatureCure AI', { timeout: 15000 });
  });

  test('should handle simple queries in Question Mode and render remedies', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /start your healing journey/i });
    await startBtn.click();

    // 1. Send simple symptom query
    const chatInput = page.getByPlaceholder('Describe your symptoms in detail...');
    await chatInput.fill('What is a simple natural remedy for minor hiccups?');
    await page.keyboard.press('Enter');

    // 2. Locate the last assistant response bubble via test-id
    const assistantMessage = page.getByTestId('assistant-message').last();
    
    // 3. Assert it contains the remedy details (forces Playwright to wait for streaming response)
    await expect(assistantMessage).toContainText(/water|hiccup|breath/i, { timeout: 30000 });
    
    // 4. Pause for 2 seconds to let the user see the response on the UI before closing
    await page.waitForTimeout(2000);
  });

  test('should handle vague inputs by asking for clarification', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /start your healing journey/i });
    await startBtn.click();

    // Send vague query
    const chatInput = page.getByPlaceholder('Describe your symptoms in detail...');
    await chatInput.fill('I have pain and am sick');
    await page.keyboard.press('Enter');

    // Locate last assistant bubble and verify it asks for clarification
    const assistantMessage = page.getByTestId('assistant-message').last();
    await expect(assistantMessage).toContainText(/describe|clarify|detail|more|symptom|where/i, { timeout: 30000 });

    // Pause for 2 seconds to see
    await page.waitForTimeout(2000);
  });

  test('should recommend switching to Treatment Mode for severe chronic issues', async ({ page }) => {
    const startBtn = page.getByRole('button', { name: /start your healing journey/i });
    await startBtn.click();

    // Send severe chronic disease query
    const chatInput = page.getByPlaceholder('Describe your symptoms in detail...');
    await chatInput.fill('I have severe chronic autoimmune Hashimoto thyroiditis for last 5 years with extreme exhaustion');
    await page.keyboard.press('Enter');

    // Locate last assistant bubble and verify recommended switch suggestion
    const assistantMessage = page.getByTestId('assistant-message').last();
    await expect(assistantMessage).toContainText(/treatment/i, { timeout: 30000 });

    // Pause for 2 seconds to see
    await page.waitForTimeout(2000);
  });
});
