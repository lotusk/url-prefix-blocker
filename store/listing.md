# Chrome Web Store listing

Copy these into the developer dashboard when you submit.

## Package

Upload `dist/url-prefix-blocker-<version>.zip` from `npm run pack`.

## Store listing tab

**Name:** URL Prefix Blocker (comes from `manifest.json`)

**Summary:** comes from `description` in `manifest.json`.

**Description:**

```
Block pages whose URL starts with a prefix you choose.

The default list blocks YouTube Shorts (youtube.com/shorts) and leaves the rest of YouTube alone. Normal videos, search and subscriptions keep working.

How to use
- Click the extension icon.
- Put one prefix per line, then click Save.
- youtube.com/shorts blocks Shorts on www., m. and every other YouTube subdomain.
- A domain alone, like reddit.com, blocks the whole site.

It also catches pages opened from inside a site. Clicking a Short on the YouTube home page is blocked, not just typing the link.

Privacy
- Your list is saved in your browser and synced by Chrome if you use Chrome sync.
- URLs are checked on your computer and never sent anywhere.
- No analytics, no tracking, no ads.

Open source: https://github.com/lotusk/url-prefix-blocker
```

**Category:** Productivity. Pick the closest sub-category the dashboard offers (for example Tools).

**Language:** English

**Graphic assets:**

| Field | File |
|---|---|
| Store icon (128x128) | `extension/icons/icon-128.png` |
| Screenshots (1280x800) | `store/screenshot-1.png`, `store/screenshot-2.png` |
| Small promo tile (440x280) | `store/promo-small.png` |
| Marquee promo tile | Optional, skip |

**Homepage URL:** https://github.com/lotusk/url-prefix-blocker

**Support URL:** https://github.com/lotusk/url-prefix-blocker/issues

## Privacy practices tab

**Single purpose:**

```
Block web pages whose URL starts with a prefix from a list the user writes, for example youtube.com/shorts.
```

**Permission justification:**

| Permission | Text |
|---|---|
| `storage` | Saves the user's list of blocked URL prefixes. |
| `webNavigation` | Checks the URL of each page the user opens, before it loads, so a blocked page can be stopped early. |
| `tabs` | Reads the tab URL when a site changes pages without a full reload (for example YouTube moving to a Short), and sends the tab to the extension's "blocked" page. |

**Remote code:** No, I am not using remote code.

**Data usage:** Leave every data type unchecked. The extension does not collect or send any user data.
Tick the three certification boxes (no selling data, no unrelated use, no credit checks).

**Privacy policy URL:** https://github.com/lotusk/url-prefix-blocker/blob/main/PRIVACY.md

## Distribution tab

**Visibility:** Public

**Regions:** All regions
