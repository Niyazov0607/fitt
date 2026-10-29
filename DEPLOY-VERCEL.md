# Deploy FitPulse to Vercel

FitPulse is a static HTML/CSS/JavaScript app. Its production website does not need a Node server or a Vercel Function. `server.cjs` and `npm start` are for local previews.

The included `vercel.json` selects the **Other** framework preset, runs `node build.cjs`, and serves **dist**. No catch-all rewrite is needed: tracker routes use URL fragments and the public nutrition page is `nutrition.html`.

1. Extract the ZIP and upload the actual project files to your Git repository. Do not upload only the ZIP file.
2. Import that repository into Vercel, or update your existing project's source repository.
3. Set **Root Directory** to the folder containing `package.json`, `build.cjs`, and `vercel.json`. If those files are inside a `FitPulse` subfolder in your repository, choose `FitPulse`; if they are at the repository root, leave Root Directory empty.
4. Confirm these build settings:

   | Setting | Value |
   | --- | --- |
   | Framework Preset | Other |
   | Build Command | `node build.cjs` |
   | Output Directory | `dist` |
   | Install Command | Default |

5. Deploy the updated source. For an existing failed deployment, deploy the new commit; do not just redeploy the old commit. If you have changed cached framework settings, uncheck the build-cache option for that redeployment.
6. The build log should show `Built FitPulse in dist/`. Confirm the homepage, `/nutrition.html`, and an image under `/assets/` open successfully.

## Why the old deployment returned 500

The reported URL showed `500 FUNCTION_INVOCATION_FAILED`, which confirms a Vercel Function was failing. This static app should be served from its build output instead. The explicit configuration prevents framework auto-detection from choosing a server deployment. The exact old function exception is only available in the project's authenticated Vercel Runtime Logs.

## Browser accounts

Accounts and fitness records are saved in browser storage for each website origin. An account created on localhost does not automatically exist on your Vercel domain. Create a local demo account on the deployed site, then use the tracker backup import to bring over exported fitness records if desired. This project has no cloud authentication backend.

Official references: [Vercel build settings](https://vercel.com/docs/builds/configure-a-build), [vercel.json configuration](https://vercel.com/docs/project-configuration/vercel-json), and [FUNCTION_INVOCATION_FAILED](https://vercel.com/docs/errors/function_invocation_failed).
