const { test, expect } = require('@playwright/test');

// Page Object Model representing the Naturopathy Chat Page
class NaturoChatPage {
  constructor(page) {
    this.page = page;
    this.heading = page.getByRole('heading', { level: 1 });
    this.startJourneyBtn = page.getByRole('button', { name: /start your healing journey/i });
    this.chatInput = page.getByPlaceholder('Describe your symptoms in detail...');
    this.assistantMessages = page.getByTestId('assistant-message');
  }

  async navigate() {
    await this.page.goto('/');
  }

  async startSession() {
    await this.startJourneyBtn.click();
    await this.page.getByPlaceholder('Name').fill('Playwright Test Patient');
    await this.page.getByPlaceholder('Age').fill('30');
    await this.page.getByRole('combobox').selectOption('male');
    await this.page.getByPlaceholder('Region (e.g. India)').fill('India');
    await this.page.getByRole('button', { name: /begin your assessment/i }).click();
    await expect(this.assistantMessages.first()).toContainText('Welcome to NatureCure AI', { timeout: 15000 });
  }

  async sendQuery(query) {
    await this.chatInput.fill(query);
    await this.page.keyboard.press('Enter');
  }

  async waitForVisualHold() {
    // Only pause on local runs to let human developer visually inspect the UI response
    if (!process.env.CI) {
      await this.page.waitForTimeout(2000);
    }
  }
}

test.describe('Naturopathy Agent Chat Interface', () => {

  test('should load landing page and start chat session directly', async ({ page }) => {
    const chatPage = new NaturoChatPage(page);
    await chatPage.navigate();
    
    // 1. Verify landing page elements
    await expect(chatPage.heading).toContainText('Natural Healing.');
    
    // 2. Click journey button and verify welcome loads
    await chatPage.startSession();
  });

  test('should handle simple queries in Question Mode and render remedies', async ({ page }) => {
    const chatPage = new NaturoChatPage(page);
    await chatPage.navigate();
    await chatPage.startSession();

    // 1. Send simple symptom query
    await chatPage.sendQuery('What is a simple natural remedy for minor hiccups?');

    // 2. Assert it contains the remedy details (forces Playwright to wait for streaming response)
    const assistantMessage = chatPage.assistantMessages.last();
    await expect(assistantMessage).toContainText(/water|hiccup|breath/i, { timeout: 30000 });
    
    // 3. Pause for visual hold
    await chatPage.waitForVisualHold();
  });

  test('should handle vague inputs by asking for clarification', async ({ page }) => {
    const chatPage = new NaturoChatPage(page);
    await chatPage.navigate();
    await chatPage.startSession();

    // 1. Send vague query
    await chatPage.sendQuery('I have pain and am sick');

    // 2. Locate last assistant bubble and verify it asks for clarification
    const assistantMessage = chatPage.assistantMessages.last();
    await expect(assistantMessage).toContainText(/describe|clarify|detail|more|symptom|where/i, { timeout: 30000 });

    // 3. Pause for visual hold
    await chatPage.waitForVisualHold();
  });

  test('should recommend switching to Treatment Mode for severe chronic issues', async ({ page }) => {
    const chatPage = new NaturoChatPage(page);
    await chatPage.navigate();
    await chatPage.startSession();

    // 1. Send severe chronic disease query
    await chatPage.sendQuery('I have severe chronic autoimmune Hashimoto thyroiditis for last 5 years with extreme exhaustion');

    // 2. Locate last assistant bubble and verify recommended switch suggestion
    const assistantMessage = chatPage.assistantMessages.last();
    await expect(assistantMessage).toContainText(/treatment/i, { timeout: 30000 });

    // 3. Pause for visual hold
    await chatPage.waitForVisualHold();
  });
});
