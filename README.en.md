# DDYS macOS

DDYS macOS is the official macOS desktop ecosystem package for the DDYS API. It is designed for Mac users who want a persistent desktop workspace for discovery, search, calendars, watchlists, subscriptions, diagnostics, and local data management.

## Features

- macOS workspace with discovery, search, calendar, library, subscriptions, and settings.
- Discovery view for latest updates, hot items, and recommended collections.
- Search view with keyword and type filters.
- Detail inspector with movie metadata, online resources, download resources, related items, and local notes.
- Local library for favorites, watch later, history, and notes.
- Keyword subscriptions with macOS notification support.
- Settings for API base URL, site base URL, optional API key, cache TTL, refresh interval, notifications, theme, and link behavior.
- JSON import and export for local data.
- Diagnostics for API connectivity, latency, sample responses, and local counts.
- Tauri v2 macOS shell with WKWebView, menu bar tray, notification permissions, external link support, `.app`, and `.dmg` targets.

## Usage

Download the suitable asset from GitHub Releases. If a `.dmg` is available, open it and drag `DDYS macOS.app` to Applications. If you download the source package, build it on macOS with the official Tauri workflow.

Default endpoints:

- API Base: `https://ddys.io/api/v1`
- Site Base: `https://ddys.io`

Public read endpoints do not require an API key. Fill the API Key field only when your API Base requires authentication or when you connect authenticated DDYS API capabilities.

## Privacy

DDYS macOS does not include an account system. Favorites, watch later items, history, notes, subscriptions, settings, and cache are stored on the current Mac. The app only calls the configured DDYS API / site when the user searches, refreshes, checks subscriptions, runs diagnostics, or opens content. If an API key is configured, requests include it as an `Authorization: Bearer` header.

See [PRIVACY.md](./PRIVACY.md).
