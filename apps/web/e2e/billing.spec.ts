import { test, expect } from '@playwright/test';

test.describe('Billing scenarios', () => {
    // Use a unique email for each test run
    const uniqueId = Date.now();
    const email = `test+${uniqueId}@example.com`;
    const password = 'Password@123!';

    test('Signup, Upgrade, Downgrade, Cancel', async ({ page }) => {
        // Increase test timeout since Stripe checkout and webhooks can be slow
        test.setTimeout(120000);

        await test.step('Navigate to home and go to sign up', async () => {
            await page.goto('/');
            const signUpButton = page.getByRole('link', { name: /sign up/i });
            if (await signUpButton.isVisible()) {
                await signUpButton.click();
            } else {
                await page.goto('/sign-up'); // fallback URL
            }
        });

        await test.step('Fill sign up form', async () => {
            await page.getByLabel(/name/i).fill('Test User');
            await page.getByLabel(/email/i).fill(email);
            await page.getByLabel(/password/i).fill(password);
            await page.getByRole('button', { name: /sign up|continue|create account/i }).click();
            await page.waitForURL('**/dashboard**');
        });

        await test.step('Navigate to Billing', async () => {
            await page.goto('/dashboard/billing');
            // Verify we are on Free plan
            await expect(page.locator('text=Free Plan')).toBeVisible();
        });

        await test.step('Upgrade to Pro', async () => {
            // Find the Pro plan Upgrade button
            // The button text is "Upgrade", we want the one in the Pro card
            const proCard = page.locator('div.border').filter({ hasText: 'Pro' }).filter({ hasText: '$149' });
            await proCard.getByRole('button', { name: /Upgrade/i }).click();

            // Should redirect to Stripe Checkout
            await page.waitForURL(/.*stripe\.com.*/, { timeout: 15000 });

            // Fill Stripe Checkout (this works in Stripe's standard checkout layout)
            // Note: we might need to wait for stripe elements to load
            await page.waitForLoadState('networkidle');

            // Fill card info
            // Since it's an iframe, we need to locate it
            // Usually there's a card number field we can just type into if the focus is right, 
            // but specific selectors might be needed:
            await page.locator('input[name="cardNumber"]').fill('4242 4242 4242 4242');
            await page.locator('input[name="cardExpiry"]').fill('12/34');
            await page.locator('input[name="cardCvc"]').fill('123');
            await page.locator('input[name="billingName"]').fill('Test User');

            // Submit payment
            await page.locator('button[type="submit"]').click();

            // Wait to be redirected back to the billing page with success banner
            await page.waitForURL('**/dashboard/billing**', { timeout: 30000 });

            // Wait for webhook to update the DB and UI to reflect (might need a manual reload or SWR will revalidate)
            // We check for the plan text to change to Pro Plan
            await expect(page.locator('text=Pro Plan').first()).toBeVisible({ timeout: 15000 });
        });

        await test.step('Downgrade to Starter', async () => {
            const starterCard = page.locator('div.border').filter({ hasText: 'Starter' }).filter({ hasText: '$79' });
            await starterCard.getByRole('button', { name: /Downgrade/i }).click();

            // Wait for dialog and confirm
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.getByRole('dialog').getByRole('button', { name: /Downgrade to Starter/i }).click();

            // Ensure success dialog/toast dismisses or check UI
            // We check that the Downgrade text works
            await expect(page.getByText('Plan downgraded')).toBeVisible();
        });

        await test.step('Cancel Subscription', async () => {
            await page.getByRole('button', { name: /Cancel Subscription/i }).click();

            // Wait for dialog and confirm
            await expect(page.getByRole('dialog')).toBeVisible();
            await page.getByRole('dialog').getByRole('button', { name: /Yes, cancel/i }).click();

            // Verify cancellation notice
            await expect(page.getByText('Subscription canceled')).toBeVisible();

            // Check Badge says "Canceling"
            await expect(page.locator('text=Canceling')).toBeVisible();
        });
    });
});
