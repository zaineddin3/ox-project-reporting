# Sign In and Out — Android app

A small Android app that opens the live Sign In and Out web app full-screen
(https://zaineddin3.github.io/ox-project-reporting/sign-in-out/), with camera and GPS
permission, screen kept awake, and files saved to Downloads. Because it loads the live app,
web app updates reach tablets automatically; the app keeps working offline after its first launch.

GitHub builds it automatically (`.github/workflows/sign-in-out-android.yml`) whenever this folder
changes, and puts the result at `downloads/Sign-In-and-Out.apk`:
https://zaineddin3.github.io/ox-project-reporting/downloads/Sign-In-and-Out.apk

If a build fails, the error is saved to `last-build-error.txt` here.
