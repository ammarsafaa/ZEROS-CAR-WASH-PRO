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
- Desktop build: vite.desktop.config.ts (SPA shell) + electron/main.cjs serving dist/client over app:// for a stable origin; packaged with @electron/packager, installer via installer/CarWashPro.iss.
- Windows installer is built by GitHub Actions (.github/workflows/build-windows.yml) on a Windows runner — the sandbox cannot run Inno Setup.
