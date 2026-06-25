import 'dotenv/config'
import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { prisma } from '../src/lib/prisma.ts'
import { Role, TicketCategory } from '@prisma/client'

const seedAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  emailAndPassword: { enabled: true },
})

// ─── Default SOP articles ─────────────────────────────────────────────────────

const DEFAULT_ARTICLES: { title: string; category: TicketCategory; content: string }[] = [
  {
    category: TicketCategory.ACCOUNT,
    title: 'Account Management — Subscriptions, Password Reset & Profile Updates',
    content: `## Overview
DailyPlate account management covers subscription changes, password resets, and profile/contact detail updates. Always verify the customer's identity before assisting with sensitive changes.

## Subscription Management
- Customers can view and modify their subscription plan at https://dailyplate.fakesite/account/subscription.
- **Upgrade/Downgrade:** Changes take effect at the start of the next billing cycle. Inform the customer of the change date.
- **Cancellation:** Customers can cancel at https://dailyplate.fakesite/account/cancel. Cancellations made before midnight on the day before the next billing date prevent the next charge. No pro-rated refunds for mid-cycle cancellations except in exceptional circumstances (see Refund SOP).
- **Pausing a subscription:** Customers can pause for up to 8 weeks via the account dashboard. Pausing beyond 8 weeks requires escalation to a senior agent.
- **Reactivation:** Cancelled subscriptions can be reactivated at any time. Previous meal preferences are retained for 90 days.

## Password Reset
1. Direct the customer to https://dailyplate.fakesite/reset-password.
2. Instruct them to enter the email address associated with their account and click "Send Reset Link."
3. The reset link is valid for 30 minutes. If expired, they should request a new one.
4. If the reset email does not arrive: advise checking the spam/junk folder; confirm the correct email was used.
5. If the customer no longer has access to the registered email address: escalate to admin — do NOT attempt manual password changes without identity verification.

## Account Detail Changes (Name, Email, Delivery Address)
- **Name / phone:** Customers can update these at https://dailyplate.fakesite/account/settings.
- **Email change:** Requires verification of both the old and new email addresses. Customer initiates the change in settings and must confirm via both inboxes.
- **Delivery address change:** Can be updated at https://dailyplate.fakesite/account/address. Changes to pending orders must be submitted before 11:00 PM the night prior to the scheduled delivery date. After that cutoff, the delivery cannot be redirected.

## Escalation Triggers
- Customer is locked out and cannot recover their email access.
- Suspected account compromise or unauthorised changes.
- Customer disputes a subscription charge after cancellation (hand off to Refund SOP).`,
  },
  {
    category: TicketCategory.DELIVERY,
    title: 'Delivery Issues — Late & Missing Deliveries',
    content: `## Overview
DailyPlate delivers meals Monday–Saturday. Deliveries are scheduled in two windows: Morning (7 AM–12 PM) and Afternoon (12 PM–6 PM). If a customer contacts support about a delivery issue, follow the steps below.

## Late Delivery
1. Confirm the customer's delivery window and scheduled date.
2. Check if the delivery is still within the window — if so, reassure the customer and advise them to wait until the end of the window.
3. If the window has passed by less than 1 hour: advise the customer that occasional delays occur due to traffic or route changes. Ask them to wait an additional 30–60 minutes.
4. If the window has passed by more than 1 hour with no delivery:
   - Apologise sincerely and log a delivery delay incident.
   - Inform the customer that the meal will either arrive shortly or they will receive a full credit for that delivery.
   - Escalate to the logistics team via the internal portal for real-time tracking.
5. Offer a courtesy discount code (LATE10) for one future order if the delay exceeds 2 hours.

## Missing Delivery (No Delivery Received)
1. Confirm the delivery address on the customer's account matches their expected address.
2. Check the delivery status in the internal portal.
3. If status shows "Delivered" but customer didn't receive it:
   - Ask the customer to check their doorstep, building lobby, or with a neighbour.
   - If still not found, treat as a missing delivery: issue a full refund or free replacement (customer's choice). Log a missing delivery report.
4. If status shows "In Transit" or "Out for Delivery": follow the Late Delivery steps above.
5. If status shows "Failed Delivery" (no one home, access issue): advise the customer that a redelivery can be scheduled at https://dailyplate.fakesite/account/deliveries. Failed deliveries due to customer unavailability may incur a redelivery fee per the Terms of Service.

## Wrong Order Delivered
1. Apologise and confirm the order that was expected vs. received.
2. Do not ask the customer to return the wrong order.
3. Issue a full refund for the order value AND redeliver the correct order on the next available delivery slot.
4. Log a wrong-order incident.

## Escalation Triggers
- Multiple missed deliveries in one month (possible route/logistics issue).
- Customer alleges the delivery driver behaviour was inappropriate.
- Delivery to a wrong address due to our system error.`,
  },
  {
    category: TicketCategory.TECHNICAL,
    title: 'Technical Issues — Login Problems & Save Failures',
    content: `## Overview
Technical issues on the DailyPlate platform include login failures, problems saving changes, app crashes, and feature malfunctions. Always ask the customer for their browser/device and any error message they see before troubleshooting.

## Cannot Log In
1. Ask which login method the customer uses (email/password, Google, or Apple).
2. **Incorrect password:** Direct to https://dailyplate.fakesite/reset-password (see Account SOP for full reset steps).
3. **Account locked (too many failed attempts):** The account auto-unlocks after 15 minutes. If the customer cannot wait, escalate to admin for a manual unlock.
4. **"Email not recognised" error:** The email may not be registered. Ask the customer to try alternative emails. If none work, they may need to create a new account.
5. **Google / Apple sign-in fails:** Ask the customer to clear browser cookies and cache, then retry. If the issue persists on mobile, advise updating the DailyPlate app to the latest version.
6. **Two-factor authentication issue:** If the customer is not receiving their 2FA code, advise checking their spam folder and that the phone number/email on file is correct. Escalate if codes are consistently not arriving.

## Cannot Save Changes (Settings, Preferences, Address)
1. Ask which section they are trying to save (profile, meal preferences, delivery address, payment details).
2. **Form validation errors:** Ask the customer to describe or screenshot the error. Common issues: invalid phone format, password mismatch, unsupported special characters in name fields.
3. **"Changes not saving" with no error shown:**
   - Ask the customer to try a different browser or clear cookies/cache.
   - If on mobile app, advise force-closing and reopening the app.
   - If the issue persists across browsers: escalate as a platform bug, capture the customer's browser, OS, and steps to reproduce.
4. **Payment details not saving:** This is handled by our payment provider (Stripe). Ask the customer to ensure the card number, expiry, and CVC are correct and that the card is not expired. If the card is valid but still fails to save, escalate to the technical team.

## App / Website Crash or Feature Not Working
1. Identify the feature and the platform (web browser, iOS app, Android app).
2. Ask for any error message and the steps the customer took before the issue occurred.
3. Advise clearing cache/cookies (web) or reinstalling the app (mobile).
4. If the issue is widespread or reproducible: log a bug report and inform the customer that the technical team has been notified. Provide a realistic ETA if a known outage is in progress.
5. Check the system status page at https://dailyplate.fakesite/status before responding — if a known incident is listed, reference it.

## Escalation Triggers
- Login failure that persists after a password reset.
- Customer cannot access their account for more than 24 hours.
- Bug is reproducible and affects multiple customers.`,
  },
  {
    category: TicketCategory.VOUCHER,
    title: 'Vouchers & Gift Cards',
    content: `## Overview
DailyPlate supports two types of codes: **Voucher codes** (promotional/discount codes issued in marketing campaigns) and **Gift cards** (purchased by customers to give to others). Both are redeemed at checkout.

## Redeeming a Voucher / Gift Card
1. Direct the customer to https://dailyplate.fakesite/checkout and look for the "Promo/Gift Card" field at the checkout summary.
2. The code is case-insensitive. Common issues: spaces at the start/end of the code, letter "O" vs digit "0", letter "I" vs digit "1".
3. If the code shows "Invalid code": confirm the exact code with the customer (ask them to copy-paste it). Verify in the admin portal that the code exists and is active.
4. If the code shows "Expired": check the expiry date in the admin portal. Expired promotional codes cannot be extended without manager approval. Escalate if the customer received the code with a different stated expiry.
5. If the code shows "Already used": inform the customer that single-use codes can only be redeemed once. If the customer believes they have not used it, escalate for investigation.
6. If the code shows "Not applicable to your plan": some promotional codes apply only to new subscribers or specific plans. Check the code's terms in the admin portal and inform the customer accordingly.

## Gift Card — Purchase Issues
- If a customer purchased a gift card but the recipient did not receive it: check the email address the gift card was sent to. If incorrect, update and resend via the admin portal.
- Gift cards are non-refundable once purchased unless there was a billing error.
- Unused gift card balances do not expire.

## Voucher Code Not Applying the Expected Discount
1. Verify the code terms: minimum order value, applicable plan, one-time vs. recurring discount, new customers only.
2. Confirm the customer's cart meets all conditions.
3. If all conditions are met and the discount still isn't applying: escalate to the technical team as a possible system issue.

## Escalation Triggers
- Customer claims they received a code from a DailyPlate promotion but the code is not in the system.
- Gift card was purchased but payment was charged without the card being delivered.
- Code was applied but the discount amount was incorrect.`,
  },
  {
    category: TicketCategory.PAYMENT,
    title: 'Payments — Declined Cards & Refund Requests',
    content: `## Overview
Payment issues include declined card charges and customer requests for refunds. DailyPlate processes payments via Stripe. Agents cannot directly process refunds — refund requests must be logged and approved by a senior agent or admin.

## Payment Declined
1. Ask the customer which card they are attempting to use and whether it is a debit or credit card.
2. Common reasons for a decline (as reported by Stripe):
   - **Insufficient funds:** Advise the customer to ensure funds are available or use a different card.
   - **Card expired:** Ask them to update their payment method at https://dailyplate.fakesite/account/billing.
   - **Bank blocked the transaction:** This often happens with new cards or international transactions. Ask the customer to call their bank to authorise DailyPlate charges, then retry.
   - **Incorrect card details:** Ask the customer to re-enter their card details carefully.
3. If the customer's card is valid and still being declined: escalate to the technical team — there may be a Stripe configuration issue.
4. Inform the customer that a failed payment will retry automatically in 24 hours. Their subscription remains active during this period.

## Refund Policy Summary (share with customers)
- **Cancellation refund:** If the customer cancels before the next billing date, they will not be charged for the next cycle. No refund is issued for the current cycle unless exceptional circumstances apply.
- **Delivery failure refund:** Full refund or free replacement for a missed or wrong delivery (see Delivery SOP).
- **Billing error refund:** If a customer was charged in error (duplicate charge, charged after cancellation), escalate immediately — refunds for billing errors are processed within 3–5 business days.
- **Dissatisfaction refund:** Assessed on a case-by-case basis by a senior agent or admin. A partial credit (rather than a full cash refund) is offered in the first instance for quality complaints.

## Logging a Refund Request
1. Collect: customer name, email, order/transaction reference, reason for refund, amount requested.
2. Log the request in the internal portal and assign to a senior agent or admin for approval.
3. Inform the customer: "I've logged your refund request. You'll receive an update within 2 business days."
4. Do NOT promise a refund until it has been approved.

## Escalation Triggers
- Customer was charged after confirmed cancellation.
- Duplicate or unexpected charge appeared.
- Customer disputes a charge with their bank (chargeback in progress) — inform management immediately.`,
  },
  {
    category: TicketCategory.MENU,
    title: 'Menu Selection & Meal Customisation',
    content: `## Overview
DailyPlate offers weekly rotating menus. Customers can customise their meals within their subscription plan. Menu questions include dietary requirements, ingredient swaps, and meal planning.

## Browsing & Selecting Meals
- The weekly menu is published every Friday at 6 PM for the following week.
- Customers can view and select meals at https://dailyplate.fakesite/menu.
- Selections must be finalised by Sunday 11:59 PM for the upcoming delivery week. After this cutoff, the system auto-assigns the "Chef's Choice" selection.
- Remind customers to select their meals before the Sunday deadline to avoid getting the default selection.

## Dietary Requirements & Filters
- The DailyPlate menu includes labels for: Vegetarian, Vegan, Gluten-Free, Dairy-Free, Nut-Free, and Low-Calorie.
- Customers can set their dietary preferences permanently at https://dailyplate.fakesite/account/preferences — this pre-filters the menu to show only suitable meals.
- DailyPlate **cannot guarantee** a completely allergen-free environment as meals are prepared in shared kitchens. Customers with severe allergies should be advised to review full ingredient lists at https://dailyplate.fakesite/menu/ingredients.
- If a customer has a serious allergy not covered by existing filters, advise them to contact us before ordering so the nutrition team can assist.

## Ingredient Swaps & Customisation
- Limited swaps are available on select meals (e.g., swap a protein, exclude an ingredient). Available swaps are shown on the meal detail page.
- Not all meals support customisation. If a swap is not shown, it is not available for that meal.
- DailyPlate cannot accommodate custom recipe requests or "build-your-own" meals outside the published options.

## Missing or Incorrect Meal Preference Applied
1. Confirm the customer's saved preferences at https://dailyplate.fakesite/account/preferences.
2. If their preferences are saved correctly but the wrong meal was sent: treat as a wrong order — see Delivery SOP.
3. If no preference was saved: remind the customer to save preferences before the Sunday cutoff.

## Escalation Triggers
- Customer has a life-threatening allergy and requires detailed ingredient confirmation beyond what the website shows.
- Customer received a meal that triggered an allergic reaction — escalate immediately to a senior agent and management.`,
  },
  {
    category: TicketCategory.INQUIRY,
    title: 'About DailyPlate — Company Overview & Contact Information',
    content: `## What is DailyPlate?
DailyPlate is a weekly meal kit and ready-meal subscription service based in the Philippines. We deliver fresh, chef-designed meals straight to customers' doors, making home cooking easier and more enjoyable. Our mission is to bring restaurant-quality food to everyday households — no waste, no hassle, just delicious meals.

## What We Offer
- **Meal kits** — pre-portioned fresh ingredients with step-by-step recipe cards (ready in 30 minutes or less).
- **Ready meals** — fully cooked, oven- or microwave-ready meals for customers with less time to cook.
- **Flexible subscriptions** — plans range from 1 to 5 people, with 2 to 5 meals per week. Customers can skip weeks, pause, or cancel anytime.
- **Rotating weekly menu** — new meals every week, with options for vegetarian, vegan, gluten-free, dairy-free, and low-calorie diets.

## Our Website
Customers can browse plans, manage their account, select meals, and get support at:
https://dailyplate.fakesite

## Delivery Areas
DailyPlate currently delivers to major cities and surrounding areas. Customers can check if their postcode is covered during the sign-up flow at https://dailyplate.fakesite/plans.

## Pricing
Plans start from a competitive per-serving rate. All plans include free delivery. Full pricing is listed at https://dailyplate.fakesite/plans. Do not quote specific prices in support tickets as these may change — always direct customers to the pricing page.

## Customer Support
- **Support hours:** Monday–Saturday, 8 AM – 8 PM
- **Email:** support@dailyplate.fakesite
- **Help centre:** https://dailyplate.fakesite/help
- **Live chat:** Available on the website during support hours

## Other Contacts
- **General enquiries:** hello@dailyplate.fakesite
- **Corporate / bulk orders:** corporate@dailyplate.fakesite
- **Press / media:** press@dailyplate.fakesite

## Common Questions to Answer Directly
- "Is DailyPlate available in my area?" → Ask the customer to check https://dailyplate.fakesite/plans.
- "How does the subscription work?" → Customers choose a plan, select meals each week before Sunday 11:59 PM, and receive delivery Monday–Saturday.
- "Can I try it without committing?" → Yes, DailyPlate offers a first-box discount for new subscribers. No long-term commitment; cancel anytime.
- "Is DailyPlate eco-friendly?" → Yes. Packaging is made from recyclable and compostable materials. Customers can drop off ice packs and insulated liners at the next delivery for recycling.`,
  },
  {
    category: TicketCategory.INQUIRY,
    title: 'General Inquiries — Plans, Pricing & How-To Questions',
    content: `## Overview
General inquiries cover subscription plan information, pricing, how DailyPlate works, and common how-to questions. These can typically be resolved in a single reply.

## How DailyPlate Works
- DailyPlate is a weekly meal kit and ready-meal subscription service.
- Customers choose a plan based on the number of people and meals per week (e.g., 2 people × 3 meals/week).
- Meals are delivered fresh in recyclable insulated boxes.
- The website is at https://dailyplate.fakesite. Customers can sign up, manage their account, and browse menus there.

## Subscription Plans & Pricing
- Plans are listed at https://dailyplate.fakesite/plans.
- Pricing is per serving and varies by plan tier. Refer customers to the pricing page for current rates — do not quote specific prices in support tickets, as they may change.
- All plans include free delivery.
- Annual plans offer a discount vs. monthly; customers can compare on the pricing page.

## Common How-To Questions
- **How do I skip a week?** Go to https://dailyplate.fakesite/account/deliveries and toggle the week off before the Sunday cutoff.
- **How do I change my delivery day?** Delivery days are set at signup based on postcode. Day changes can be requested at https://dailyplate.fakesite/account/address — subject to route availability.
- **How do I update my meal count?** Go to https://dailyplate.fakesite/account/subscription and choose a new plan.
- **How do I refer a friend?** The referral programme is at https://dailyplate.fakesite/refer. The customer gets a shareable link; both parties receive a discount when the referred friend completes their first delivery.

## Escalation Triggers
- Customer asks a detailed business/legal/press question — redirect to hello@dailyplate.fakesite.
- Customer requests information about corporate or bulk orders — redirect to corporate@dailyplate.fakesite.`,
  },
]

// ─── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  // Admin user — skip if already exists
  const email = process.env.SEED_ADMIN_EMAIL
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD must be set in .env')
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (!existing) {
    const result = await seedAuth.api.signUpEmail({ body: { email, password, name: 'Administrator' } })
    if (!result?.user) throw new Error('Failed to create admin user')
    await prisma.user.update({ where: { id: result.user.id }, data: { role: Role.ADMIN } })
    console.log(`Admin created: ${email}`)
  } else {
    console.log(`Admin ${email} already exists, skipping.`)
  }

  // Articles — upsert by title so re-running the seed stays idempotent
  for (const article of DEFAULT_ARTICLES) {
    const existing = await prisma.article.findFirst({ where: { title: article.title } })
    if (existing) {
      await prisma.article.update({ where: { id: existing.id }, data: article })
    } else {
      await prisma.article.create({ data: article })
    }
  }
  console.log(`Seeded ${DEFAULT_ARTICLES.length} SOP articles.`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
