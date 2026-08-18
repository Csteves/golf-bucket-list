# The No Handicap Golf Tour

A static GitHub Pages site for the group's golf-course bucket list, live: https://csteves.github.io/golf-bucket-list/

## Publish on GitHub Pages

1. Create a new GitHub repo, for example `golf-bucket-list`.
2. Push `index.html` and `README.md` to the root of the repo, on branch `main`.
3. In GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/(root)**
5. Save. GitHub will give you a public link after it deploys.

## Backend

Course data is stored in **Firebase Firestore** (project `no-handicap`), synced live
across everyone who opens the page — no login required. The page reads/writes the
`courses` collection directly from the browser via the Firebase Web SDK
(`index.html`'s inline `<script type="module">`).

- Console: https://console.firebase.google.com/project/no-handicap/firestore/databases/-default-/data
- Rules: `firestore.rules` (deploy changes with `firebase deploy --only firestore:rules --project no-handicap`)
- Because there's no auth, `courses` documents are readable/writable by anyone with
  the page link. Rules validate shape (name/status/votes) but don't restrict who can
  write — fine for a small trusted group, not for a public app.

## Security model

- The membership check on load is a **speed-bump, not a security boundary** —
  a savvy user can bypass it entirely via `localStorage.setItem("ndht_gate","ok")`
  in devtools. It's there for the bit, not to keep anyone out.
- The real protection for Firestore is **App Check + `firestore.rules`**
  (shape validation). App Check is currently a no-op (`CONFIG.appCheckSiteKey`
  is empty) — see the worker setup section below for enabling it.
- The worker's `guard()` (Origin + `X-Fork-Token` check) deters casual/scripted
  abuse of the AI endpoints; both are visible in the served page, so this is
  not a boundary against a targeted attacker. The Cloudflare rate-limit rule
  on the worker route is the actual budget protection.
- Firebase web config, the worker URL, and the App Check site key are public
  by design — hiding them isn't possible for a static client and isn't the
  point. Only the worker's API keys are genuine secrets, and they never reach
  the browser.

## Worker setup (secrets)

The worker (`worker/src/index.js`) needs these set once via `wrangler secret put <NAME>`
(run from the `worker/` directory) — never commit these values:

- `OPENAI_API_KEY` — OpenAI key used for line generation, vibes, and trip tips.
- `RESEND_API_KEY` — Resend key used for the `/notify` email endpoint.
- `NOTIFY_TO` — the inbox that receives new-course/vote/comment notifications.
  This is PII (a real email address), which is why it's a secret and not a
  `CONFIG` value — the client never needs to know who gets notified.
- `FORK_TOKEN` — shared value also embedded in `index.html` as
  `CONFIG.forkToken`; must match exactly. Current value: see `CONFIG.forkToken`
  in `index.html`, or generate a fresh one with `openssl rand -hex 32` and
  update both places together.

`SITE_ORIGIN` and `NOTIFY_FROM` are plain (non-secret) vars already set in
`worker/wrangler.toml`.

**Deploy order matters**: set all four secrets first, *then* `wrangler deploy`.
Deploying the new worker code before the secrets exist will make `guard()`
reject every request (misconfigured `FORK_TOKEN`/`SITE_ORIGIN` reads as
`undefined`, which never matches), breaking line generation, trip tips, and
notifications until the secrets are set.

## Adding a course

When you add a new bucket-list course to the site, generate its line with the
**No Handicap Tour Caddie** GPT: https://chatgpt.com/g/g-6a81f192cd0c8191a81498e513841be1-no-handicap-tour-caddie

Give it: the course name, status (Bucket item / Next trip / Completed), who added
it, and the course's vibe. It returns a funny, character-specific line — paste
that into the **Inside joke / scouting report** field when you add the course
on the site.

