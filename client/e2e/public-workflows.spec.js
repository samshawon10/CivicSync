import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const screenshotDir = path.resolve('../docs/report/screenshots');
async function evidence(page, filename) {
  await mkdir(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, filename), fullPage: true });
}

test('landing page renders without uncaught JavaScript errors', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Sign in', exact: true }).first()).toBeVisible();
  expect(errors).toEqual([]);
  await evidence(page, 'pw-landing.png');
});

test('login and registration links navigate correctly', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'Create an account', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole('heading', { name: 'Create your CivicSync account' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
});

test('empty login submission shows required-field errors', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Enter your email address.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter your password.', { exact: true })).toBeVisible();
  await expect(page.getByText('Please review the highlighted fields.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  await evidence(page, 'pw-login-validation.png');
});

test('malformed email is rejected before authentication', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email address').fill('invalid-email');
  await page.getByLabel('Password', { exact: true }).fill('ExamplePassword123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Please enter a valid email address.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email address')).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/login$/);
});

test('password visibility toggles without changing the input', async ({ page }) => {
  await page.goto('/login');
  const password = page.getByLabel('Password', { exact: true });
  await password.fill('ExamplePassword123');
  await expect(password).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'text');
  await expect(password).toHaveValue('ExamplePassword123');
  await page.getByRole('button', { name: 'Hide password', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('password reset requires an email before sending', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: /forgot password/i }).click();
  await expect(page.getByText('Enter your email address first.', { exact: true })).toBeVisible();
});

test('empty registration shows all required-field errors', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  for (const message of ['Enter your full name.', 'Enter your email address.', 'Enter your password.', 'Confirm your password.']) {
    await expect(page.getByText(message, { exact: true })).toBeVisible();
  }
  await evidence(page, 'pw-registration-required.png');
});

test('registration rejects a short password', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Browser Test');
  await page.getByLabel('Email address').fill('browser-test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('abc');
  await page.getByLabel('Confirm password', { exact: true }).fill('abc');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByText('Password must be at least 6 characters.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('registration rejects mismatched passwords', async ({ page }) => {
  await page.goto('/register');
  await page.getByLabel('Full name').fill('Browser Test');
  await page.getByLabel('Email address').fill('browser-test@example.com');
  await page.getByLabel('Password', { exact: true }).fill('ExamplePassword123');
  await page.getByLabel('Confirm password', { exact: true }).fill('DifferentPassword123');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByText('Passwords do not match.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
  await evidence(page, 'pw-registration-mismatch.png');
});

test('dark theme survives a page reload', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Switch to dark mode' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  await evidence(page, 'pw-dark-theme.png');
});

const protectedPaths = [
  '/dashboard', '/dashboard/citizen', '/admin/dashboard',
  '/dashboard/department-head', '/dashboard/department-officer',
  '/dashboard/officer', '/dashboard/field-worker', '/dashboard/emergency-head',
  '/dashboard/emergency-department-officer', '/dashboard/emergency-officer',
  '/dashboard/emergency-field-worker', '/dashboard/citizen/reports/new',
  '/dashboard/citizen/emergency/new',
];
for (const route of protectedPaths) {
  test(`signed-out access redirects to login: ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    if (route === '/admin/dashboard') await evidence(page, 'pw-protected-route.png');
  });
}

test('unknown route shows 404 and returns signed-out users to login', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page.getByText('404', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Go to dashboard' }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test('mobile navigation opens and follows login link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Open navigation menu' }).click();
  await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).filter({ visible: true }).first().click();
  await expect(page).toHaveURL(/\/login$/);
});

test('mobile login form fits viewport and displays validation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await expect(page.getByText('Enter your email address.', { exact: true })).toBeVisible();
  const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: innerWidth }));
  expect(dimensions.content).toBeLessThanOrEqual(dimensions.viewport);
  await evidence(page, 'pw-mobile-login.png');
});
