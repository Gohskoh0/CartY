# TODO

## Goal
Fix:
1) Storefront products not displaying after signout/signin
2) Implement 1-month free trial popup + continue button that activates trial without breaking payments
3) Store sharing link WhatsApp preview shows product image (not raw URL)

## Steps
- [x] Step 1: Inspect relevant frontend auth/register flow
- [x] Step 2: Inspect storefront routing/remount behavior and fix re-fetch logic
- [ ] Step 3: Add/confirm backend trial activation endpoint + ensure subscription_status=active with consistent expiry field
- [ ] Step 4: Implement frontend popup after signup; Continue button calls trial activation/ensures store exists

- [ ] Step 5: Update backend storefront HTML with OpenGraph meta tags including og:image from first active product
- [ ] Step 6: Ensure payments during trial are allowed (subscription_status remains active)
- [ ] Step 7: Run quick smoke tests (signup→popup→continue, signout/signin→storefront, WhatsApp preview)

