const { test, expect } = require('@playwright/test');

test.describe('Naturopathy Practitioner E2E Workflow', () => {

  test('should gate Treatment Mode, allow intake completion, support admin review, and update patient view', async ({ page, context }) => {
    // Unique email for this test execution to bypass database conflicts
    const testEmail = `patient.${Date.now()}@example.com`;

    // 1. Visit Patient Portal homepage
    await page.goto('/');
    
    // 2. Click start journey and fill the demographic info
    await page.getByRole('button', { name: /start your healing journey/i }).click();
    await page.getByPlaceholder('Name').fill('John Patient');
    await page.getByPlaceholder('Age').fill('35');
    await page.getByRole('combobox').selectOption('male');
    await page.getByPlaceholder('Region (e.g. India)').fill('India');
    await page.getByRole('button', { name: /begin your assessment/i }).click();

    // Verify Welcome message is shown
    await expect(page.getByTestId('assistant-message').first()).toContainText('Welcome to NatureCure AI', { timeout: 15000 });

    // 3. Send severe symptom query to trigger Treatment Mode suggestion
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('I have severe autoimmune Hashimoto thyroiditis for 5 years with extreme chronic exhaustion and constant fatigue');
    await page.keyboard.press('Enter');

    // Wait for the agent to finish streaming and render the transition card
    // The agent will recommend Treatment Mode because the symptom is chronic and severe.
    await expect(page.getByRole('heading', { name: /treatment mode suggested/i, exact: false })).toBeVisible({ timeout: 40000 });

    // 4. Click transition button "Yes, Proceed"
    // Since John is not logged in, clicking this should automatically trigger the AuthModal to open.
    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // Verify the AuthModal has popped open
    await expect(page.getByRole('heading', { name: /welcome back|create an account/i })).toBeVisible();

    // Switch to Sign Up tab
    await page.getByRole('button', { name: /sign up/i }).click();

    // Fill signup details
    await page.getByPlaceholder('Full Name').fill('John Patient');
    await page.getByPlaceholder('Age').fill('35');
    await page.getByPlaceholder('City').fill('New Delhi');
    await page.getByPlaceholder('Email Address').fill(testEmail);
    await page.getByPlaceholder('Phone Number').fill('+919876543210');
    await page.getByPlaceholder('Password (min 6 chars)').fill('secure123');
    
    // Submit registration
    await page.getByRole('button', { name: /sign up/i, exact: true }).click();

    // Post-authentication, the pending mode switch is detected and the confirm overlay shows up
    await expect(page.getByRole('heading', { name: /treatment mode suggested/i, exact: false })).toBeVisible({ timeout: 15000 });

    // Click "Yes, Proceed" to trigger the intake start
    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // The backend should welcome the user to Treatment Mode and ask the first intake question
    // Let's answer 8 intake turns to complete the assessment.
    // Turn 1
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 1|tell me|detail/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('It started with brain fog, hair loss, and muscle weakness.');
    await page.keyboard.press('Enter');

    // Turn 2
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 2|diet|eat/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('I eat refined grains, dairy, sugar, and drink tea twice a day.');
    await page.keyboard.press('Enter');

    // Turn 3
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 3|sleep|rest/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('I sleep late around 1 AM and get about 6 hours of sleep.');
    await page.keyboard.press('Enter');

    // Turn 4
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 4|stress|emotional/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('High stress due to work pressure as a developer.');
    await page.keyboard.press('Enter');

    // Turn 5
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 5|exercise|active/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('I am very sedentary, sitting for 9-10 hours a day.');
    await page.keyboard.press('Enter');

    // Turn 6
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 6|digestion|bowel/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('Frequent constipation and gas.');
    await page.keyboard.press('Enter');

    // Turn 7
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 7|medical history|medication/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('Currently taking thyroxine 75mcg.');
    await page.keyboard.press('Enter');

    // Turn 8 (Final Turn)
    await expect(page.getByTestId('assistant-message').last()).toContainText(/question 8|anything else|complete/i, { timeout: 20000 });
    await page.getByPlaceholder('Describe your symptoms in detail...').fill('Nothing else to add.');
    await page.keyboard.press('Enter');

    // Wait for the "Case Pending Review" layout to render upon intake completion
    await expect(page.getByRole('heading', { name: /intake complete/i, exact: false })).toBeVisible({ timeout: 45000 });
    await expect(page.getByText('Case ID:')).toBeVisible();

    // Keep reference of the case id text to verify later
    const caseText = await page.getByText(/case id:/i).textContent();
    console.log(`E2E Case ID generated: ${caseText}`);

    // 5. Open admin dashboard in a new tab to approve the case
    const adminPage = await context.newPage();
    await adminPage.goto('/admin');

    // Log in as practitioner
    await adminPage.getByPlaceholder('Username').fill('admin');
    await adminPage.getByPlaceholder('Password').fill('admin123');
    await adminPage.getByRole('button', { name: /login/i }).click();

    // Verify RAG dashboard heading
    await expect(adminPage.getByRole('heading', { name: /naturopathy administration/i })).toBeVisible({ timeout: 15000 });

    // Switch to Practitioner Console tab
    await adminPage.getByRole('button', { name: /practitioner console/i }).click();

    // Locate John Patient in the pending cases list and click
    await adminPage.getByText('John Patient').first().click();

    // Wait for case transcript details to load
    await expect(adminPage.getByRole('heading', { name: /review case: john patient/i, exact: false })).toBeVisible({ timeout: 15000 });

    // Apply "Chronic Fatigue" template
    await adminPage.getByRole('button', { name: /fatigue restore/i }).click();

    // Verify fields are pre-populated
    const prescriptionInput = adminPage.locator('textarea').first();
    await expect(prescriptionInput).toContainText('Chronic Fatigue Restore Protocol');

    // Submit approval
    adminPage.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Prescription submitted successfully');
      await dialog.accept();
    });
    await adminPage.getByRole('button', { name: /approve & send prescription/i }).click();

    // Wait for queue item to clear
    await expect(adminPage.getByText('John Patient')).not.toBeVisible({ timeout: 15000 });

    // Close admin tab
    await adminPage.close();

    // 6. Go back to John's chat tab and click "Check Review Status"
    await page.bringToFront();
    await page.getByRole('button', { name: /check review status/i }).click();

    // Verify the approved prescription layout is rendered instantly
    await expect(page.getByRole('heading', { name: /approved nature cure protocol/i, exact: false })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText('Prescribed Protocol')).toBeVisible();
    await expect(page.getByText('Chronic Fatigue Restore Protocol')).toBeVisible();

    if (!process.env.CI) {
      await page.waitForTimeout(3000); // Visual inspection hold
    }
  });
});
