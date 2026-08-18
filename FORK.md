# Forking this for your own group

This repo started as a golf bucket list for one friend group but is built so
another group can fork it, point it at their own backend, edit one config
block, and deploy — without touching worker code and without exposing the one
genuine secret. This doc is the step-by-step for that.

Read `README.md`'s **Security model** section too — it's short, and it tells
you honestly what actually protects your fork's data versus what's cosmetic.

---

## 1. Fork the repo

Fork it on GitHub, or clone it and push to a new repo you own. Either way,
everything below assumes you're working in your own copy.

## 2. Create your own Firebase project

1. Create a new project at https://console.firebase.google.com.
2. Enable **Firestore** (Native mode).
3. In Project Settings → General → Your apps, add a **Web app** and copy the
   config object it gives you.
4. Paste those values into `CONFIG.firebaseConfig` in `index.html`.
5. Update `.firebaserc` — replace `no-handicap` with your project's ID.

## 3. Deploy your own Cloudflare Worker

The worker (`worker/`) is the only place with genuine secrets. It's already
generic — no persona or branding text is hardcoded in `worker/src/index.js`
anymore, so **you don't need to edit worker code at all**, just its config
and secrets.

1. `cd worker && npx wrangler deploy` — this publishes the worker to your own
   Cloudflare account under the name in `wrangler.toml` (rename it there first
   if you want something other than `no-handicap-caddie`).
2. Edit `worker/wrangler.toml`'s `[vars]`:
   - `SITE_ORIGIN` → your GitHub Pages URL (e.g. `https://yourname.github.io`).
     Must match exactly, scheme + host, no path.
   - `NOTIFY_FROM` → a sender address on a domain you've verified with Resend
     (or leave the default if you're fine sharing a sending identity).
3. Set the five secrets (never committed, run from `worker/`):
   ```
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put NOTIFY_TO
   npx wrangler secret put FORK_TOKEN
   npx wrangler secret put MANAGER_TOKEN
   ```
   `NOTIFY_TO` is the inbox that gets new-course/vote/comment emails.
   `FORK_TOKEN` and `MANAGER_TOKEN` are values *you* generate — see step 6.
4. **Deploy order matters**: set all five secrets, *then* `wrangler deploy`
   (or redeploy after setting them). The worker's `guard()` rejects every
   request until `SITE_ORIGIN`/`FORK_TOKEN` are real, so deploying worker code
   before the secrets exist just means everything 403s until you finish.

## 4. Point the client at your worker

Set `CONFIG.caddieUrl` in `index.html` to your worker's URL (Cloudflare shows
it after `wrangler deploy`, looks like
`https://your-worker-name.your-subdomain.workers.dev`). **Don't skip this** —
if you forget, your fork's AI calls silently hit the original worker and bill
someone else's key.

## 5. Generate the two tokens

Both are arbitrary values you generate yourself — nothing to register with a
provider:

```
openssl rand -hex 32   # → CONFIG.forkToken in index.html AND `wrangler secret put FORK_TOKEN`
openssl rand -hex 16   # → `wrangler secret put MANAGER_TOKEN` only — do NOT put this one in index.html
```

`forkToken` is public by necessity (it ships in the page — it only deters
scripted abuse, not a real boundary). `MANAGER_TOKEN` must stay private: never
commit it, never put it in `CONFIG`. Tell it only to whoever runs your fork's
"manager" member (see step 8) — they'll be prompted for it in-browser the
first time they click Regenerate each session.

## 6. Set up your members

Edit `CONFIG.members` in `index.html`. For each person:

1. Pick a character name and write a short public `blurb` (shown on the site)
   and a longer `persona` paragraph (sent to the worker per AI request — this
   is what gives the AI's comedy lines a consistent voice per character).
2. Set `manager: true` on **exactly one** member — whoever holds your worker's
   secrets is the natural choice. Everyone else gets `manager: false`.
3. Generate their credential instead of writing a real passphrase into the
   repo: open the deployed page, open devtools console, run
   `makeCredential("their phrase").then(c => console.log(JSON.stringify(c)))`,
   and paste the resulting `{salt, passHash, iterations}` into that member's
   entry as `salt`/`passHash`/`iterations` fields (skip the legacy `hash`
   field entirely — that's only there for this repo's original four members,
   who migrated from an older unsalted scheme). The plaintext phrase never
   needs to leave whoever's console it was typed into.
4. Swap in an icon image under `images/web/` and update `icon`.

## 7. Branding, roasts, statuses, starter items

Also in `CONFIG`:
- `branding` — title, tagline, eyebrow, footer, and the gate's heading/body/hint.
- `gateRoasts` — the wrong-guess lines.
- `starterItems` — the seed list new visitors see (only used the very first
  time, via `setDoc` — see the module script).
- `statuses` — **known gap**: this array is declared but not fully wired up
  yet. The three status names (`Bucket item` / `Next trip` / `Completed`) are
  still hardcoded in a few places — the filter buttons, the add-course
  status `<select>`, and the sort-order map (`const order = ...`) in the
  module script. If you want different status names, edit those spots
  directly too, not just `CONFIG.statuses`.

## 8. Firestore rules and App Check

1. Deploy `firestore.rules` as-is (it's already generic — no fork-specific
   values in it): `npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID`.
2. Optional but recommended: enable **App Check** (Firebase Console → App
   Check → register a reCAPTCHA v3 site key for your web app), then enforce
   it for Firestore. Paste the site key into `CONFIG.appCheckSiteKey` — until
   you do, App Check init is a no-op and Firestore is only protected by the
   rules' shape validation.
3. Optional: add a Cloudflare rate-limit rule on your worker route (dashboard,
   a couple clicks) — the actual budget backstop behind `FORK_TOKEN`.

## 9. Enrichment flag

`CONFIG.enrichment.enabled` gates the golf-specific features: course-name
autocomplete, tee/slope/rating data, and Trip Info. They lean on OpenGolfAPI
(a US-golf-only database) and worker prompts written assuming golf trips.
Leave `true` for a golf fork. Set `false` for any other topic — line
generation and vibes stay on either way, since those are fully generic.

## 10. Deploy

Follow README's **Publish on GitHub Pages** section (Settings → Pages →
Deploy from branch → `main` → `/root`). Once it's live, open it, unlock with
one of the credentials you generated in step 6, and confirm: Add a course
works, line generation works, and (if you're the manager) Trip Info's
Regenerate asks for the manager code once per session.

## 11. Read the residual limits

Before you tell people it's "secure," read README's **Security model**
section. Short version: the entry gate is a bit, not a boundary; App Check +
rules are what actually protect your data; the fork/manager tokens deter
casual abuse of your AI budget, not a targeted attacker. That's the
intentional, proportionate bar for a trusted-group tool — know it going in.
