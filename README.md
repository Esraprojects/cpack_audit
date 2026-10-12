# Free Esra — Income & Cost Manager

A small web app for the Free Esra project. It records **income** (sales) and **payments** (costs), and gives the owner a password-protected **financial report**. The report shows totals, initial cost, pure profit, charts and suggested strategies.

It is plain HTML/CSS/JavaScript: no server, no build step, no install.

## How to open it

- **On a computer:** double-click `index.html`. It opens in Chrome, Edge or Firefox.
- **On a phone or for several people:** host the folder on any static host, such as GitHub Pages. In the repo, go to *Settings → Pages* and choose this branch. Then open the link on the phone and use *Add to Home screen*.

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
Password: `esmer@craft`

- Pick any period with the calendar (From / To), or use a preset: Today, This week, This month, Last month, This year, All time.
- Totals: sales, collected, remaining, initial cost, payments, total cost, gross profit, **pure profit** with margin, and net cash flow.
- Charts: income / cost / profit over time (daily or monthly), profit by material, payments by material, and sales by print type. Hover or tap a bar to see the numbers.
- Customers who still owe money, listed by phone number.
- **Suggested strategies:** built-in analysis covering margins, products to reprice, best earners, money to collect, spending, trends against the previous period, loyal customers and the best sales day. It works offline.
- **Ask Claude AI** (optional): save an Anthropic API key under *Data & settings* to get written strategy advice from Claude. Only the report totals are sent, never phone numbers. The key is stored in that browser only.
- Full record tables with Edit/Delete, **Export CSV** (opens in Excel), and **Print / PDF**.

### Profit formulas
| Figure | Formula |
|---|---|
| Total income (sales) | sum of "Total Birr to be paid" |
| Initial cost | sum of each sale's initial cost (× amount when prices are per unit) |
| Gross profit | sales − initial cost |
| Payments | sum of the Payments tab |
| **Pure profit** | sales − initial cost − payments |
| Net cash flow | collected (paid) − payments |

## Where the data lives — please read
Records are saved in the **browser's local storage on the device you use**. This means:

- Data entered on one phone is not visible on another device automatically. Use **Download backup** and **Restore backup** (Owner → Data & settings) to move or protect the data. Make a backup regularly.
- Clearing the browser's site data deletes the records, unless you have a backup.
- The owner password stops casual access on a shared device. It is **not** strong security, because anyone with technical skills can read the browser's storage. If several people on different devices need to share live data, the next step is a small online database (for example Firebase or Supabase).

## Files
```
index.html        page layout
css/style.css     styles (light and dark mode, mobile friendly, print)
js/store.js       saving, input memory and report calculations
js/charts.js      SVG charts with tooltips
js/insights.js    built-in strategy suggestions
js/ai.js          optional Claude AI advice
js/sha256.js      password check
js/app.js         screens and buttons
```
