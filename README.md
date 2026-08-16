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

## Adding a course

When you add a new bucket-list course to the site, generate its line with the
**No Handicap Tour Caddie** GPT: https://chatgpt.com/g/g-6a81f192cd0c8191a81498e513841be1-no-handicap-tour-caddie

Give it: the course name, status (Bucket item / Next trip / Completed), who added
it, and the course's vibe. It returns a funny, character-specific line — paste
that into the **Inside joke / scouting report** field when you add the course
on the site.

## Notes

The "Export list" button still downloads the current shared list as JSON, useful for backups.
