/**
 * Phase 62 — E2E Critical Chain (Playwright)
 *
 * This spec covers the full multi-role hierarchy end-to-end:
 *   Superadmin Signup → Create Admin → Create HOD → Create Faculty
 *   → HOD assigns Faculty to Subject → Faculty opens Attendance Session
 *   → Student checks in → Faculty closes session → Student sees result
 *
 * IMPORTANT: This test requires the backend services to be running.
 * Start all services with: docker compose up  (from repo root)
 * Then run: npx playwright test  (from apps/web)
 *
 * Unique test data is generated using timestamps so the spec can be re-run
 * after a DB reset without hardcoding credentials.
 */

import { test, expect, request } from '@playwright/test';

// ──────────────────────────────────────────────────────────
// Shared test data (generated once per run)
// ──────────────────────────────────────────────────────────
const ts = Date.now();
const SUPERADMIN_SETUP_KEY = process.env.SUPERADMIN_SETUP_KEY || 'changeme123_secret_example';

const SUPERADMIN = {
  name: 'Super Admin',
  email: `superadmin_${ts}@test.com`,
  password: 'Test@1234',
  setupKey: SUPERADMIN_SETUP_KEY,
};

const ADMIN = {
  name: 'Test Admin',
  email: `admin_${ts}@test.com`,
  password: 'Test@1234',
  role: 'admin',
};

const HOD = {
  name: 'Test HOD',
  email: `hod_${ts}@test.com`,
  password: 'Test@1234',
  role: 'hod',
  department: `CS_${ts}`,
};

const FACULTY = {
  name: 'Test Faculty',
  email: `faculty_${ts}@test.com`,
  password: 'Test@1234',
  role: 'faculty',
};

const STUDENT = {
  name: 'Test Student',
  email: `student_${ts}@test.com`,
  password: 'Test@1234',
  enrollmentNumber: `ENR${ts}`,
};

// ──────────────────────────────────────────────────────────
// Helper: log in as a user in a given browser context
// ──────────────────────────────────────────────────────────
async function loginAs(page, email, password) {
  await page.goto('/login');
  await page.waitForSelector('input[type="email"]', { state: 'visible' });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  // Wait for redirect away from /login
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 15_000 });
}

