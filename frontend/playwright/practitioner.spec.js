const { test, expect } = require('@playwright/test');

test.describe('Naturopathy Practitioner E2E Workflow', () => {

  test('should gate Treatment Mode, allow intake completion, support admin review, and update patient view', async ({ page, context }) => {
    test.setTimeout(240000);
    page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
    page.on('response', response => {
      if (!response.ok()) {
        console.log(`NETWORK ERROR: ${response.status()} ${response.url()}`);
      }
    });
    
    // Unique email for this test execution to bypass database conflicts
    const testEmail = `patient.${Date.now()}@example.com`;
    const testName = `John Patient ${Date.now().toString().slice(-4)}`;

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
    await expect(page.getByTestId('switch-to-treatment-btn')).toBeVisible({ timeout: 90000 });
    await page.getByTestId('switch-to-treatment-btn').click();
    await expect(page.getByRole('heading', { name: /treatment mode suggested/i, exact: false })).toBeVisible({ timeout: 5000 });

    // 4. Click transition button "Yes, Proceed"
    // Since John is not logged in, clicking this should automatically trigger the AuthModal to open.
    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // Verify the AuthModal has popped open
    await expect(page.getByRole('heading', { name: /welcome back|create an account/i })).toBeVisible();

    // Switch to Sign Up tab
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

    // Fill signup details
    await page.getByPlaceholder('Full Name').fill(testName);
    await page.getByPlaceholder('Age').fill('35');
    await page.getByPlaceholder('City').fill('New Delhi');
    await page.getByPlaceholder('Email Address').fill(testEmail);
    await page.getByPlaceholder('Phone Number').fill(`+91${Date.now().toString().slice(-10)}`);
    await page.getByPlaceholder('Password (min 6 chars)').fill('secure123');
    
    // Submit registration
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

    // Post-authentication, the pending mode switch is detected and the confirm overlay shows up
    await expect(page.getByRole('heading', { name: /treatment mode suggested/i, exact: false })).toBeVisible({ timeout: 15000 });

    // Click "Yes, Proceed" to trigger the intake start
    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // The backend should welcome the user to Treatment Mode and ask the first intake question
    // Wait for Step 1 form to appear
    await expect(page.getByText('Step 1: Core Health Concerns')).toBeVisible({ timeout: 20000 });

    // Step 1 fields
    await page.getByPlaceholder(/primary complaint/i).fill(
      'Severe Hashimoto thyroiditis with chronic fatigue, brain fog, hair loss'
    );
    await page.getByPlaceholder(/e.g. 5 years/i).fill('5 years');
    await page.locator('input[type="range"]').fill('8');
    await page.getByPlaceholder(/list allergies/i).fill('No allergies, not pregnant');

    // Click Next
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Step 2 should appear
    await expect(page.getByText('Step 2: Medical & Lifestyle Profile')).toBeVisible({ timeout: 5000 });

    // Step 2 fields
    await page.getByPlaceholder(/past diagnoses/i).fill('Hashimoto thyroiditis, Vitamin D deficiency');
    await page.getByPlaceholder(/medications/i).fill('Levothyroxine 75mcg, Vitamin D3');
    await page.getByPlaceholder(/vegetarian, high-protein/i).fill('Vegetarian, moderate appetite, 2L water/day');
    await page.getByPlaceholder(/6 hours sleep, moderate stress/i).fill('6 hours sleep, high stress, sedentary desk job');

    // Click Next: Review
    await page.getByRole('button', { name: /next.*review/i }).click();

    // Step 3: Review screen
    await expect(page.getByText('Step 3: Review Your Submitted Details')).toBeVisible({ timeout: 5000 });

    // Submit the form
    await page.getByRole('button', { name: /confirm.*submit to doctor/i }).click();

    // Wait for redirect to /history and see pending case
    await expect(page).toHaveURL(/\/history/, { timeout: 60000 });
    await expect(page.getByText(/pending review/i).first()).toBeVisible({ timeout: 15000 });

    // Keep reference of the case id text to verify later
    const caseText = await page.getByText(/Case #/i).first().textContent();
    console.log(`E2E Case ID generated: ${caseText.trim()}`);

    // 5. Open admin dashboard in a new tab to approve the case
    const adminPage = await context.newPage();
    await adminPage.goto('/admin');

    // Log in as practitioner
    await adminPage.getByPlaceholder('Username').fill('admin');
    await adminPage.getByPlaceholder('Password').fill('admin');
    await adminPage.getByRole('button', { name: /login/i }).click();

    // Verify RAG dashboard heading
    await expect(adminPage.getByRole('heading', { name: /naturopathy administration/i })).toBeVisible({ timeout: 15000 });

    // Switch to Practitioner Console tab
    await adminPage.getByRole('button', { name: /practitioner console/i }).click();

    // Locate the unique patient in the pending cases list and click
    await adminPage.getByText(testName).first().click();

    // Wait for case transcript details to load
    await expect(adminPage.getByRole('heading', { name: new RegExp(`review case: ${testName}`, 'i') })).toBeVisible({ timeout: 15000 });

    // Apply "Body Pain" template
    await adminPage.getByRole('button', { name: /body pain/i }).click();

    // Verify fields are pre-populated
    const prescriptionInput = adminPage.locator('textarea').first();
    await expect(prescriptionInput).toContainText(/body pain|musculoskeletal/i);

    // Submit approval
    adminPage.once('dialog', async dialog => {
      expect(dialog.message()).toContain('Prescription submitted successfully');
      await dialog.accept();
    });
    await adminPage.getByRole('button', { name: /approve & send prescription/i }).click();

    // Wait for queue item to clear
    await expect(adminPage.getByText(testName).first()).not.toBeVisible({ timeout: 15000 });

    // Close admin tab
    await adminPage.close();

    // 6. Go back to patient's tab (on /history) and reload to view approved prescription
    await page.bringToFront();
    await page.reload();
    await expect(page.getByText(/pending review|prescription ready/i).first()).toBeVisible({ timeout: 15000 });
    
    // Click case to expand details
    await page.getByText(/Case #/i).first().click();
    await expect(page.getByRole('heading', { name: /doctor's prescription/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/body pain|musculoskeletal/i).first()).toBeVisible();

    if (!process.env.CI) {
      await page.waitForTimeout(3000); // Visual inspection hold
    }
  });
});
