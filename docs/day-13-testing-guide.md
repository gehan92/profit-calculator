# Day 13 testing guide

For: Gehan, when testing with real shop owners and Sinhala / Tamil readers (Part G1, Day 13).
Goal: notes you can act on in Day 14. You are testing the website, not the people.

## Before you start

1. Put the website on a link people can open on their phone (a Vercel preview link). A link to your PC will not work for them.
2. In Supabase → Authentication → URL Configuration, add that link as the Site URL and as a redirect URL (`https://your-link/**`). Without this, "Continue with Google" does not come back to the site.
3. Make sure Google login works for you first. Do one full run yourself using Part 1 below.
4. Print or copy the note table at the end (Part 5). Write while they use it. Do not help unless they are stuck for more than 30 seconds, and write down where they got stuck.

## Part 1: Shop owner test (about 10 minutes each, 5–10 people)

Say first: "I want to know what is hard. If you get stuck, it is my mistake, not yours."

Give one task at a time. Do not explain the screens.

| # | Task | Watch for |
|---|------|-----------|
| 1 | Open the link on your own phone. | Which language do they see? Can they find the language button alone? |
| 2 | Use the Profit calculator with real numbers from one item you sell. | Do they understand the result? Do they trust it? |
| 3 | Open "My Business (Try)". Add 3 records: a sale, a cost, and money you took for family use. | Time to add one record (goal: under 10 seconds). Do they find Income / Expense? |
| 4 | Log in with Google. Say Yes to "Move records to your account". | Do the 3 records arrive? Any fear about logging in? |
| 5 | Add a sale. Edit it. Delete it and press Undo. | Do they notice the 5-second Undo? |
| 6 | Open Summary. Ask: "What does Real profit mean?" | Can they say it in their own words? |
| 7 | Switch on airplane mode. Add one record. Switch it off. | Do they see "Saved on this phone"? Does it send by itself? |
| 8 | Open Settings. Change the language. Download the records (CSV). | Can they find it? |
| 9 | Send us a message from "Feedback" at the bottom of the page. | Does it send? |

Ask at the end:

1. Would you use this every day? Why / why not?
2. What was confusing?
3. Which word or number did you not trust?
4. Would you tell another shop owner? What would you say?
5. What is missing?

## Part 2: Sinhala and Tamil review (native speakers)

Ask 2 Sinhala readers and 2 Tamil readers. Open the site in their language and go through every screen below. For each screen they write one of:

- OK: reads naturally
- Change: write the better words
- Wrong: the meaning is wrong

Screens: Home · Profit, Margin, Selling price, Break-even (including guide and FAQ) · My Business (Try) · Login · Owner home · Add record · Records list and edit · Summary (including "Real profit" and the "Why?" box) · Settings · Feedback · About · Privacy · Terms · "Your account is paused" · Offline screen · Error screen.

Look closely at:

- Money words: profit, margin, selling price, break-even, real profit, hidden costs.
- Month and weekday names, and the order of words in dates.
- Buttons: is any text cut off at phone width?
- Privacy and Terms: a lawyer or a careful reader should also check these two before launch.

Where to change the words: `src/messages/si.json` and `src/messages/ta.json`. Collect their list and I can apply it.

## Part 3: Cheap Android phone

On a low-end phone, with mobile data (not Wi-Fi):

1. Does the home page open in under 5 seconds the first time?
2. Is the text easy to read outside, in sunlight?
3. Are the buttons big enough for a thumb?
4. Add a record: under 10 seconds from opening the app?
5. Chrome menu → "Add to Home screen" (or the install strip after the second visit). Does it open like an app?
6. Open the app with the internet off. Does the saved dashboard open?

## Part 4: Checks to run yourself

These are already tested by the computer, but look once with your own eyes:

- Log in as two different people. Neither can see the other's records.
- Block a test user in the admin panel. They see "Your account is paused".
- Turn on maintenance in Admin → Settings. The banner shows, adding still works.
- Delete a test account in Settings. Its records are gone.

## Part 5: Notes table

| Person | Phone | Language | Stuck at (task #) | What they said | Fix in Day 14? (Yes / Later / No) |
|--------|-------|----------|-------------------|----------------|-----------------------------------|
|        |       |          |                   |                |                                   |

Sort the table at the end:

1. Things that stopped someone from finishing a task: fix first.
2. Words that were wrong or unnatural in Sinhala / Tamil: fix next.
3. Ideas for new features: write them down for later; do not build them before launch.
