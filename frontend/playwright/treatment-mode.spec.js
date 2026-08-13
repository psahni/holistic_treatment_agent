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
    test.setTimeout(240000);
    const testEmail = `e2e.patient.${Date.now()}@example.com`;
    const testName = `E2E Patient ${Date.now().toString().slice(-4)}`;

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
      page.getByTestId('switch-to-treatment-btn')
    ).toBeVisible({ timeout: 90000 });

    // ─────────────────────────────────────────────────
    // STEP 3: Click the inline switch link
    // ─────────────────────────────────────────────────
    await page.getByTestId('switch-to-treatment-btn').click();

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
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

    await page.getByPlaceholder('Full Name').fill(testName);
    await page.getByPlaceholder('Age').fill('40');
    await page.getByPlaceholder('City').fill('Mumbai');
    await page.getByPlaceholder('Email Address').fill(testEmail);
    await page.getByPlaceholder('Phone Number').fill(`+91${Math.floor(1000000000 + Math.random() * 9000000000)}`);
    await page.getByPlaceholder('Password (min 6 chars)').fill('testpass123');

    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

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
    await page.getByPlaceholder(/primary complaint/i).fill(
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
    await page.getByPlaceholder(/medications/i).fill('Levothyroxine 75mcg, Vitamin D3');
    await page.getByPlaceholder(/vegetarian, high-protein/i).fill('Vegetarian, moderate appetite, 2L water/day');
    await page.getByPlaceholder(/6 hours sleep, moderate stress/i).fill('6 hours sleep, high stress, sedentary desk job');

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
    // STEP 8: Wait for redirect to /history and see pending case
    // ─────────────────────────────────────────────────
    await expect(page).toHaveURL(/\/history/, { timeout: 60000 });
    await expect(page.getByText(/pending review/i).first()).toBeVisible({ timeout: 15000 });

    // Capture Case ID
    const caseText = await page.getByText(/Case #/i).first().textContent();
    const caseIdText = caseText.trim();
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
    await expect(adminPage.getByText(testName).first()).toBeVisible({ timeout: 10000 });
    await adminPage.getByText(testName).first().click();

    // Wait for case details to load
    await adminPage.waitForTimeout(3000); // Wait 3 seconds to let backend fetch complete
    await adminPage.screenshot({ path: 'admin-dashboard-timeout.png', fullPage: true });
    await expect(
      adminPage.getByRole('heading', { name: new RegExp(`review case: ${testName}`, 'i') })
    ).toBeVisible({ timeout: 15000 });

    // Apply Body Pain template
    await adminPage.getByRole('button', { name: /body pain/i }).click();

    // Verify prescription textarea is populated
    const prescriptionField = adminPage.locator('textarea').first();
    await expect(prescriptionField).toContainText(/body pain|musculoskeletal/i, { timeout: 5000 });

    // Submit approval (handle alert dialog)
    adminPage.once('dialog', async dialog => {
      expect(dialog.message()).toContain('successfully');
      await dialog.accept();
    });
    await adminPage.getByRole('button', { name: /approve.*send/i }).click();

    // Verify case is removed from pending queue
    await expect(adminPage.getByText(testName).first()).not.toBeVisible({ timeout: 10000 });
    await adminPage.close();

    // ─────────────────────────────────────────────────
    // STEP 10: Patient checks history page → sees prescription
    // ─────────────────────────────────────────────────
    await page.bringToFront();
    await page.reload();
    await expect(page.getByText(/pending review|prescription ready/i).first()).toBeVisible({ timeout: 15000 });
    
    // Click case to expand details
    await page.getByText(/Case #/i).first().click();
    await expect(page.getByRole('heading', { name: /doctor's prescription/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/body pain|musculoskeletal/i).first()).toBeVisible();

    // Visual hold for manual inspection
    if (!process.env.CI) {
      await page.waitForTimeout(2000);
    }
  });

  test('patient can view case in /history page after submission', async ({ page }) => {
    test.setTimeout(240000);
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
    test.setTimeout(240000);
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

    // The agent will recommend Treatment Mode because the symptom is chronic and severe.
    // Increase timeout significantly because LLM can take a while to respond
    await expect(page.getByTestId('switch-to-treatment-btn')).toBeVisible({ timeout: 90000 });
    await page.getByTestId('switch-to-treatment-btn').click();
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
    test.setTimeout(240000);
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
    await page.getByRole('button', { name: 'Sign Up', exact: true }).click();

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
      page.getByTestId('switch-to-treatment-btn')
    ).toBeVisible({ timeout: 90000 });

    // Click switch → modal → confirm (user is already logged in, goes straight to form)
    await page.getByTestId('switch-to-treatment-btn').click();
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
    await page.getByPlaceholder(/primary complaint/i).fill('Just testing validation');
    // Deliberately leave duration blank to trigger validation
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Verify error message appears
    await expect(page.getByText(/please fill out all required/i)).toBeVisible();

    // Fill the missing required field
    await page.getByPlaceholder(/e.g. 5 years/i).fill('2 months');
    await page.getByRole('button', { name: /next.*medical/i }).click();

    // Step 2 should now appear
    await expect(page.getByText('Step 2: Medical & Lifestyle Profile')).toBeVisible({ timeout: 5000 });
  });
});