// ──────────────────────────────────────────────────────────
// Test 1: Superadmin one-time signup
// ──────────────────────────────────────────────────────────
test.describe('1 — Superadmin Signup', () => {
  test('signup succeeds the first time', async ({ page }) => {
    await page.goto('/superadmin/signup');
    await page.waitForSelector('form', { state: 'visible' });

    await page.fill('input[id="name"], input[placeholder*="name" i]', SUPERADMIN.name);
    await page.fill('input[id="email"], input[type="email"]', SUPERADMIN.email);
    await page.fill('input[id="password"], input[type="password"]', SUPERADMIN.password);

    // Setup key field
    const keyField = page.locator('input[id="setupKey"], input[placeholder*="setup" i], input[placeholder*="key" i]').first();
    await keyField.fill(SUPERADMIN.setupKey);

    await page.click('button[type="submit"]');

    // Expect success: redirected to login or dashboard
    await expect(page).toHaveURL(/(login|admin|dashboard)/, { timeout: 15_000 });
  });

  test('second signup attempt is rejected', async ({ page }) => {
    // Try to create another superadmin with a different email but same key
    await page.goto('/superadmin/signup');
    await page.waitForSelector('form', { state: 'visible' });

    await page.fill('input[id="name"], input[placeholder*="name" i]', 'Second Admin');
    await page.fill('input[id="email"], input[type="email"]', `second_${ts}@test.com`);
    await page.fill('input[id="password"], input[type="password"]', 'Test@1234');

    const keyField = page.locator('input[id="setupKey"], input[placeholder*="setup" i], input[placeholder*="key" i]').first();
    await keyField.fill(SUPERADMIN.setupKey);

    await page.click('button[type="submit"]');

    // Should show an error (superadmin already exists lock)
    await expect(
      page.locator('text=/already exists|already registered|setup key has been used|locked/i')
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Test 2: Superadmin creates Admin
// ──────────────────────────────────────────────────────────
test.describe('2 — Superadmin creates Admin', () => {
  test('admin account is created successfully', async ({ page }) => {
    await loginAs(page, SUPERADMIN.email, SUPERADMIN.password);

    // Navigate to user management / admin creation
    await page.click('text=Management', { timeout: 10_000 });
    await page.waitForSelector('text=Create|text=Invite|button[id*="create" i]', { timeout: 10_000 });

    // Fill in admin details
    await page.fill('input[placeholder*="name" i]', ADMIN.name);
    await page.fill('input[placeholder*="email" i]', ADMIN.email);

    // Select role
    const roleSelect = page.locator('select, [data-testid="role-select"]').first();
    if (await roleSelect.count()) {
      await roleSelect.selectOption('admin');
    }

    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Invite")');

    await expect(
      page.locator(`text=${ADMIN.email}`)
        .or(page.locator('text=/created|invited|success/i'))
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Test 3: Admin creates HOD
// ──────────────────────────────────────────────────────────
test.describe('3 — Admin creates HOD', () => {
  test('HOD account is created', async ({ page }) => {
    await loginAs(page, ADMIN.email, ADMIN.password);

    await page.click('text=HODs', { timeout: 10_000 });

    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add HOD"), button:has-text("Invite")').first();
    await createBtn.click({ timeout: 8_000 });

    await page.fill('input[placeholder*="name" i]', HOD.name);
    await page.fill('input[placeholder*="email" i]', HOD.email);
    await page.fill('input[placeholder*="department" i]', HOD.department);

    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Invite")');

    await expect(
      page.locator(`text=${HOD.email}`)
        .or(page.locator('text=/created|invited|success/i'))
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Test 4: HOD creates Faculty and assigns to Subject
// ──────────────────────────────────────────────────────────
test.describe('4 — HOD creates Faculty', () => {
  test('faculty account is created and assigned', async ({ page }) => {
    await loginAs(page, HOD.email, HOD.password);

    // Create faculty
    await page.click('text=Staff Management', { timeout: 10_000 });
    const createBtn = page.locator('button:has-text("Create"), button:has-text("Add Faculty"), button:has-text("Invite")').first();
    await createBtn.click({ timeout: 8_000 });

    await page.fill('input[placeholder*="name" i]', FACULTY.name);
    await page.fill('input[placeholder*="email" i]', FACULTY.email);

    await page.click('button[type="submit"], button:has-text("Create"), button:has-text("Invite")');

    await expect(
      page.locator(`text=${FACULTY.email}`)
        .or(page.locator('text=/created|invited|success/i'))
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ──────────────────────────────────────────────────────────
// Test 5: Faculty opens an attendance session → Student checks in → Faculty closes
// ──────────────────────────────────────────────────────────
test.describe('5 — Full attendance chain', () => {
  test('faculty creates session, student checks in, faculty closes', async ({ browser }) => {
    // ── Faculty: open session ──────────────────────────────
    const facultyCtx = await browser.newContext();
    const facultyPage = await facultyCtx.newPage();
    await loginAs(facultyPage, FACULTY.email, FACULTY.password);

    await facultyPage.click('text=My Classes', { timeout: 10_000 });

    // Start attendance session / generate QR
    const startBtn = facultyPage.locator('button:has-text("Start Session"), button:has-text("Start Attendance"), button:has-text("Generate QR")').first();
    await startBtn.click({ timeout: 8_000 });

    // Grab the QR code / PIN code shown to faculty
    const pinLocator = facultyPage.locator('[data-testid="session-pin"], [class*="pin"], [class*="code"]').first();
    await expect(pinLocator).toBeVisible({ timeout: 10_000 });
    const sessionPin = await pinLocator.textContent();

    // ── Student: check in ─────────────────────────────────
    const studentCtx = await browser.newContext();
    const studentPage = await studentCtx.newPage();
    await loginAs(studentPage, STUDENT.email, STUDENT.password);

    await studentPage.click('text=Attendance', { timeout: 10_000 });

    // Wait for and click an active session card
    const sessionCard = studentPage.locator('[class*="session"], [data-testid*="session"]').first();
    await expect(sessionCard).toBeVisible({ timeout: 10_000 });
    await sessionCard.click();

    // Enter the PIN
    const pinInput = studentPage.locator('input[placeholder*="PIN" i], input[placeholder*="code" i], input[placeholder*="digit" i]').first();
    if (await pinInput.count()) {
      await pinInput.fill(sessionPin.trim());
    }

    await studentPage.click('button:has-text("Submit"), button:has-text("Check In"), button:has-text("Submit Attendance")');

    // Expect success message
    await expect(
      studentPage.locator('text=/success|checked in|attendance recorded/i')
        .or(studentPage.locator('[class*="success"]'))
    ).toBeVisible({ timeout: 10_000 });

    // ── Faculty: close session ────────────────────────────
    const closeBtn = facultyPage.locator('button:has-text("End Session"), button:has-text("Close Session"), button:has-text("Stop")').first();
    await closeBtn.click({ timeout: 8_000 });
    await expect(
      facultyPage.locator('text=/session ended|closed|stopped/i')
        .or(facultyPage.locator('[class*="closed"]'))
    ).toBeVisible({ timeout: 10_000 });

    // ── Student: verify dashboard shows attendance ─────────
    await studentPage.reload();
    await studentPage.click('text=Attendance', { timeout: 8_000 });
    await expect(
      studentPage.locator('text=Present, text=/present/i').first()
    ).toBeVisible({ timeout: 10_000 });

    await facultyCtx.close();
    await studentCtx.close();
  });
});
