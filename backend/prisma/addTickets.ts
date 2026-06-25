/**
 * Adds 25 new OPEN tickets with no agent assignment and queues each for AI processing.
 * Does NOT clear existing tickets.
 *
 * Usage:
 *   bun run add:tickets
 *   DATABASE_URL="..." bun run prisma/addTickets.ts
 */

import 'dotenv/config'
import { PgBoss } from 'pg-boss'
import { prisma } from '../src/lib/prisma.ts'

const PROCESS_QUEUE = 'process-ticket'

function msgId(n: number) {
  return `<add-msg-${n.toString().padStart(4, '0')}-${Date.now()}@dailyplate.fakesite>`
}

const tickets = [
  // ── ACCOUNT ──────────────────────────────────────────────────────────────
  {
    customer_name: 'Harper Allen',
    customer_email: 'h.allen@gmail.com',
    subject: 'Account locked after too many login attempts',
    body: "Hi, I tried logging in several times and now my account is locked. I'm getting an error that says 'Account temporarily suspended due to too many failed attempts.' How long does this last and can you unlock it sooner? I need to access my upcoming deliveries.",
  },
  {
    customer_name: 'Theo Barnes',
    customer_email: 't.barnes@outlook.com',
    subject: 'Two accounts under same email — which one is active?',
    body: "I think I accidentally created two accounts with the same email address. When I log in I see different order histories depending on which device I use. Can you check which account is the active one and merge them or remove the duplicate?",
  },
  // ── DELIVERY ─────────────────────────────────────────────────────────────
  {
    customer_name: 'Grace Okafor',
    customer_email: 'g.okafor@yahoo.com',
    subject: 'Delivery marked as completed but nothing arrived',
    body: "My tracking says my delivery was completed at 2:14pm today but nothing was left at my door or in my building's mail room. My neighbour was home all day and didn't see anyone. Is it possible it was delivered to the wrong address?",
  },
  {
    customer_name: 'Finn McCarthy',
    customer_email: 'f.mccarthy@gmail.com',
    subject: 'Can I change delivery day from Thursday to Monday?',
    body: "I'm currently scheduled for Thursday deliveries but Mondays would work much better for my household. Is it possible to switch? If so, would the change apply from next week or the week after?",
  },
  {
    customer_name: 'Isla Craig',
    customer_email: 'i.craig@hotmail.com',
    subject: 'Produce arrived wilted and discoloured',
    body: "The lettuce and spinach in this week's delivery arrived completely wilted and the tomatoes have dark spots. I refrigerated them immediately but they look like they've been sitting out for days. This is the second time this month. I'd like a replacement or credit.",
  },
  {
    customer_name: 'Remi Dupont',
    customer_email: 'r.dupont@gmail.com',
    subject: 'No delivery notification received',
    body: "I never received a delivery notification email or SMS for my order this week. The package was left outside and I only noticed it by chance three hours later. Can you make sure my contact details are set up correctly for future deliveries?",
  },
  // ── TECHNICAL ────────────────────────────────────────────────────────────
  {
    customer_name: 'Nora Fleming',
    customer_email: 'n.fleming@gmail.com',
    subject: 'Website not loading on Safari',
    body: "The DailyPlate website won't load on Safari on my MacBook. I just get a blank white page. Chrome works fine. I've cleared the cache and disabled extensions but it's still broken. I need to select my meals for next week before the deadline.",
  },
  {
    customer_name: 'Arlo Sinclair',
    customer_email: 'a.sinclair@outlook.com',
    subject: 'Two-factor authentication code not arriving',
    body: "I enabled two-factor authentication last month and it worked fine. Now the SMS code isn't arriving when I try to log in. I've waited up to 10 minutes and tried resending multiple times. My phone number hasn't changed.",
  },
  {
    customer_name: 'Maya Thornton',
    customer_email: 'm.thornton@gmail.com',
    subject: 'Meal selection page crashes on mobile app',
    body: "Every time I try to browse the weekly meal options on the iOS app, the page crashes after about 5 seconds. I'm on an iPhone 14 running iOS 17.4. I've updated the app to the latest version. The desktop site works fine.",
  },
  // ── PAYMENT ──────────────────────────────────────────────────────────────
  {
    customer_name: 'Ezra Watts',
    customer_email: 'e.watts@gmail.com',
    subject: 'Billed for a week I skipped',
    body: "I submitted a skip request for the week of June 23rd at least 5 days in advance, but I was still charged $79.99. The skip shows as confirmed in my account. I'd like a refund for this charge please.",
  },
  {
    customer_name: 'Pippa Lawson',
    customer_email: 'p.lawson@hotmail.com',
    subject: 'Price increased without any notice',
    body: "I noticed my monthly charge went from $89.99 to $99.99 this month without any email or in-app notification about a price change. Can you explain the increase and let me know if this is permanent? I'd like to know before deciding whether to continue my subscription.",
  },
  {
    customer_name: 'Caleb Nguyen',
    customer_email: 'c.nguyen@gmail.com',
    subject: 'PayPal payment not being accepted',
    body: "I'm trying to switch my payment method to PayPal but the option doesn't appear in my account settings. I can only see credit/debit card options. Do you accept PayPal? If so, how do I add it?",
  },
  // ── VOUCHER ──────────────────────────────────────────────────────────────
  {
    customer_name: 'Stella Horton',
    customer_email: 's.horton@gmail.com',
    subject: 'First-order discount not applied at checkout',
    body: "I signed up using a link that promised 40% off my first order, but when I checked out the discount wasn't applied and I was charged full price. The welcome email I received also mentioned the discount. Can you apply it retroactively or as a credit?",
  },
  {
    customer_name: 'Oscar Lindqvist',
    customer_email: 'o.lindqvist@gmail.com',
    subject: 'Corporate voucher code — how many times can it be used?',
    body: "My employer provided us with a corporate voucher code for DailyPlate. I've used it once successfully but it didn't work when I tried to use it again on my next order. Is this a one-time code or should it work for multiple orders?",
  },
  // ── MENU ─────────────────────────────────────────────────────────────────
  {
    customer_name: 'Violet Marsh',
    customer_email: 'v.marsh@gmail.com',
    subject: 'Gluten-free meal options very limited this week',
    body: "I'm on a gluten-free diet and this week there are only two options available for me after applying the filter, compared to the usual five or six. Is there a shortage or is this a permanent reduction? Some advance notice would be appreciated.",
  },
  {
    customer_name: 'Kit Paterson',
    customer_email: 'k.paterson@outlook.com',
    subject: 'Recipe card missing from this week\'s box',
    body: "My delivery arrived but there's no recipe card included. I know the recipes are available online but I prefer cooking with the printed card. Could you email me the recipes for this week's meals? I ordered the Lemon Herb Salmon and the Mushroom Risotto.",
  },
  {
    customer_name: 'Luna Fitzgerald',
    customer_email: 'l.fitzgerald@gmail.com',
    subject: 'Dairy substitution request for weekly meals',
    body: "I've recently been diagnosed with a dairy intolerance. Is there a way to flag this on my account so meals are automatically filtered to dairy-free options? Or do I need to manually check each recipe every week? A dairy-free filter would be really helpful.",
  },
  {
    customer_name: 'Eli Nakamura',
    customer_email: 'e.nakamura@gmail.com',
    subject: 'Incorrect protein listed on meal packaging',
    body: "The Teriyaki Bowl packaging says it contains 38g of protein per serving but the website lists 22g. I'm tracking macros closely so this inconsistency matters. Which figure is accurate? Can you get the nutritional information checked and corrected?",
  },
  // ── INQUIRY ──────────────────────────────────────────────────────────────
  {
    customer_name: 'Sage Coleman',
    customer_email: 's.coleman@gmail.com',
    subject: 'Do you offer halal-certified meals?',
    body: "I follow a halal diet and I'm interested in subscribing to DailyPlate. Are any of your meals halal-certified? If so, can you confirm there's no cross-contamination with non-halal products during preparation and packaging?",
  },
  {
    customer_name: 'River Adeyemi',
    customer_email: 'r.adeyemi@gmail.com',
    subject: 'Can I gift a subscription to someone in another city?',
    body: "I want to buy a 3-month DailyPlate subscription as a birthday gift for my sister who lives in Austin, TX. How does the gifting process work? Can I choose the start date and will she be able to set her own meal preferences?",
  },
  {
    customer_name: 'Wren Blackwood',
    customer_email: 'w.blackwood@outlook.com',
    subject: 'What is the deadline to make weekly meal selections?',
    body: "I keep missing the cutoff to select my meals for the week. I think it's Wednesday but I'm not sure. Can you confirm the exact day and time, and whether I can change it once I've submitted? Is there a way to set a reminder?",
  },
  {
    customer_name: 'Phoenix Reid',
    customer_email: 'p.reid@gmail.com',
    subject: 'Do portion sizes scale for two people per serving?',
    body: "I'm on the 2-person plan. When the recipe says '1 serving', does it mean 1 serving for 2 people or just for 1? I want to make sure I'm reading the recipe cards correctly — sometimes the amounts seem quite small for two adults.",
  },
  {
    customer_name: 'Ash Brennan',
    customer_email: 'a.brennan@gmail.com',
    subject: 'Is there a student or low-income discount available?',
    body: "I'm a university student on a tight budget but I really want to eat healthier. Do you offer any student discounts or reduced-price plans? I saw a social media post suggesting there might be something available but couldn't find it on the website.",
  },
  {
    customer_name: 'Marlowe King',
    customer_email: 'm.king@gmail.com',
    subject: 'How are the packaging materials recycled?',
    body: "I'm trying to reduce my household waste. Can you explain how to properly dispose of or recycle the DailyPlate packaging? Are the ice packs reusable or recyclable? I couldn't find clear instructions in the box or on your website.",
  },
  {
    customer_name: 'Indigo Walsh',
    customer_email: 'i.walsh@hotmail.com',
    subject: 'Moving interstate — can I keep my subscription?',
    body: "I'm relocating from Seattle, WA to Denver, CO next month. Do you deliver to Denver? If yes, do I need to update my address before a certain date to ensure uninterrupted delivery? Will my plan pricing change?",
  },
]

async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!)
  await boss.start()

  console.log(`Adding ${tickets.length} new OPEN tickets…\n`)

  for (let i = 0; i < tickets.length; i++) {
    const t = tickets[i]
    const ticket = await prisma.ticket.create({
      data: {
        customer_name:   t.customer_name,
        customer_email:  t.customer_email,
        subject:         t.subject,
        status:          'OPEN',
        email_thread_id: msgId(i + 1),
        messages: {
          create: {
            body:        t.body,
            sender_type: 'CUSTOMER',
          },
        },
      },
    })

    await boss.send(PROCESS_QUEUE, { ticketId: ticket.id })
    console.log(`  [${i + 1}/${tickets.length}] queued  ${t.subject.slice(0, 55)}`)
  }

  await boss.stop()
  await prisma.$disconnect()
  console.log(`\nDone — ${tickets.length} tickets queued for AI processing.`)
}

main()
