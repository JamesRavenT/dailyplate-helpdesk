/**
 * Fires 25 inbound-email webhooks against the local dev server.
 * Each request goes through the normal webhook → pg-boss → AI pipeline.
 *
 * Usage (with backend running on :3001):
 *   bun run fire:webhooks
 */

import 'dotenv/config'

const BASE_URL  = process.env.DEV_SERVER_URL ?? 'http://localhost:3001'
const SECRET    = process.env.WEBHOOK_SECRET  ?? 'dev-webhook-secret'
const ENDPOINT  = `${BASE_URL}/api/webhooks/inbound-email`

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

const tickets = [
  // ── ACCOUNT ──────────────────────────────────────────────────────────────
  {
    from_name:  'Emma Thompson',
    from_email: 'emma.t@yahoo.com',
    subject:    "Can't access my account after password reset",
    body:       "Hi, I requested a password reset yesterday but I still can't log in. The new password I set isn't working and now it says my account is locked. Please help, I have a delivery coming tomorrow.",
  },
  {
    from_name:  'Noah Kim',
    from_email: 'n.kim@outlook.com',
    subject:    'Need to change my delivery address',
    body:       "I'm moving next week and need to update my delivery address before my next order ships. My new address is 45 Maple Street, Suite 2B, Portland, OR 97201. I tried updating in the app but it keeps showing an error.",
  },
  {
    from_name:  'Liam White',
    from_email: 'l.white@outlook.com',
    subject:    'How do I temporarily pause my subscription?',
    body:       "I'm going on vacation from July 4 to July 25. I'd like to pause my subscription for that period instead of cancelling. I couldn't find the pause option in my account settings — is this feature available?",
  },
  {
    from_name:  'Charlotte Moore',
    from_email: 'c.moore@gmail.com',
    subject:    'Request to upgrade to Family plan',
    body:       "Hi, I'm currently on the 2-person Classic plan and I'd like to upgrade to the 4-person Family plan. How do I do this and will I be charged the difference immediately?",
  },
  {
    from_name:  'Priya Nair',
    from_email: 'p.nair@gmail.com',
    subject:    'How do I cancel my DailyPlate subscription?',
    body:       "I'd like to cancel my subscription. I haven't been using it as much as I expected and it's been charging me every month. Can you please guide me through the cancellation process? I don't want to be billed again.",
  },
  // ── DELIVERY ─────────────────────────────────────────────────────────────
  {
    from_name:  'James Wilson',
    from_email: 'j.wilson@outlook.com',
    subject:    "Delivery hasn't arrived — 2 days overdue",
    body:       "My order was supposed to arrive two days ago but it still hasn't shown up. I've been waiting all day. Can you please check on this? My ingredients will be spoiled by now if they ever arrive.",
  },
  {
    from_name:  'Ethan Davis',
    from_email: 'e.davis@gmail.com',
    subject:    'Delivery left outside in the rain — contents damaged',
    body:       "My delivery today was left on my porch during heavy rain. The insulated bag was soaked through and the produce is waterlogged and unusable. I have photos. I want a replacement or full refund.",
  },
  {
    from_name:  'Aisha Patel',
    from_email: 'a.patel@hotmail.com',
    subject:    'Missing ingredient in my meal kit',
    body:       "My meal kit arrived today but the garlic and fresh basil for the Tuscan Chicken recipe are completely missing. These are key ingredients. What can you do about this?",
  },
  {
    from_name:  'Ben Foster',
    from_email: 'b.foster@gmail.com',
    subject:    'Wrong meals delivered this week',
    body:       "I ordered the Mediterranean Shrimp Pasta and Lemon Herb Chicken but received Korean BBQ Beef and Thai Peanut Noodles instead. I'm allergic to peanuts so this is a safety concern. Please fix this immediately.",
  },
  {
    from_name:  'Chloe Ramirez',
    from_email: 'c.ramirez@yahoo.com',
    subject:    'Delivery driver left package at wrong building',
    body:       "My delivery was left at the building next door. I only found out because my neighbor told me. By the time I retrieved it, the ice packs were warm. This is the second time this has happened.",
  },
  // ── TECHNICAL ────────────────────────────────────────────────────────────
  {
    from_name:  'Maria Santos',
    from_email: 'maria.santos@gmail.com',
    subject:    'Unable to log in to the DailyPlate app',
    body:       "I've been trying to log in for the past hour and keep getting 'Invalid credentials' even though I'm sure my email and password are correct. I tried resetting but the email never arrived. Using iPhone 15 on iOS 18.",
  },
  {
    from_name:  'Isabella Lee',
    from_email: 'i.lee@yahoo.com',
    subject:    'App crashes when trying to checkout',
    body:       "Whenever I tap 'Proceed to Payment' in the app, it crashes immediately. I've reinstalled the app twice but the same thing keeps happening. Running Android 14 on a Samsung Galaxy S24.",
  },
  {
    from_name:  'Ryan Cho',
    from_email: 'r.cho@gmail.com',
    subject:    "Can't update my saved credit card",
    body:       "Every time I try to update my credit card in Account Settings I get a red error: 'Unable to update payment method. Please try again.' I've tried Chrome, Safari, and the mobile app — none work.",
  },
  // ── PAYMENT ──────────────────────────────────────────────────────────────
  {
    from_name:  'David Chen',
    from_email: 'dchen@gmail.com',
    subject:    'Payment declined even though my card is valid',
    body:       "Every time I try to pay for my weekly plan, my Visa card gets declined. I called my bank and they say there's no block on the card. Please help — I don't want to miss this week's delivery.",
  },
  {
    from_name:  'Ava Clark',
    from_email: 'ava.clark@gmail.com',
    subject:    'Charged twice for my June subscription',
    body:       "I was charged $89.99 twice on June 1st for my monthly subscription. I only have one active plan. Please refund the duplicate charge. My bank reference numbers are TXN-2841099 and TXN-2841203.",
  },
  {
    from_name:  'Sophie Martinez',
    from_email: 's.martinez@hotmail.com',
    subject:    "Refund for cancelled order hasn't arrived",
    body:       "I cancelled an order 9 business days ago and was told the refund of $67.50 would arrive in 5-7 business days. It still hasn't appeared. My order number was DP-7703.",
  },
  // ── VOUCHER ──────────────────────────────────────────────────────────────
  {
    from_name:  'Sophie Martinez',
    from_email: 's.martinez2@hotmail.com',
    subject:    'Gift card code showing as invalid at checkout',
    body:       "I received a DailyPlate gift card as a birthday present but when I enter the code at checkout it says 'Invalid or expired code'. The card was purchased last week so it shouldn't be expired. Can you check?",
  },
  {
    from_name:  'Lucas Taylor',
    from_email: 'lucas.t@hotmail.com',
    subject:    'Referral code not applying discount',
    body:       "My friend gave me her referral code to get 30% off my first order but it's not being applied at checkout. The page says 'Discount applied' but the total doesn't change. Can you verify?",
  },
  // ── MENU ─────────────────────────────────────────────────────────────────
  {
    from_name:  'Oliver Brown',
    from_email: 'o.brown@gmail.com',
    subject:    "Nut allergy concern with this week's Harvest Bowl",
    body:       "I have a severe nut allergy and I noticed the Harvest Bowl this week lists 'may contain traces of peanuts'. I've already ordered it. Should I be concerned? Is there a safe substitute available?",
  },
  {
    from_name:  'Mia Anderson',
    from_email: 'mia.a@gmail.com',
    subject:    'Request to switch to vegetarian meal plan',
    body:       "I recently became vegetarian and would like to switch from the Classic to the Vegetarian plan starting next week. I also want to confirm there are no meat-based broths or stocks hidden in the sauces.",
  },
  {
    from_name:  'Zara Hassan',
    from_email: 'z.hassan@gmail.com',
    subject:    'Can I customise the spice level in my meals?',
    body:       "I have a very low spice tolerance and some of the recipes have been too hot for me. Is there a way to request milder versions of the meals, or filter out spicy options when selecting my weekly menu?",
  },
  {
    from_name:  'Tom Nguyen',
    from_email: 't.nguyen@outlook.com',
    subject:    'Missing nutritional information for new menu items',
    body:       "I track my macros closely and the new Mediterranean range added this week doesn't have nutritional info on the website or app. Can you provide the calories, protein, carbs and fat for the Falafel Wrap and Greek Salad Kit?",
  },
  // ── INQUIRY ──────────────────────────────────────────────────────────────
  {
    from_name:  'Lily Johnson',
    from_email: 'lily.j@gmail.com',
    subject:    'How many weeks can I skip per month?',
    body:       "Hi! I love DailyPlate but I travel a lot for work. I'd like to know how many weeks I can skip per month without cancelling. Is there a minimum notice period required before I need to skip?",
  },
  {
    from_name:  'Charlotte Moore',
    from_email: 'c.moore2@gmail.com',
    subject:    'What areas does DailyPlate currently deliver to?',
    body:       "I live in Beaverton, OR and I'm interested in subscribing but want to confirm you deliver to my area. Also, what are the delivery days for the Pacific Northwest region?",
  },
  {
    from_name:  'Marcus Bell',
    from_email: 'm.bell@gmail.com',
    subject:    'Do you offer corporate or bulk meal plans?',
    body:       "I manage a small office of 15 people and we're interested in providing weekly meal kits as an employee benefit. Do you offer any corporate or bulk subscription plans with discounted pricing?",
  },
]

