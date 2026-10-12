# Put CPack Audit online (free)

This takes about 20 minutes and costs nothing. No credit card is needed.

- **Firebase** (by Google) stores the records and handles logins. Its free "Spark" plan allows 50,000 reads and 20,000 saves per day, which is far more than a shop needs.
- **Netlify** puts the website online at an address like `cpack-audit.netlify.app`. It reads the files straight from this private GitHub repo and updates the site by itself whenever the code changes.

You only do this once.

---

## Part 1 — Firebase (database and logins)

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Create a project** and name it `cpack-audit`. Turn Google Analytics **off** (not needed), then click **Create project**.

### Turn on email + password login
3. In the left menu open **Build → Authentication → Get started**.
4. Under **Sign-in method**, click **Email/Password**, switch on the first toggle, and click **Save**.
5. Open the **Users** tab and click **Add user**.
   - Email: the owner's email, for example `esra@gmail.com`.
   - Password: the owner password. You can use `esmer@craft` as planned, or something longer and harder to guess. This password now lives only in Firebase, not in the app's code.

### Create the database
6. In the left menu open **Build → Firestore Database → Create database**.
7. Choose a location close to Ethiopia (any **europe-** location is fine). You cannot change it later.
8. Choose **Start in production mode**, then **Create**.

### Get your project's settings
9. Click the gear icon ⚙ next to *Project Overview* → **Project settings**.
10. Under **Your apps**, click the web icon **`</>`**. Nickname: `cpack-audit`. Leave "Firebase Hosting" unticked. Click **Register app**.
11. You will see a block of code that starts with `const firebaseConfig = {`. Keep this page open. You will copy it in Part 3.

---

## Part 2 — Netlify (website address)

1. Go to <https://app.netlify.com/signup> and choose **Sign up with GitHub**.
2. Click **Add new site → Import an existing project → GitHub**.
3. Allow Netlify to see the repository **Esraprojects/cpack_audit**. If it is not listed, click *Configure the Netlify app on GitHub* and give it access to this repo.
4. Pick the repository. Set:
   - **Branch to deploy:** `claude/esra-income-cost-manager-ghammw` (the branch with the app)
   - **Build command:** leave empty
   - **Publish directory:** `.`
5. Click **Deploy**. After about a minute you get an address like `https://random-name-123.netlify.app`.
6. Optional: in **Site configuration → Change site name**, rename it to, for example, `cpack-audit` → `https://cpack-audit.netlify.app`.
7. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**. Add your Netlify address without `https://`, for example `cpack-audit.netlify.app`. This makes the "Forgot password" emails work.

---

## Part 3 — Connect the site to Firebase (setup helper)

1. Open your Netlify address. Because it isn't connected yet, it shows **Connect your database**.
2. In box 1, paste the whole `firebaseConfig` block from Part 1, step 11. In box 2, type the owner email from Part 1, step 5. Press **Make my settings**.
3. The helper shows two pieces of text, each with a **Copy** button:
   - **A. Settings file:** in GitHub open this repository and the file **`js/config.js`**. Click the pencil ✏ (Edit), select all the text and delete it, paste, then click **Commit changes**.
   - **B. Security rules:** in Firebase open **Firestore Database → Rules**. Select all and delete, paste, then click **Publish**. *This is the step that locks the owner data. Don't skip it.*
4. Wait a minute or two while Netlify updates the site, then reload it. You now see the **Sign in** screen.

The settings in `js/config.js` are safe to keep in the code. They only tell the app which database to talk to. What protects your data are the logins and the rules you published in step B, which run on Google's servers.

<details>
<summary>Doing it by hand instead</summary>

- In `js/config.js`, replace each `PASTE_...` value with the matching value from `firebaseConfig`, and set `ownerEmail` to the owner email.
- Copy all of `firestore.rules` into Firebase → Firestore Database → Rules. Replace `OWNER_EMAIL_HERE` with the same owner email in small letters, keeping the quotes. Then click **Publish**.
</details>

---

## Part 4 — Start using it

1. Install the app on each phone. It's the same web app for both; nothing is downloaded from an app store.
   - **Android (Chrome):** open your Netlify address, tap the menu **⋮** → **Install app** (or **Add to Home screen**) → **Install**.
   - **iPhone (Safari):** open your Netlify address **in Safari**, tap the **Share** button (square with an arrow) → **Add to Home Screen** → **Add**. On iPhone this only works from Safari, not from Chrome or the Instagram/Telegram browser.

   The CPack Audit icon appears on the home screen and opens full screen like a normal app. It also opens on weak internet and updates itself when online.
2. Sign in with the owner email and password.
3. Open the **Owner** tab. It asks for the password again. Scroll down to **Staff** and add each manager with a name, email and starting password. Give them those details.
4. Managers sign in on their own phones. They see only **Income** and **Payments**, with unpaid orders and the last two days of entries. They never see the Owner tab, the report or the full history. Google's servers refuse that data to them even if they try technical tricks.
5. To block a manager, press **Remove** next to their name. It takes effect at once.

### If you used the old offline version
In the old version: Owner → Data & settings → **Download backup**. In the online version: Owner → Data & settings → **Upload backup**.

---

## Good to know

- **Weak internet:** entries are kept on the phone and sent when the connection returns. The dot next to your email shows **Online** or **Offline**.
- **Forgot password:** on the sign-in screen, type the email and press *Forgot password?*. A reset link is emailed.
- **The Owner tab locks itself** after 10 minutes without use and asks for the password again. You can change the minutes in `js/config.js`.
- **Changing the owner email** later: add the new email as a user in Authentication, then run the setup helper again by temporarily undoing `js/config.js`. Or change the email by hand in both `js/config.js` and the Firestore rules.
- **Your own copy:** Owner → Data & settings → **Download backup** saves everything to a file. It is a good idea to do this monthly.
