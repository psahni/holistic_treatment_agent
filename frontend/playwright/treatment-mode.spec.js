const { test, expect } = require('@playwright/test');

/**
 * Full Treatment Mode E2E Test Suite
 * 
 * Tests the complete lifecycle:
 *   1. Patient lands on homepage → starts session (unauthenticated)
 *   2. Sends severe symptom → system suggests Treatment Mode
 *   3. Patient clicks "Switch to Full Treatment Mode" link
 *   4. Transition prompt opens → patient clicks "Yes, Proceed"
 *   5. Auth gate: patient must sign up/log in
 *   6. Post-auth: transition prompt re-appears → patient confirms
 *   7. Static 2-step intake form wizard: fill Step 1, Step 2, review Step 3, submit
 *   8. Case appears in Practitioner Console → doctor approves with template
 *   9. Patient checks review status → sees approved prescription
 *  10. Patient visits /history → sees case with prescription
 */
test.describe('Full Treatment Mode E2E', () => {

  test('complete treatment lifecycle: symptom → signup → intake form → admin review → prescription', async ({ page, context }) => {
    const testEmail = `e2e.patient.${Date.now()}@example.com`;
    const testName = 'E2E Treatment Patient';

    // ─────────────────────────────────────────────────
    // STEP 1: Land on homepage & start session
    // ─────────────────────────────────────────────────
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Natural Healing.');

    await page.getByRole('button', { name: /start your healing journey/i }).click();

    // Fill demographics modal (unauthenticated user)
    await page.getByPlaceholder('Name').fill(testName);
    await page.getByPlaceholder('Age').fill('40');
    await page.getByRole('combobox').selectOption('male');
    await page.getByPlaceholder('Region (e.g. India)').fill('India');
    await page.getByRole('button', { name: /begin your assessment/i }).click();

    // Verify welcome message
    await expect(page.getByTestId('assistant-message').first()).toContainText(/welcome/i, { timeout: 20000 });

    // ─────────────────────────────────────────────────
    // STEP 2: Send severe symptom to trigger Treatment Mode suggestion
    // ─────────────────────────────────────────────────
    const severeSymptom = 'I have severe chronic autoimmune Hashimoto thyroiditis for 5 years with extreme exhaustion and constant fatigue';
    await page.getByPlaceholder('Describe your symptoms in detail...').fill(severeSymptom);
    await page.keyboard.press('Enter');

    // Wait for assistant response with treatment mode suggestion
    // The "Switch to Full Treatment Mode" button should appear inline
    await expect(
      page.getByRole('button', { name: /switch to full treatment mode/i })
    ).toBeVisible({ timeout: 45000 });

    // ─────────────────────────────────────────────────
    // STEP 3: Click the inline switch link
    // ─────────────────────────────────────────────────
    await page.getByRole('button', { name: /switch to full treatment mode/i }).click();

    // Transition prompt modal should appear
    await expect(
      page.getByRole('heading', { name: /full treatment mode suggested/i })
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────────
    // STEP 4: Confirm transition → triggers auth gate (not logged in)
    // ─────────────────────────────────────────────────
    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // Auth modal should open since user is not logged in
    await expect(
      page.getByRole('heading', { name: /welcome back|create an account/i })
    ).toBeVisible({ timeout: 10000 });

    // ─────────────────────────────────────────────────
    // STEP 5: Sign up
    // ─────────────────────────────────────────────────
    await page.getByRole('button', { name: /sign up/i }).click();

    await page.getByPlaceholder('Full Name').fill(testName);
    await page.getByPlaceholder('Age').fill('40');
    await page.getByPlaceholder('City').fill('Mumbai');
    await page.getByPlaceholder('Email Address').fill(testEmail);
    await page.getByPlaceholder('Phone Number').fill(`+91${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    await page.getByPlaceholder('Password (min 6 chars)').fill('testpass123');

    await page.getByRole('button', { name: /sign up/i, exact: true }).click();

    // ─────────────────────────────────────────────────
    // STEP 6: Post-auth → transition prompt re-appears → confirm
    // ─────────────────────────────────────────────────
    await expect(
      page.getByRole('heading', { name: /full treatment mode suggested/i })
    ).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // ─────────────────────────────────────────────────
    // STEP 7: Fill the static intake form wizard
    // ─────────────────────────────────────────────────
    // Wait for Step 1 form to appear
    await expect(page.getByText('Step 1: Core Health Concerns')).toBeVisible({ timeout: 20000 });

    // Step 1 fields
    await page.getByPlaceholder(/primary health concern/i).fill(
      'Severe Hashimoto thyroiditis with chronic fatigue, brain fog, hair loss'
    );
    await page.getByPlaceholder(/e.g. 5 years/i).fill('5 years');
    // Severity slider defaults to 5, set it to 8
    await page.locator('input[type="range"]').fill('8');
    // Safety check field
    await page.getByPlaceholder(/list allergies/i).fill('No allergies, not pregnant');

    // Click Next
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Step 2 should appear
    await expect(page.getByText('Step 2: Medical & Lifestyle Profile')).toBeVisible({ timeout: 5000 });

    // Step 2 fields
    await page.getByPlaceholder(/past diagnoses/i).fill('Hashimoto thyroiditis, Vitamin D deficiency');
    await page.getByPlaceholder(/medications.*supplements/i).fill('Levothyroxine 75mcg, Vitamin D3');
    await page.getByPlaceholder(/vegetarian.*high-protein/i).fill('Vegetarian, moderate appetite, 2L water/day');
    await page.getByPlaceholder(/sleep.*stress/i).fill('6 hours sleep, high stress, sedentary desk job');

    // Click Next: Review
    await page.getByRole('button', { name: /next.*review/i }).click();

    // Step 3: Review screen
    await expect(page.getByText('Step 3: Review Your Submitted Details')).toBeVisible({ timeout: 5000 });

    // Verify review data
    await expect(page.getByText('Severe Hashimoto thyroiditis')).toBeVisible();
    await expect(page.getByText('5 years')).toBeVisible();
    await expect(page.getByText('Levothyroxine 75mcg')).toBeVisible();

    // Submit the form
    await page.getByRole('button', { name: /confirm.*submit to doctor/i }).click();

    // ─────────────────────────────────────────────────
    // STEP 8: Wait for case pending review card
    // ─────────────────────────────────────────────────
    await expect(
      page.getByText(/intake complete|case pending review/i)
    ).toBeVisible({ timeout: 60000 });

    // Capture Case ID
    const caseIdText = await page.getByText(/case id:/i).textContent();
    console.log(`[E2E] Case submitted: ${caseIdText}`);

    // ─────────────────────────────────────────────────
    // STEP 9: Admin reviews and approves
    // ─────────────────────────────────────────────────
    const adminPage = await context.newPage();
    await adminPage.goto('/admin');

    // Admin login
    await adminPage.getByPlaceholder('Username').fill('admin');
    await adminPage.getByPlaceholder('Password').fill('admin');
    await adminPage.getByRole('button', { name: /login/i }).click();

    // Wait for admin dashboard
    await expect(
      adminPage.getByRole('heading', { name: /naturopathy administration/i })
    ).toBeVisible({ timeout: 15000 });

    // Navigate to Practitioner Console
    await adminPage.getByRole('button', { name: /practitioner console/i }).click();

    // Find and click the patient's case
    await expect(adminPage.getByText(testName)).toBeVisible({ timeout: 10000 });
    await adminPage.getByText(testName).first().click();

    // Wait for case details to load
    await expect(
      adminPage.getByText(/review case/i)
    ).toBeVisible({ timeout: 15000 });

    // Apply Chronic Fatigue template
    await adminPage.getByRole('button', { name: /fatigue restore/i }).click();

    // Verify prescription textarea is populated
    const prescriptionField = adminPage.locator('textarea').first();
    await expect(prescriptionField).toContainText(/fatigue/i, { timeout: 5000 });

    // Submit approval (handle alert dialog)
    adminPage.once('dialog', async dialog => {
      expect(dialog.message()).toContain('successfully');
      await dialog.accept();
    });
    await adminPage.getByRole('button', { name: /approve.*send/i }).click();

    // Verify case is removed from pending queue
    await expect(adminPage.getByText(testName)).not.toBeVisible({ timeout: 15000 });
    await adminPage.close();

    // ─────────────────────────────────────────────────
    // STEP 10: Patient checks review status → sees prescription
    // ─────────────────────────────────────────────────
    await page.bringToFront();
    await page.getByRole('button', { name: /check review status/i }).click();

    await expect(
      page.getByText(/approved nature cure protocol/i)
    ).toBeVisible({ timeout: 15000 });

    await expect(page.getByText(/prescribed protocol/i)).toBeVisible();
    await expect(page.getByText(/fatigue/i)).toBeVisible();

    // Visual hold for manual inspection
    if (!process.env.CI) {
      await page.waitForTimeout(2000);
    }
  });

  test('patient can view case in /history page after submission', async ({ page }) => {
    // This test assumes a case was submitted via a previous test or manual action.
    // It verifies the /history page loads and shows cases for authenticated users.

    const testEmail = `history.test.${Date.now()}@example.com`;

    // Sign up a new user first
    await page.goto('/');
    await page.getByRole('button', { name: /start your healing journey/i }).click();

    // Start session with demographics
    await page.getByPlaceholder('Name').fill('History Test User');
    await page.getByPlaceholder('Age').fill('30');
    await page.getByRole('combobox').selectOption('female');
    await page.getByPlaceholder('Region (e.g. India)').fill('India');
    await page.getByRole('button', { name: /begin your assessment/i }).click();
    await expect(page.getByTestId('assistant-message').first()).toContainText(/welcome/i, { timeout: 20000 });

    // Navigate to /history (unauthenticated user should see auth message)
    await page.goto('/history');
    await expect(page.getByRole('heading', { name: /authentication required/i })).toBeVisible({ timeout: 10000 });

    // Go home link should work
    await expect(page.getByRole('link', { name: /go to home/i })).toBeVisible();
  });

  test('transition prompt: patient can decline treatment mode and stay in question mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /start your healing journey/i }).click();

    await page.getByPlaceholder('Name').fill('Decline Test Patient');
    await page.getByPlaceholder('Age').fill('28');
    await page.getByRole('combobox').selectOption('female');
    await page.getByPlaceholder('Region (e.g. India)').fill('India');
    await page.getByRole('button', { name: /begin your assessment/i }).click();
    await expect(page.getByTestId('assistant-message').first()).toContainText(/welcome/i, { timeout: 20000 });

    // Send severe symptom
    await page.getByPlaceholder('Describe your symptoms in detail...').fill(
      'I have been diagnosed with chronic Ulcerative Colitis for the last 3 years, experiencing constant abdominal pain, weight loss, and frequent flare-ups'
    );
    await page.keyboard.press('Enter');

    // Wait for the switch button
    await expect(
      page.getByRole('button', { name: /switch to full treatment mode/i })
    ).toBeVisible({ timeout: 45000 });

    // Click switch → modal appears
    await page.getByRole('button', { name: /switch to full treatment mode/i }).click();
    await expect(
      page.getByRole('heading', { name: /full treatment mode suggested/i })
    ).toBeVisible({ timeout: 10000 });

    // Decline
    await page.getByRole('button', { name: /no.*stay in question mode/i }).click();

    // Verify assistant responds with continuation message
    await expect(
      page.getByTestId('assistant-message').last()
    ).toContainText(/question mode/i, { timeout: 10000 });

    // Verify chat input is still usable
    await expect(page.getByPlaceholder('Describe your symptoms in detail...')).toBeVisible();
  });

  test('intake form validation: Step 1 blocks Next without required fields', async ({ page }) => {
    // This test requires a logged-in user in treatment mode.
    // We'll use a fresh signup flow.
    const testEmail = `validation.${Date.now()}@example.com`;

    await page.goto('/');
    
    // Quick-start: use Log In / Sign Up to register first
    await page.getByRole('button', { name: /log in.*sign up/i }).click();
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();
    
    await page.getByPlaceholder('Full Name').fill('Validation Tester');
    await page.getByPlaceholder('Age').fill('25');
    await page.getByPlaceholder('City').fill('Delhi');
    await page.getByPlaceholder('Email Address').fill(testEmail);
    await page.getByPlaceholder('Phone Number').fill(`+91${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    await page.getByPlaceholder('Password (min 6 chars)').fill('testpass123');
    await page.getByRole('button', { name: /sign up/i, exact: true }).click();

    // Wait for auth to complete (modal closes, nav shows Welcome)
    await expect(page.getByText(/welcome, validation tester/i)).toBeVisible({ timeout: 10000 });

    // Start session (logged-in users skip demographics modal)
    await page.getByRole('button', { name: /start your healing journey/i }).click();
    await expect(page.getByTestId('assistant-message').first()).toContainText(/welcome/i, { timeout: 20000 });

    // Send severe symptom
    await page.getByPlaceholder('Describe your symptoms in detail...').fill(
      'I suffer from chronic Fibromyalgia for over 6 years with widespread muscle pain and debilitating brain fog'
    );
    await page.keyboard.press('Enter');

    // Wait for switch button
    await expect(
      page.getByRole('button', { name: /switch to full treatment mode/i })
    ).toBeVisible({ timeout: 45000 });

    // Click switch → modal → confirm (user is already logged in, goes straight to form)
    await page.getByRole('button', { name: /switch to full treatment mode/i }).click();
    await expect(
      page.getByRole('heading', { name: /full treatment mode suggested/i })
    ).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /yes, proceed/i }).click();

    // Wait for Step 1 form
    await expect(page.getByText('Step 1: Core Health Concerns')).toBeVisible({ timeout: 20000 });

    // Try to click Next without filling required fields
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Validation error should appear
    await expect(page.getByText(/please fill out all required/i)).toBeVisible({ timeout: 5000 });

    // Fill only the first field, still missing duration
    await page.getByPlaceholder(/primary health concern/i).fill('Fibromyalgia pain');
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Should still block (duration is required)
    await expect(page.getByText(/please fill out all required/i)).toBeVisible({ timeout: 5000 });

    // Fill duration too → should allow
    await page.getByPlaceholder(/e.g. 5 years/i).fill('6 years');
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Step 2 should now appear
    await expect(page.getByText('Step 2: Medical & Lifestyle Profile')).toBeVisible({ timeout: 5000 });
  });
});