async function main() {
  console.log(`Firing ${tickets.length} webhooks to ${ENDPOINT}…\n`)

  let passed = 0
  let failed = 0

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]
    const messageId = `<${uid()}.${uid()}@dailyplate.fakesite>`

    try {
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-secret': SECRET,
        },
        body: JSON.stringify({
          from_email:  t.from_email,
          from_name:   t.from_name,
          subject:     t.subject,
          body:        t.body,
          message_id:  messageId,
        }),
      })

      if (res.ok) {
        const json = await res.json() as { ticket_id: string; action: string }
        console.log(`  [${i + 1}/25] ${json.action === 'ticket_created' ? '✓' : '↩'} ${t.subject.slice(0, 55)}`)
        passed++
      } else {
        const text = await res.text()
        console.error(`  [${i + 1}/25] ✗ HTTP ${res.status} — ${t.subject.slice(0, 40)} — ${text.slice(0, 80)}`)
        failed++
      }
    } catch (err: any) {
      console.error(`  [${i + 1}/25] ✗ NETWORK — ${err.message}`)
      failed++
    }

    // Small delay so pg-boss isn't flooded all at once
    await new Promise(r => setTimeout(r, 200))
  }

  console.log(`\nDone — ${passed} created, ${failed} failed.`)
  if (failed > 0) {
    console.log('Make sure the backend dev server is running on :3001 before retrying.')
  }
}

main()
