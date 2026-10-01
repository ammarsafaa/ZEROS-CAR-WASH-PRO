<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Vendor license keys: tools/keygen.mjs <MACHINE_ID> (salt must match src/lib/db.ts) — keeps activation fully offline.
- Desktop build: vite.desktop.config.ts (SPA shell) + electron/main.cjs serving the UI over app:// for a stable origin (keeps local data across updates).
- Windows installer (electron-builder NSIS) + auto-updates (electron-updater via GitHub Releases of this repo) are built by .github/workflows/build-windows.yml; electron/package.json holds the packaging config.
- LAN sync: electron/server.cjs (port 8787) hosts master DB JSON in userData + serves UI; renderer syncs via src/lib/sync.ts (localStorage stays the cache, saveDB pushes debounced, poll every 3s). Why: multi-device sharing must work offline; keeping localStorage avoids rewriting all pages.
