# Put Free Esra online (free)

This takes about 20 minutes and costs nothing. No credit card is needed.

- **Firebase** (by Google) stores the records and handles logins. Its free "Spark" plan allows 50,000 reads and 20,000 saves per day, which is far more than a shop needs.
- **Netlify** puts the website online at an address like `free-esra.netlify.app`. It reads the files straight from this private GitHub repo and updates the site by itself whenever the code changes.

You only do this once.

---

## Part 1 — Firebase (database and logins)

1. Go to <https://console.firebase.google.com> and sign in with a Google account.
2. Click **Create a project** and name it `free-esra`. Turn Google Analytics **off** (not needed), then click **Create project**.

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

### Lock the database (most important step)
9. In Firestore Database, open the **Rules** tab.
10. Delete everything in the box. Open the file `firestore.rules` from this project and paste all of it in.
11. Find `OWNER_EMAIL_HERE` (it appears once) and replace it with the owner's email from step 5, **in small letters**. Keep the quotes:
    ```
    function isOwner() { return signedIn() && email() == 'esra@gmail.com'; }
    ```
12. Click **Publish**.

### Connect the app to your project
13. Click the gear icon ⚙ next to *Project Overview* → **Project settings**.
14. Under **Your apps**, click the web icon **`</>`**. Nickname: `free-esra`. Leave "Firebase Hosting" unticked. Click **Register app**.
15. You will see a block of code with `const firebaseConfig = { apiKey: "...", ... }`. Keep this page open.
16. In GitHub, open this repository and the file **`js/config.js`**. Click the pencil ✏ (Edit) and replace each `PASTE_...` value with the matching value from step 15:
    ```js
    firebase: {
      apiKey: 'AIza...',
      authDomain: 'free-esra-xxxx.firebaseapp.com',
      projectId: 'free-esra-xxxx',
      storageBucket: 'free-esra-xxxx.firebasestorage.app',
      messagingSenderId: '1234567890',
      appId: '1:1234567890:web:abc123'
    },
    ownerEmail: 'esra@gmail.com',
    ```
    `ownerEmail` must be the **same** email as in step 11.
17. Click **Commit changes**.

These values are safe to keep in the code. They only tell the app which database to talk to. What protects your data are the logins and the rules from steps 9–12, which run on Google's servers.

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
6. Optional: in **Site configuration → Change site name**, rename it to, for example, `free-esra` → `https://free-esra.netlify.app`.
7. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain**. Add your Netlify address without `https://`, for example `free-esra.netlify.app`. This makes the "Forgot password" emails work.

---

## Part 3 — Start using it

1. Open your Netlify address. On a phone, use the browser menu → **Add to Home screen**.
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
- **Changing the owner email** later: change it in both `js/config.js` and the Firestore rules (step 11), and add the new email as a user in Authentication.
- **Your own copy:** Owner → Data & settings → **Download backup** saves everything to a file. It is a good idea to do this monthly.
