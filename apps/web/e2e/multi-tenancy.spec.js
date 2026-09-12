/**
 * Phase 74 — Multi-Tenancy Testing [BACKEND] [FRONTEND]
 *
 * End-to-End Test Chain:
 * 1. SuperAdmin creates two distinct institutions (Alpha University & Beta College)
 * 2. Each institution's Admin creates a department with the identical name/code ('Computer Science & Engineering' / 'CSE')
 *    -> Confirms both succeed without a global uniqueness conflict (proving compound index from Phase 64 works)
 * 3. Confirm each institution's login page shows correct distinct branding (Phase 70)
 * 4. Confirm a user from Institution A gets 401 attempting login on Institution B's subdomain even with correct credentials (Phase 66)
 * 5. Confirm Institution A's Admin cannot retrieve Institution B's department list via direct API call with a guessed ID (Phase 68)
 */

import { test, expect } from '@playwright/test';

const API_URL = process.env.API_URL || 'http://localhost:4000';

test.describe('Phase 74 — Multi-Tenancy End-to-End Chain', () => {
  // Test run timestamp for unique tenant subdomains and user credentials
  const ts = Date.now();

  const instAData = {
    name: `Alpha University ${ts}`,
    subdomain: `alpha-${ts}`,
    code: `AL${ts.toString().slice(-4)}`,
    themeConfig: {
      primaryColor: '#4f46e5',
      secondaryColor: '#06b6d4',
    },
    admin: {
      name: 'Alpha Admin',
      email: `admin@alpha-${ts}.edu`,
      password: 'Password123!',
    },
  };

  const instBData = {
    name: `Beta College ${ts}`,
    subdomain: `beta-${ts}`,
    code: `BE${ts.toString().slice(-4)}`,
    themeConfig: {
      primaryColor: '#ec4899',
      secondaryColor: '#8b5cf6',
    },
    admin: {
      name: 'Beta Admin',
      email: `admin@beta-${ts}.edu`,
      password: 'Password123!',
    },
  };

  const departmentData = {
    name: 'Computer Science & Engineering',
    code: 'CSE',
  };

  let superAdminToken = '';
  let instA = null;
  let instB = null;
  let adminAToken = '';
  let adminBToken = '';
  let deptAId = '';
  let deptBId = '';

  test('Full Multi-Tenancy Chain: Provisioning, Compound Index, Dynamic Branding, Auth Isolation, and Data Scoping', async ({
    page,
    request,
  }) => {
    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: SuperAdmin creates two institutions
    // ─────────────────────────────────────────────────────────────────────────
    // Obtain SuperAdmin authorization
    let loginRes = await request.post(`${API_URL}/api/auth/login`, {
      data: {
        email: 'superadmin@collegeerp.com',
        password: 'Password123!',
      },
    });

    if (loginRes.ok()) {
      const body = await loginRes.json();
      superAdminToken = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
    } else {
      // Fallback: try signup if fresh DB
      const setupKey = process.env.SUPERADMIN_SETUP_KEY || 'changeme123_secret_example';
      const superAdminEmail = `superadmin_${ts}@collegeerp.com`;
      await request.post(`${API_URL}/api/auth/superadmin/signup`, {
        data: {
          name: 'Platform SuperAdmin',
          email: superAdminEmail,
          password: 'Password123!',
          setupKey,
        },
      });

      loginRes = await request.post(`${API_URL}/api/auth/login`, {
        data: {
          email: superAdminEmail,
          password: 'Password123!',
        },
      });
      const body = await loginRes.json();
      superAdminToken = body.token || body.accessToken || body.data?.token || body.data?.accessToken;
    }

    expect(superAdminToken).toBeTruthy();

    // 1a. SuperAdmin creates Institution A
    const createResA = await request.post(`${API_URL}/api/institutions`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      data: instAData,
    });
    expect(createResA.status()).toBe(201);
    const bodyA = await createResA.json();
    instA = bodyA.data?.institution || bodyA.institution;
    expect(instA).toBeDefined();
    expect(instA.subdomain).toBe(instAData.subdomain);

    // 1b. SuperAdmin creates Institution B
    const createResB = await request.post(`${API_URL}/api/institutions`, {
      headers: {
        Authorization: `Bearer ${superAdminToken}`,
      },
      data: instBData,
    });
    expect(createResB.status()).toBe(201);
    const bodyB = await createResB.json();
    instB = bodyB.data?.institution || bodyB.institution;
    expect(instB).toBeDefined();
    expect(instB.subdomain).toBe(instBData.subdomain);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: Each institution's Admin creates a department with identical name/code
    // ─────────────────────────────────────────────────────────────────────────
    // 2a. Admin A logs in on Institution A
    const loginAdminARes = await request.post(`${API_URL}/api/auth/login`, {
      headers: {
        'x-tenant-subdomain': instAData.subdomain,
      },
      data: {
        email: instAData.admin.email,
        password: instAData.admin.password,
      },
    });
    expect(loginAdminARes.status()).toBe(200);
    const loginAdminABody = await loginAdminARes.json();
    adminAToken =
      loginAdminABody.token ||
      loginAdminABody.accessToken ||
      loginAdminABody.data?.token ||
      loginAdminABody.data?.accessToken;
    expect(adminAToken).toBeTruthy();

    // 2b. Admin A creates Department 'CSE' in Institution A
    const createDeptARes = await request.post(`${API_URL}/api/departments`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        'x-tenant-subdomain': instAData.subdomain,
      },
      data: departmentData,
    });
    expect(createDeptARes.status()).toBe(201);
    const createDeptABody = await createDeptARes.json();
    const deptA = createDeptABody.data?.department || createDeptABody.department;
    expect(deptA).toBeDefined();
    expect(deptA.code).toBe(departmentData.code);
    deptAId = deptA._id;

    // 2c. Admin B logs in on Institution B
    const loginAdminBRes = await request.post(`${API_URL}/api/auth/login`, {
      headers: {
        'x-tenant-subdomain': instBData.subdomain,
      },
      data: {
        email: instBData.admin.email,
        password: instBData.admin.password,
      },
    });
    expect(loginAdminBRes.status()).toBe(200);
    const loginAdminBBody = await loginAdminBRes.json();
    adminBToken =
      loginAdminBBody.token ||
      loginAdminBBody.accessToken ||
      loginAdminBBody.data?.token ||
      loginAdminBBody.data?.accessToken;
    expect(adminBToken).toBeTruthy();

    // 2d. Admin B creates Department with the IDENTICAL code 'CSE' in Institution B
    // Confirms no global uniqueness conflict (Phase 64 compound index { code: 1, institutionId: 1 } works)
    const createDeptBRes = await request.post(`${API_URL}/api/departments`, {
      headers: {
        Authorization: `Bearer ${adminBToken}`,
        'x-tenant-subdomain': instBData.subdomain,
      },
      data: departmentData,
    });
    expect(createDeptBRes.status()).toBe(201);
    const createDeptBBody = await createDeptBRes.json();
    const deptB = createDeptBBody.data?.department || createDeptBBody.department;
    expect(deptB).toBeDefined();
    expect(deptB.code).toBe(departmentData.code);
    expect(deptB._id).not.toBe(deptAId);
    deptBId = deptB._id;

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: Confirm each institution's login page shows correct distinct branding (Phase 70)
    // ─────────────────────────────────────────────────────────────────────────
    // 3a. Navigate to Institution A login page
    await page.goto(`/inst/${instAData.subdomain}/login`);
    const headingA = page.locator('h1');
    await expect(headingA).toBeVisible({ timeout: 15_000 });
    await expect(headingA).toHaveText(instAData.name);
    await expect(page).toHaveTitle(new RegExp(instAData.name));

    // 3b. Navigate to Institution B login page
    await page.goto(`/inst/${instBData.subdomain}/login`);
    const headingB = page.locator('h1');
    await expect(headingB).toBeVisible({ timeout: 15_000 });
    await expect(headingB).toHaveText(instBData.name);
    await expect(page).toHaveTitle(new RegExp(instBData.name));

    // Assert distinct branding names
    expect(instAData.name).not.toBe(instBData.name);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: Confirm user from Institution A gets 401 attempting login on Institution B's subdomain (Phase 66)
    // ─────────────────────────────────────────────────────────────────────────
    // 4a. Verify via browser UI on Institution B's login page
    await page.fill('input#email', instAData.admin.email);
    await page.fill('input#password', instAData.admin.password);
    await page.click('button[type="submit"]');

    const alertMessage = page.locator('[role="alert"], p[class*="error"]');
    await expect(alertMessage).toBeVisible({ timeout: 10_000 });
    await expect(alertMessage).toContainText(/invalid credentials/i);

    // 4b. Verify via direct API call with exact 401 HTTP status assertion
    const crossTenantLoginRes = await request.post(`${API_URL}/api/auth/login`, {
      headers: {
        'x-tenant-subdomain': instBData.subdomain,
      },
      data: {
        email: instAData.admin.email,
        password: instAData.admin.password,
      },
    });
    expect(crossTenantLoginRes.status()).toBe(401);
    const crossTenantBody = await crossTenantLoginRes.json();
    expect(crossTenantBody.message || crossTenantBody.error).toMatch(/invalid credentials/i);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: Confirm Institution A's Admin cannot retrieve Institution B's department (Phase 68)
    // ─────────────────────────────────────────────────────────────────────────
    // 5a. Admin A attempts direct GET /api/departments/:deptBId with a guessed ID
    const directGetRes = await request.get(`${API_URL}/api/departments/${deptBId}`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        'x-tenant-subdomain': instAData.subdomain,
      },
    });
    // Scoped query Department.findOne({ _id: deptBId, institutionId: instAId }) returns null -> 404
    expect(directGetRes.status()).toBe(404);

    // 5b. Admin A fetches department list -> must only contain Dept A, never Dept B
    const listDeptARes = await request.get(`${API_URL}/api/departments`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        'x-tenant-subdomain': instAData.subdomain,
      },
    });
    expect(listDeptARes.status()).toBe(200);
    const listBody = await listDeptARes.json();
    const depts = Array.isArray(listBody) ? listBody : listBody.data || [];
    const containsDeptB = depts.some((d) => d._id === deptBId);
    const containsDeptA = depts.some((d) => d._id === deptAId);
    expect(containsDeptA).toBe(true);
    expect(containsDeptB).toBe(false);

    // 5c. Perimeter Token Replay: Admin A attempts using Token A against Institution B's subdomain
    const perimeterReplayRes = await request.get(`${API_URL}/api/departments`, {
      headers: {
        Authorization: `Bearer ${adminAToken}`,
        'x-tenant-subdomain': instBData.subdomain,
      },
    });
    // Gateway perimeter check blocks token issued for Institution A when presented on Institution B
    expect(perimeterReplayRes.status()).toBe(401);
  });
});
