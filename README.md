# Anaconda Hills Golf Bucket List

A simple static GitHub Pages site for the group's golf-course bucket list.

## Publish on GitHub Pages

1. Create a new GitHub repo, for example `golf-bucket-list`.
2. Upload `index.html` to the root of the repo.
3. In GitHub, go to **Settings → Pages**.
4. Under **Build and deployment**, choose:
   - Source: **Deploy from a branch**
   - Branch: **main**
   - Folder: **/root**
5. Save. GitHub will give you a public link after it deploys.

## Notes

This version stores changes in each visitor's browser using `localStorage`.
Everyone can interact with it, but their changes are local to their own device.

For true shared voting/editing across the group, connect the page to Firebase, Supabase, Airtable, or a Google Sheet backend later.
