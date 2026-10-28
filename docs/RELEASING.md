# Releasing

Releases are deployed with the local `deploy.ps1` script. Pushing to GitHub does **not** deploy anything.

## Steps

1. Test the change locally (`python -m http.server 8000`) using the relevant section of [TESTING.md](TESTING.md)
2. Commit and push to `main` so the repository matches what's deployed
3. Run the deploy script from the repo root:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\deploy.ps1
   ```

4. Open the live site and hard-refresh it to confirm the change is there

## What the script does

1. Copies `index.html`, `css/` and `js/` into a temporary `.release/` folder
2. Adds `?v=<timestamp>` to every local CSS/JS link in the staged `index.html` so browsers and the CDN load the new version instead of cached copies
3. Packs the bundle into `devtools-release.tar.gz`, uploads it over SSH and replaces the live files on the server
4. Deletes the temporary folder and archive, even when a step fails

Only `index.html`, `css/` and `js/` are deployed. The docs and other repo files never reach the server.

## Why `deploy.ps1` isn't in the repo

The script contains private server details (host, paths), so it's kept out of version control on purpose:

- `.gitignore` excludes `deploy*`, plus the script's temporary outputs `.release/` and `devtools-release.tar.gz`
- Ask the maintainer for a copy and put it in the repo root
- Never commit it, paste its contents into issues or PRs, or copy its server details into these docs
