# Afterspin

A browser-first listening recap studio. **A week, a season, a year.** Explore the music you kept coming back to, then turn it into a five-chapter story.

**Live site:** [Afterspin on GitHub Pages](https://johnbarsisa.github.io/afterspin/)

## Try it

1. Open the site. Use both demo sources and switch between 7 days, 1 month, 2 months, 3 months, 1 year or a custom date range.
2. Select **Play my recap**. Use the arrows, chapter markers or touch swipe. Download any chapter as a 1080 × 1350 PNG.
3. For your own stats, select **Connect music**, pick a provider and import the unzipped export files. [Spotify sample](fixtures/spotify-history.json) · [Apple Music sample](fixtures/apple-history.csv).

### Actual data

- **Spotify:** In Spotify’s [privacy settings](https://www.spotify.com/account/privacy/), request Extended Streaming History. Unzip the download and select its audio history JSON files. Spotify account sign-in is not enabled.
- **Apple Music:** In [Apple Data & Privacy](https://privacy.apple.com/), request Apple Media Services information. Extract the archive, then select the individual **Play Activity.csv** files or the **Play History Daily Tracks.csv** files, never both together. The daily file usually contains artist names when event rows omit them. A normalized CSV with `Played At,Track,Artist,ms_played` also works.
- **Apple live Replay:** Optional MusicKit adapter for Apple’s latest eligible Replay year. It is off in the public version until a legitimate Apple developer token endpoint is configured. It is independent of custom-range imports and has not been verified against a real subscribed Apple account.
- **YouTube:** No live listening connection in this release. Public Recap video references are in the app’s Inspiration section.

No server receives imported files. Afterspin parses them in memory for the current tab, doesn't use analytics and doesn't write history to local storage. Opening an external inspiration or privacy link takes you to its provider. If configured, Apple sign-in connects directly to MusicKit and Apple Music’s API. For Apple event exports without artist names, those tracks still count but their artists are not guessed. Daily exports use the file’s calendar dates. Other event times are grouped into days in the browser’s local timezone. Rankings are based on reported plays, with known time as a tiebreaker. Listening time uses only available reported durations.

## Local development

There are no runtime package dependencies for the public demo or import experience.

```bash
python3 -m http.server 5190
# http://127.0.0.1:5190/
node --test tests/core.test.cjs
```

For browser tests, start the local server, install Playwright `npm install --no-save playwright`, then run `CHROMIUM_PATH=/path/to/chromium node tests/browser.cjs`. Optionally set `AFTERSPIN_URL` to point at a deployed copy. The rendering source for the original 3D ribbon is included in [assets](assets/make-ribbon.py). See the [logo studies](assets/brand-studies.svg) or the [research, architecture and deployment notes](docs/product-notes.md).

## Pages publishing

In the repository’s **Settings → Pages**, select **Deploy from a branch**, use `main` and `/ (root)`, and save. Assets and scripts use relative paths to support a GitHub Pages project subpath. The site root is static and contains no private credentials.
