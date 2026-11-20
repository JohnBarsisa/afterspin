# Afterspin

A browser-first listening recap studio. **A week, a season, a year.** Explore the music you kept coming back to, then turn it into a five-chapter story.

**Live site:** [Afterspin on GitHub Pages](https://johnbarsisa.github.io/afterspin/)

**If GitHub Pages won't open:** Open [Afterspin-Offline.html on GitHub](https://github.com/JohnBarsisa/afterspin/blob/main/Afterspin-Offline.html), use **Download raw file**, then open the downloaded HTML in your desktop browser. It includes the animations, history imports and PNG export without needing a connection. Optional account integrations are disabled in this copy.

**Get everything:** [Download the repository as a ZIP](https://github.com/JohnBarsisa/afterspin/archive/refs/heads/main.zip).

## Try it

1. Open the site. Choose a music provider and import your listening history. Then switch between 7 days, 1 month, 2 months, 3 months, 1 year or a custom date range.
2. Select **Play my recap**. Use the arrows, chapter markers or touch swipe. Download any chapter as a 1080 × 1350 PNG.
3. For your own stats, select **Connect music**, pick a provider and import the unzipped export files. [Spotify sample](fixtures/spotify-history.json) · [Apple Music sample](fixtures/apple-history.csv).

### Actual data

- **Spotify:** In Spotify’s [privacy settings](https://www.spotify.com/account/privacy/), request Extended Streaming History. Unzip the download and select its audio history JSON files. Spotify account sign-in is not enabled.
- **Apple Music:** In [Apple Data & Privacy](https://privacy.apple.com/), request Apple Media Services information. Extract the archive, then select the individual **Play Activity.csv** files or the **Play History Daily Tracks.csv** files, never both together. The daily file usually contains artist names when event rows omit them. A normalized CSV with `Played At,Track,Artist,ms_played` also works.
- **Apple live Replay:** Optional MusicKit adapter for Apple’s latest eligible Replay year. It is off in the public version until a legitimate Apple developer token endpoint is configured. It is independent of custom-range imports and has not been verified against a real subscribed Apple account.
- **YouTube:** No live listening connection in this release. Public Recap video references are in the app’s Inspiration section.

No server receives imported files. Afterspin parses them in memory for the current tab, doesn't use analytics and doesn't write history to local storage. Opening an external inspiration or privacy link takes you to its provider. If configured, Apple sign-in connects directly to MusicKit and Apple Music’s API. For Apple event exports without artist names, those tracks still count but their artists are not guessed. Daily exports use the file’s calendar dates. Other event times are grouped into days in the browser’s local timezone. Rankings are based on reported plays, with known time as a tiebreaker. Listening time uses only available reported durations.

## Local development

There are no runtime package dependencies for the public homepage or import experience.

```bash
python3 -m http.server 5190
# http://127.0.0.1:5190/
python3 scripts/build-sites-worker.py
node --test tests/core.test.cjs tests/apple-token.test.mjs tests/public-home.test.cjs tests/spotify-beta.test.mjs
```

For browser tests, start the local server, install Playwright `npm install --no-save playwright`, then run `CHROMIUM_PATH=/path/to/chromium node tests/browser.cjs`. Optionally set `AFTERSPIN_URL` to point at a deployed copy. The rendering source for the original 3D ribbon is included in [assets](assets/make-ribbon.py). See the [logo studies](assets/brand-studies.svg) or the [research, architecture and deployment notes](docs/product-notes.md).

Regenerate the standalone version after changing the app with `python3 scripts/build-offline.py`.

## Pages publishing

In the repository’s **Settings → Pages**, select **Deploy from a branch**, use `main` and `/ (root)`, and save. Assets and scripts use relative paths to support a GitHub Pages project subpath. The site root is static and contains no private credentials.

## Public homepage and account access

The public homepage has Spotify and Apple Music provider choices, light and dark modes, and five palettes. There are no sample stats on the homepage or in the recap. Recaps appear only after real history is imported or Apple Replay is returned. The appearance preference stays on the visitor’s device.

**Spotify:** The provider button opens the invite-only Top Picks beta and offers a local history import. See the setup below. [Spotify’s Developer Policy](https://developer.spotify.com/policy) restricts using the platform to create derived listening metrics.

**Apple Music:** Without developer setup, the provider button links to Apple’s official Replay and offers a local history import. The built-in authorization flow is ready for configuration and uses only Apple’s own MusicKit sign-in screen. Afterspin requests the latest eligible annual Replay, not arbitrary custom date ranges through Apple.

To enable Apple Music authorization:

1. In [Apple Developer](https://developer.apple.com/help/account/capabilities/create-a-media-identifier-and-private-key/), create a Media ID and a MusicKit key. Keep the Team ID, Key ID and the downloaded private key out of the public repository.
2. Deploy the optional Worker in `server/apple-token-worker.mjs`, or an equivalent HTTPS token issuer. Configure `APPLE_MUSIC_TEAM_ID`, `APPLE_MUSIC_KEY_ID` and `AFTERSPIN_ORIGINS` as Worker environment variables, and `APPLE_MUSIC_PRIVATE_KEY` as a secret. Set `AFTERSPIN_ORIGINS` to the comma-separated exact origins of the live sites, excluding paths and trailing slashes. The Worker returns short-lived, origin-bound ES256 tokens at `/api/apple-token`.
3. Set `appleTokenEndpoint` in `config.js` to the issuer’s HTTPS URL and redeploy. Verify with an eligible Apple Music subscriber on both mobile and desktop. Test cancellation and an account with no Replay history as well.

No provider credentials or token issuer are provisioned in this repository. GitHub Pages serves static files and is not the place to store signing secrets.

### Spotify Top Picks invite-only beta

[Visit the hosted beta](https://afterspin-listening.jpiyady.chatgpt.site/spotify-top-picks.html). The public home and local history import remain usable without participating. The beta reads Spotify's own Top Items endpoint and shows tracks and artists with window labels of roughly 4 weeks, 6 months or 1 year. It does not calculate plays, minutes, genres, trends, or new scores from Spotify API data. Metadata links back to Spotify. Exact recap ranges are still available through your listening-history export.

To activate the beta:

1. Create an Afterspin application in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and select Web API when prompted. Register this exact HTTPS redirect URI: `https://afterspin-listening.jpiyady.chatgpt.site/oauth/spotify/callback`.
2. Add the tester accounts in **Users Management**. Spotify requires a Premium app owner and currently permits up to five designated users in Development Mode. Do not publish the beta as open public sign-in.
3. Set `SPOTIFY_CLIENT_ID` to the non-secret application Client ID and set the secret `SPOTIFY_SESSION_KEY` to a unique random 32-byte key represented as 64 hexadecimal characters. The backend uses Authorization Code with PKCE so it does not need a Spotify Client Secret. Never paste a Client Secret into browser code, GitHub, or chat.
4. Run an end-to-end check using an allowlisted Spotify account. The only permission requested is `user-top-read`. The short-lived access token is encrypted in a Secure, HttpOnly cookie, the provider's refresh token is discarded, and the session expires within an hour. Disconnecting clears the session from the browser.

The same-origin Worker is built using `python3 scripts/build-sites-worker.py`. GitHub Pages remains a static mirror and links to the hosted beta rather than trying to run OAuth itself. The beta routes are tested with simulated Spotify API responses until real credentials are configured.
