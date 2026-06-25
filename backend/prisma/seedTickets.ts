import 'dotenv/config'
import { prisma } from '../src/lib/prisma.ts'

// ─── helpers ──────────────────────────────────────────────────────────────────

function d(month: number, day: number, hour = 9, minute = 0) {
  return new Date(2026, month - 1, day, hour, minute, 0)
}

function msgId(n: number) {
  return `<seed-msg-${n.toString().padStart(4, '0')}@dailyplate.fakesite>`
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Clear existing ticket data
  console.log('Clearing tickets…')
  await prisma.message.deleteMany()
  await prisma.ticket.deleteMany()

  // 2. Fetch agents
  const agents = await prisma.user.findMany({
    where: { role: 'AGENT', is_active: true },
    select: { id: true, name: true },
  })
  if (agents.length === 0) throw new Error('No active agents found — seed users first.')
  const a0 = agents[0]
  const a1 = agents[1] ?? agents[0]

  console.log(`Using agents: ${agents.map(a => a.name).join(', ')}`)

  // ─── 15 OPEN / unanswered tickets (June 15–25) ─────────────────────────────

  const open = [
    {
      subject: "Can't access my account after password reset",
      customer_name: 'Emma Thompson',
      customer_email: 'emma.t@yahoo.com',
      category: 'ACCOUNT' as const,
      priority: 'HIGH' as const,
      created: d(6, 15, 8, 12),
      body: "Hi, I requested a password reset yesterday but I still can't log in. The new password I set isn't working and now it says my account is locked. Please help, I have a delivery coming tomorrow.",
    },
    {
      subject: "Delivery hasn't arrived — 2 days overdue",
      customer_name: 'James Wilson',
      customer_email: 'j.wilson@outlook.com',
      category: 'DELIVERY' as const,
      priority: 'HIGH' as const,
      created: d(6, 15, 14, 30),
      body: "My order #DP-8821 was supposed to arrive on June 13 but it still hasn't shown up. I've been waiting two days. Can you please check on this? My ingredients will be spoiled by now.",
    },
    {
      subject: 'Unable to log in to the DailyPlate app',
      customer_name: 'Maria Santos',
      customer_email: 'maria.santos@gmail.com',
      category: 'TECHNICAL' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 16, 10, 5),
      body: "I've been trying to log in for the past hour and keep getting 'Invalid credentials' even though I'm sure my email and password are correct. I tried resetting but the email never arrived. Using iPhone 15 on iOS 18.",
    },
    {
      subject: 'Payment declined even though my card is valid',
      customer_name: 'David Chen',
      customer_email: 'dchen@gmail.com',
      category: 'PAYMENT' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 16, 11, 45),
      body: "Every time I try to pay for my weekly plan, my Visa card gets declined. I called my bank and they say there's no block on the card. The last 4 digits are 4521. Please help — I don't want to miss this week's delivery.",
    },
    {
      subject: 'Gift card code showing as invalid at checkout',
      customer_name: 'Sophie Martinez',
      customer_email: 's.martinez@hotmail.com',
      category: 'VOUCHER' as const,
      priority: 'LOW' as const,
      created: d(6, 17, 9, 0),
      body: "I received a DailyPlate gift card (code: DP-GIFT-7742X) as a birthday present but when I enter it at checkout it says 'Invalid or expired code'. The card was purchased last week so it shouldn't be expired. Can you check?",
    },
    {
      subject: 'Nut allergy concern with this week\'s Harvest Bowl',
      customer_name: 'Oliver Brown',
      customer_email: 'o.brown@gmail.com',
      category: 'MENU' as const,
      priority: 'HIGH' as const,
      created: d(6, 17, 16, 20),
      body: "I have a severe nut allergy and I just noticed the Harvest Bowl this week lists 'may contain traces of peanuts' in the allergen info. I've already ordered it. Should I be concerned? Is there a substitute I can get instead?",
    },
    {
      subject: 'How many meals can I skip per month?',
      customer_name: 'Lily Johnson',
      customer_email: 'lily.j@gmail.com',
      category: 'INQUIRY' as const,
      priority: null,
      created: d(6, 18, 13, 0),
      body: "Hi! I love DailyPlate but I travel a lot for work. I'd like to know how many weeks I can skip per month without cancelling my subscription. Also, is there a minimum notice period before I need to skip?",
    },
    {
      subject: 'Need to change delivery address',
      customer_name: 'Noah Kim',
      customer_email: 'n.kim@outlook.com',
      category: 'ACCOUNT' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 18, 15, 30),
      body: "I'm moving next week and need to update my delivery address before my next order ships on June 22. My new address is 45 Maple Street, Suite 2B, Portland, OR 97201. I tried updating in the app but it keeps showing an error.",
    },
    {
      subject: 'App crashes when trying to checkout',
      customer_name: 'Isabella Lee',
      customer_email: 'i.lee@yahoo.com',
      category: 'TECHNICAL' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 19, 8, 45),
      body: "Whenever I tap 'Proceed to Payment' in the app, it crashes immediately. I've tried restarting the app, clearing the cache, and reinstalling but the same thing happens. Running Android 14 on a Samsung Galaxy S24. My order is time-sensitive.",
    },
    {
      subject: 'Delivery left outside in the rain — contents damaged',
      customer_name: 'Ethan Davis',
      customer_email: 'e.davis@gmail.com',
      category: 'DELIVERY' as const,
      priority: 'HIGH' as const,
      created: d(6, 19, 12, 0),
      body: "My delivery today was left on my porch during heavy rain. The insulated bag was soaked through and the produce is waterlogged and unusable. I have photos. I want a replacement or full refund — this is not acceptable.",
    },
    {
      subject: 'Charged twice for my June subscription',
      customer_name: 'Ava Clark',
      customer_email: 'ava.clark@gmail.com',
      category: 'PAYMENT' as const,
      priority: 'HIGH' as const,
      created: d(6, 20, 9, 15),
      body: "I was charged $89.99 twice on June 1st for my monthly subscription. I only have one active plan. Please refund the duplicate charge. My bank reference numbers are TXN-2841099 and TXN-2841203.",
    },
    {
      subject: 'Referral code not applying discount',
      customer_name: 'Lucas Taylor',
      customer_email: 'lucas.t@hotmail.com',
      category: 'VOUCHER' as const,
      priority: 'LOW' as const,
      created: d(6, 21, 10, 0),
      body: "My friend gave me her referral code (FRIEND-JKLT22) to get 30% off my first order but it's not being applied at checkout. The page just says 'Discount applied' but the total doesn't change. Can you verify the discount?",
    },
    {
      subject: 'Request to switch to vegetarian meal plan',
      customer_name: 'Mia Anderson',
      customer_email: 'mia.a@gmail.com',
      category: 'MENU' as const,
      priority: null,
      created: d(6, 22, 14, 0),
      body: "I recently became vegetarian and would like to switch my plan from the Classic to the Vegetarian plan starting next week. I also want to make sure there are no hidden meat-based broths or stocks in the sauces. Can you confirm?",
    },
    {
      subject: 'How do I temporarily pause my subscription?',
      customer_name: 'Liam White',
      customer_email: 'l.white@outlook.com',
      category: 'ACCOUNT' as const,
      priority: null,
      created: d(6, 23, 11, 0),
      body: "I'm going on a 3-week vacation from July 4 to July 25. I'd like to pause my subscription for that period instead of cancelling. I couldn't find the pause option in my account settings — is this feature available?",
    },
    {
      subject: 'What areas does DailyPlate currently deliver to?',
      customer_name: 'Charlotte Moore',
      customer_email: 'c.moore@gmail.com',
      category: 'INQUIRY' as const,
      priority: null,
      created: d(6, 25, 8, 0),
      body: "I live in Beaverton, OR and I'm interested in subscribing but I want to make sure you deliver to my area before I sign up. Also, what are the delivery days for the Pacific Northwest region?",
    },
  ]

  // ─── IN_PROGRESS tickets with conversation ─────────────────────────────────

  const inProgress = [
    {
      subject: 'How do I upgrade my subscription plan?',
      customer_name: 'Maria Santos',
      customer_email: 'maria.santos@gmail.com',
      category: 'ACCOUNT' as const,
      priority: 'LOW' as const,
      created: d(6, 15, 9, 30),
      agent: a0,
      messages: [
        { sender: 'CUSTOMER' as const, body: "Hi, I'm currently on the 2-person Classic plan and I'd like to upgrade to the 4-person Family plan. How do I do that and will I be charged the difference immediately?", time: d(6, 15, 9, 30) },
        { sender: 'AGENT' as const, body: `Hi Maria,\n\nThank you for reaching out to DailyPlate Support!\n\nTo upgrade your plan, please go to Account → My Plan → Change Plan. Select the 4-person Family plan and confirm. The price difference will be prorated and charged immediately for the current billing period.\n\nIf you upgrade before your next delivery date, the new plan will apply to your very next box!\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 15, 10, 5) },
        { sender: 'CUSTOMER' as const, body: "Great, thank you! I found the option. Will my delivery day stay the same after upgrading?", time: d(6, 16, 8, 0) },
      ],
    },
    {
      subject: 'Missing ingredient in this week\'s meal kit',
      customer_name: 'James Wilson',
      customer_email: 'j.wilson@outlook.com',
      category: 'DELIVERY' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 17, 7, 45),
      agent: a1,
      messages: [
        { sender: 'CUSTOMER' as const, body: "My meal kit arrived today but the garlic and fresh basil for the Tuscan Chicken recipe are missing. These are key ingredients — the meal is incomplete.", time: d(6, 17, 7, 45) },
        { sender: 'AGENT' as const, body: `Hi James,\n\nI'm so sorry to hear about the missing ingredients from your kit! This is definitely not the experience we want you to have.\n\nI've flagged this to our packing team and I'll have a credit for the missing items added to your account within 24 hours. You can use this credit on your next order.\n\nIn the meantime, would you like us to send a replacement for those ingredients, or would the account credit work better for you?\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 17, 9, 0) },
        { sender: 'CUSTOMER' as const, body: "A credit would be fine, thanks. How much will it be?", time: d(6, 17, 14, 30) },
      ],
    },
    {
      subject: "Can't update my credit card information",
      customer_name: 'Emma Thompson',
      customer_email: 'emma.t@yahoo.com',
      category: 'TECHNICAL' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 19, 10, 0),
      agent: a0,
      messages: [
        { sender: 'CUSTOMER' as const, body: "Whenever I try to update my credit card in Account Settings, I get a red error that says 'Unable to update payment method. Please try again.' I've tried three different browsers and my phone app.", time: d(6, 19, 10, 0) },
        { sender: 'AGENT' as const, body: `Hi Emma,\n\nThank you for contacting DailyPlate Support! I'm sorry you're having trouble updating your payment method.\n\nThis is a known intermittent issue affecting a small number of accounts. Our engineering team has been notified and is working on a fix.\n\nAs a temporary workaround, could you try clearing your browser cache and cookies, then attempting the update again? If that doesn't work, I can manually update the card on our end — just provide me with the last 4 digits, expiry date, and billing zip code (no full card numbers please).\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 19, 11, 15) },
        { sender: 'CUSTOMER' as const, body: "I cleared the cache but it's still failing. The last 4 digits are 8834, expiry 09/28, zip 97210.", time: d(6, 20, 9, 0) },
      ],
    },
    {
      subject: 'Received wrong meals in this week\'s delivery',
      customer_name: 'David Chen',
      customer_email: 'dchen@gmail.com',
      category: 'MENU' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 21, 8, 0),
      agent: a1,
      messages: [
        { sender: 'CUSTOMER' as const, body: "I ordered the Mediterranean Shrimp Pasta and Lemon Herb Chicken but received Korean BBQ Beef and Thai Peanut Noodles instead. I'm allergic to peanuts so this is a safety issue. Please fix this immediately.", time: d(6, 21, 8, 0) },
        { sender: 'AGENT' as const, body: `Hi David,\n\nI sincerely apologize for this serious mix-up! Receiving incorrect meals — especially when allergies are involved — is completely unacceptable and I want to assure you we take this very seriously.\n\nPlease do not consume the Thai Peanut Noodles given your peanut allergy.\n\nI've already flagged this to our quality assurance team and arranged for a full replacement delivery of your correct meals (Mediterranean Shrimp Pasta and Lemon Herb Chicken) to arrive within 48 hours at no charge. I've also added a $25 credit to your account for the inconvenience.\n\nCould you confirm your delivery address so I can verify the replacement order?\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 21, 9, 30) },
        { sender: 'CUSTOMER' as const, body: "My address is 112 Oak Ave, Portland, OR 97201. Thank you for the quick response. When exactly will it arrive?", time: d(6, 21, 11, 0) },
      ],
    },
    {
      subject: "Refund for cancelled order hasn't arrived",
      customer_name: 'Sophie Martinez',
      customer_email: 's.martinez@hotmail.com',
      category: 'PAYMENT' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 23, 9, 0),
      agent: a0,
      messages: [
        { sender: 'CUSTOMER' as const, body: "I cancelled an order on June 10th and was told the refund of $67.50 would appear within 5-7 business days. It's been 9 business days and I still haven't received it. My order number was DP-7703.", time: d(6, 23, 9, 0) },
        { sender: 'AGENT' as const, body: `Hi Sophie,\n\nI'm sorry for the delay in your refund! Let me look into this right away.\n\nI can confirm that your order DP-7703 was cancelled and a refund of $67.50 was initiated on June 10th. Our records show it was processed on our end, but it can sometimes take additional time depending on your bank.\n\nI've escalated this to our billing team to trace the refund. Can you confirm the last 4 digits of the card you used for this order so we can verify it went to the correct account?\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 23, 10, 30) },
        { sender: 'CUSTOMER' as const, body: "The card last 4 digits are 2291. It's a Wells Fargo debit card.", time: d(6, 24, 8, 15) },
      ],
    },
  ]

  // ─── RESOLVED tickets ───────────────────────────────────────────────────────

  const resolved = [
    {
      subject: 'Need to update billing information',
      customer_name: 'Oliver Brown',
      customer_email: 'o.brown@gmail.com',
      category: 'ACCOUNT' as const,
      priority: null,
      created: d(6, 15, 11, 0),
      agent: a1,
      messages: [
        { sender: 'CUSTOMER' as const, body: "I need to update the billing email on my account from oliver.b.old@gmail.com to o.brown@gmail.com. How do I do this?", time: d(6, 15, 11, 0) },
        { sender: 'AGENT' as const, body: `Hi Oliver,\n\nThanks for getting in touch with DailyPlate Support!\n\nI've gone ahead and updated your billing email address from oliver.b.old@gmail.com to o.brown@gmail.com. You'll receive all future receipts and billing notifications at your new email.\n\nIs there anything else I can help you with today?\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 15, 11, 45) },
        { sender: 'CUSTOMER' as const, body: "Perfect, thank you so much! That's all I needed.", time: d(6, 15, 13, 0) },
        { sender: 'AGENT' as const, body: `Hi Oliver,\n\nYou're very welcome! I'm glad I could help. Have a great day and enjoy your next DailyPlate delivery!\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 15, 13, 20) },
      ],
    },
    {
      subject: 'Meal kit item damaged during delivery',
      customer_name: 'Lily Johnson',
      customer_email: 'lily.j@gmail.com',
      category: 'DELIVERY' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 18, 9, 0),
      agent: a0,
      messages: [
        { sender: 'CUSTOMER' as const, body: "The salmon fillet in my kit arrived completely crushed and smelled off. The ice pack had already melted. I don't think it's safe to eat.", time: d(6, 18, 9, 0) },
        { sender: 'AGENT' as const, body: `Hi Lily,\n\nI'm truly sorry to hear about the damaged salmon! Food safety is our top priority and I completely understand your concern.\n\nPlease discard the salmon — do not consume it. I've applied a full credit for the affected item ($18.00) to your account, which will automatically apply to your next order.\n\nI've also reported this to our cold chain logistics team so we can prevent this from happening again. Your feedback is genuinely helpful.\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 18, 10, 15) },
        { sender: 'CUSTOMER' as const, body: "Thank you, that's very reasonable. I appreciate the quick resolution!", time: d(6, 18, 11, 30) },
        { sender: 'AGENT' as const, body: `Hi Lily,\n\nThank you for your understanding! We really appreciate your patience. Enjoy your next delivery — the Harvest Grain Bowl this week has been getting great reviews!\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 18, 11, 50) },
      ],
    },
    {
      subject: 'Gift card balance not showing correctly',
      customer_name: 'Noah Kim',
      customer_email: 'n.kim@outlook.com',
      category: 'VOUCHER' as const,
      priority: 'LOW' as const,
      created: d(6, 20, 14, 0),
      agent: a1,
      messages: [
        { sender: 'CUSTOMER' as const, body: "I have a $50 gift card but my account only shows $25 remaining even though I've only used $12 so far. There seems to be a calculation error.", time: d(6, 20, 14, 0) },
        { sender: 'AGENT' as const, body: `Hi Noah,\n\nThank you for flagging this! Let me investigate your gift card balance.\n\nAfter reviewing your account, I can see what happened — there was a display bug that was incorrectly halving gift card balances in the UI. Your actual balance is $38 (the correct remaining amount after your $12 purchase). The display has now been corrected on your account.\n\nI've also added a $5 bonus credit to your account as an apology for the confusion. I'm sorry for any concern this caused!\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 20, 15, 30) },
        { sender: 'CUSTOMER' as const, body: "Oh wow, I can see the correct balance now. Thanks for fixing it and for the bonus credit! Very impressed.", time: d(6, 21, 9, 0) },
      ],
    },
  ]

  // ─── CLOSED tickets ─────────────────────────────────────────────────────────

  const closed = [
    {
      subject: 'Password reset email not received',
      customer_name: 'Isabella Lee',
      customer_email: 'i.lee@yahoo.com',
      category: 'TECHNICAL' as const,
      priority: 'MEDIUM' as const,
      created: d(6, 16, 14, 0),
      agent: a0,
      messages: [
        { sender: 'CUSTOMER' as const, body: "I clicked 'Forgot Password' three times today but I'm not receiving the reset email. I've checked spam and promotions folders. My email is i.lee@yahoo.com.", time: d(6, 16, 14, 0) },
        { sender: 'AGENT' as const, body: `Hi Isabella,\n\nI'm sorry you're having trouble with the password reset! I can see your account and I've manually triggered a new password reset email from our system. It should arrive within the next 5 minutes.\n\nIf it doesn't arrive, it may be a Yahoo mail deliverability issue. As an alternative, I can reset your password directly — just let me know a temporary password you'd like to use and we can change it from the account side.\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 16, 14, 45) },
        { sender: 'CUSTOMER' as const, body: "I got the email! I've reset my password successfully. All working now. Thank you!", time: d(6, 16, 15, 10) },
        { sender: 'AGENT' as const, body: `Hi Isabella,\n\nWonderful news! I'm so glad that's resolved. Enjoy using DailyPlate — feel free to reach out anytime you need help!\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 16, 15, 25) },
      ],
    },
    {
      subject: 'Unauthorized charge on my account',
      customer_name: 'Ethan Davis',
      customer_email: 'e.davis@gmail.com',
      category: 'PAYMENT' as const,
      priority: 'HIGH' as const,
      created: d(6, 17, 16, 0),
      agent: a1,
      messages: [
        { sender: 'CUSTOMER' as const, body: "There's a charge of $89.99 from DailyPlate on my statement dated June 15 but I cancelled my subscription in May. I never authorized this charge. I want a full refund immediately.", time: d(6, 17, 16, 0) },
        { sender: 'AGENT' as const, body: `Hi Ethan,\n\nI sincerely apologize for this billing issue! Unauthorized charges are something we take extremely seriously.\n\nAfter reviewing your account, I can see that your cancellation was received on May 28th. However, due to a billing cycle timing issue, one additional charge was processed before the cancellation fully took effect. This was an error on our part.\n\nI've issued a full refund of $89.99 to your original payment method. It should appear within 3–5 business days. I've also confirmed your subscription is fully cancelled and no further charges will occur.\n\nI'm very sorry for the stress this caused. Is there anything else I can help you with?\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 17, 17, 15) },
        { sender: 'CUSTOMER' as const, body: "I can see the refund pending on my bank app. Thank you for resolving this so quickly.", time: d(6, 18, 10, 0) },
        { sender: 'AGENT' as const, body: `Hi Ethan,\n\nThank you for confirming. I'm glad we could resolve this quickly for you. I'm closing this ticket but don't hesitate to reach out if you need anything else in the future.\n\nWarm regards,\nDailyPlate Support Team`, time: d(6, 18, 10, 30) },
      ],
    },
  ]

  // ─── Seed all tickets ───────────────────────────────────────────────────────

  let msgCounter = 1

  // OPEN tickets
  for (const t of open) {
    const ticket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        customer_name: t.customer_name,
        customer_email: t.customer_email,
        status: 'OPEN',
        priority: t.priority,
        category: t.category,
        email_thread_id: msgId(msgCounter++),
        created_at: t.created,
        last_updated_at: t.created,
        last_customer_reply_at: t.created,
      },
    })
    await prisma.message.create({
      data: {
        ticket_id: ticket.id,
        body: t.body,
        sender_type: 'CUSTOMER',
        sent_at: t.created,
      },
    })
    process.stdout.write(`  OPEN   ${t.subject.slice(0, 50)}\n`)
  }

  // IN_PROGRESS tickets
  for (const t of inProgress) {
    const ticket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        customer_name: t.customer_name,
        customer_email: t.customer_email,
        status: 'IN_PROGRESS',
        priority: t.priority,
        category: t.category,
        assigned_to_id: t.agent.id,
        email_thread_id: msgId(msgCounter++),
        created_at: t.created,
        last_updated_at: t.messages[t.messages.length - 1].time,
        last_customer_reply_at: t.messages.filter(m => m.sender === 'CUSTOMER').slice(-1)[0].time,
      },
    })
    for (const m of t.messages) {
      await prisma.message.create({
        data: { ticket_id: ticket.id, body: m.body, sender_type: m.sender, sent_at: m.time },
      })
    }
    process.stdout.write(`  IN_PROG ${t.subject.slice(0, 50)}\n`)
  }

  // RESOLVED tickets
  for (const t of resolved) {
    const ticket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        customer_name: t.customer_name,
        customer_email: t.customer_email,
        status: 'RESOLVED',
        priority: t.priority,
        category: t.category,
        assigned_to_id: t.agent.id,
        email_thread_id: msgId(msgCounter++),
        created_at: t.created,
        last_updated_at: t.messages[t.messages.length - 1].time,
        last_customer_reply_at: t.messages.filter(m => m.sender === 'CUSTOMER').slice(-1)[0].time,
      },
    })
    for (const m of t.messages) {
      await prisma.message.create({
        data: { ticket_id: ticket.id, body: m.body, sender_type: m.sender, sent_at: m.time },
      })
    }
    process.stdout.write(`  RESOLVD ${t.subject.slice(0, 50)}\n`)
  }

  // CLOSED tickets
  for (const t of closed) {
    const ticket = await prisma.ticket.create({
      data: {
        subject: t.subject,
        customer_name: t.customer_name,
        customer_email: t.customer_email,
        status: 'CLOSED',
        priority: t.priority,
        category: t.category,
        assigned_to_id: t.agent.id,
        email_thread_id: msgId(msgCounter++),
        created_at: t.created,
        last_updated_at: t.messages[t.messages.length - 1].time,
        last_customer_reply_at: t.messages.filter(m => m.sender === 'CUSTOMER').slice(-1)[0].time,
      },
    })
    for (const m of t.messages) {
      await prisma.message.create({
        data: { ticket_id: ticket.id, body: m.body, sender_type: m.sender, sent_at: m.time },
      })
    }
    process.stdout.write(`  CLOSED  ${t.subject.slice(0, 50)}\n`)
  }

  const total = open.length + inProgress.length + resolved.length + closed.length
  console.log(`\nDone — seeded ${total} tickets (${open.length} open, ${inProgress.length} in-progress, ${resolved.length} resolved, ${closed.length} closed).`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
