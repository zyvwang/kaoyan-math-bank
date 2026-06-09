# Release Checklist

Use this checklist before producing a public macOS DMG or Windows NSIS installer.

## Local Verification

1. Run `npm ci` on a clean checkout when possible.
2. Run `npm run verify`.
3. Confirm the Vite output keeps the main chunk separate from `LatexEditor`.
4. If TeX is installed locally, confirm `scripts/verify-export.ts` compiles both `questions.pdf` and `full.pdf`.
5. Launch the desktop app with `npm run desktop:dev` and smoke-test:
   - first workspace setup
   - editing and autosave
   - image upload
   - current-item compile
   - selected export
   - reveal/delete workspace actions

## CI Release Build

1. Push the release branch or tag.
2. Run the **Build Release Installers** workflow.
3. Confirm both Windows and macOS jobs pass `npm run verify`.
4. Download and test artifacts:
   - Windows: `release/*.exe`
   - macOS: `release/*.dmg`
5. For tag builds, review the draft GitHub Release notes before publishing.

## Known Signing Limit

The project still does not perform Apple notarization or Windows code signing. Public release notes should mention that early builds may show operating-system security warnings.
