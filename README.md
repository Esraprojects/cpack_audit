# CPack Audit — Income & Cost Manager

An online web app for the CPack Audit project. It records **income** (sales) and **payments** (costs), and gives the owner a locked **financial report**. The report shows totals, initial cost, pure profit, charts and suggested strategies.

- Runs on free services: **Firebase** (Google) for logins and the database, and **Netlify** for the website.
- Everyone signs in. Only the owner can open the Owner tab, and the database itself refuses owner data to anyone else.
- Works on **Android and iPhone** (and computers). Install it from the browser to get a home-screen app icon. It keeps working on weak internet: entries sync when the connection returns.

**To put it online, follow [SETUP.md](SETUP.md)** (about 20 minutes, one time).

## Tabs

### Income
Fields: date (defaults to today, editable), material, GSM, size (XS–XL), print type (Full, One side, Two side, Digital UV, Offset), amount (quantity), initial cost, selling price, total Birr to be paid, paid, remaining, phone number, other reasons.

- **Prices per Unit / Whole order** switch. With *Unit*, total = amount × selling price and cost = amount × initial cost. With *Whole order*, the prices you type are the totals for the whole job.
- **Total** is calculated automatically, and you can type over it. **Remaining** = total − paid.
- A live preview shows the total cost and profit before you press **Done**.

### Payments
Fields: date, material/item, GSM, size, type, quantity (optional), amount paid (Birr), phone, other reasons.

### The app remembers your inputs
- When you pick a material, the app fills in the GSM, size, print type and prices you used **last time for that material**. The fields flash green so you can see what was filled. The memory updates every time you save.
- **Quick fill** chips repeat your most recent combinations with one tap.
- GSM, amounts, prices, phone numbers and notes show suggestions from earlier entries.
- Pick **+ Other (type new)…** to add a new material; it is then added to the list.

### Recent tables
After **Done**, each record is saved with a timestamp and appears in the table. **Receive** records a later payment from a customer who still owes money. **Edit** corrects a record.

### Owner 🔒
Only the owner's account sees this tab. Opening it asks for the owner password again, checked by Google's servers, and it locks itself after 10 idle minutes.

- Pick any period with the calendar (From / To), or use a preset: Today, This week, This month, Last month, This year, All time.
- Totals: sales, collected, remaining, initial cost, payments, total cost, gross profit, **pure profit** with margin, and net cash flow.
- Charts: income / cost / profit over time (daily or monthly), profit by material, payments by material, and sales by print type. Hover or tap a bar to see the numbers.
- Customers who still owe money, listed by phone number.
- **Suggested strategies:** built-in analysis covering margins, products to reprice, best earners, money to collect, spending, trends against the previous period, loyal customers and the best sales day. It works offline.
- **Ask Claude AI** (optional): save an Anthropic API key under *Data & settings* to get written strategy advice from Claude. Only the report totals are sent, never phone numbers. The key is stored in that browser only.
- Full record tables with Edit/Delete, **Export CSV** (opens in Excel), and **Print / PDF**.
- **Staff:** add a manager (name, email, password) or remove one. Removal blocks them immediately.
- **Backup:** download all records as a file, or upload a backup (also from the old offline version).

### Profit formulas
| Figure | Formula |
|---|---|
| Total income (sales) | sum of "Total Birr to be paid" |
| Initial cost | sum of each sale's initial cost (× amount when prices are per unit) |
| Gross profit | sales − initial cost |
| Payments | sum of the Payments tab |
| **Pure profit** | sales − initial cost − payments |
| Net cash flow | collected (paid) − payments |

## Who can see what
These rules are enforced by the database (`firestore.rules`) on Google's servers, not just hidden on screen.

| | Owner | Manager | Anyone else |
|---|---|---|---|
| Add income and payments | ✓ | ✓ | ✗ |
| See unpaid orders and the last 2 days of entries | ✓ | ✓ | ✗ |
| Record a later payment ("Receive") and fix recent entries | ✓ | ✓ | ✗ |
| Full history, report, charts, strategies | ✓ | ✗ | ✗ |
| Delete records, manage staff, backups | ✓ | ✗ | ✗ |

Someone who creates their own login, or who has been removed, sees only a "waiting for approval" screen and gets no data.

## Files
```
index.html        page layout
css/style.css     styles (light and dark mode, mobile friendly, print)
js/config.js      your Firebase project settings and owner email (fill in once)
js/setup.js       setup helper shown until config.js is filled in
js/cloud.js       login, live data and saving to Firebase
js/store.js       input memory and report calculations
js/charts.js      SVG charts with tooltips
js/insights.js    built-in strategy suggestions
js/ai.js          optional Claude AI advice
js/app.js         screens and buttons
firestore.rules   database security rules (who can read and write what)
netlify.toml      website hosting settings
firebase.json     settings for the Firebase command-line tool (optional)
manifest.webmanifest, icons/   home-screen app icon for Android and iPhone
sw.js             lets the installed app open on weak internet
```
