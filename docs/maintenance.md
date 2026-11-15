# Maintenance notes

## How blocking works

`background.js` listens to two events and checks every URL with `isBlocked()` from `match.js`.

- `webNavigation.onBeforeNavigate` catches normal page loads (typing a URL, opening a link).
- `tabs.onUpdated` catches URL changes that never start a new page load.
  YouTube is a single page app. Clicking a Short only calls `history.pushState`, so the first event never fires for it.

When a URL matches, the tab is sent to `blocked.html?url=<original url>`.

Only the top frame is checked (`frameId === 0`), and prerendered pages are skipped.

## Prefix rules

A prefix is split into host and path at the first `/`.

- Host matches if it is equal to the prefix host or ends with `.` + prefix host.
  So `youtube.com` matches `m.youtube.com` but not `notyoutube.com`.
- Path matches with `startsWith` on `pathname + search`, all lowercased.
- Only `http` and `https` URLs are checked. `chrome://` and extension pages are never blocked.

The popup runs `normalizePrefix()` on save, so stored values are always lowercase, without scheme, `www.` or trailing `/`.

## Storage

The list is saved in `chrome.storage.sync` under the key `prefixes`.
It follows the user's Chrome sign-in, so a signed-in user gets the same list on every computer.
If nothing is saved yet, `DEFAULT_PREFIXES` in `match.js` is used.

## Permissions

| Permission | Why |
|---|---|
| `storage` | Save the prefix list |
| `webNavigation` | See page loads before they finish |
| `tabs` | Read tab URLs and redirect the tab |

No host permissions and no content scripts. The extension never reads page content.

## Testing

`npm test` runs the unit tests in `tests/match.test.js`. Add a case there for every rule change.

`npm run test:e2e` starts a headless Chrome with a temporary profile, loads `extension/`, and checks:

- direct Shorts URLs are blocked (`www.` and `m.`)
- the home page and a normal watch page are not blocked
- clicking a Short on the home page is blocked
- a `pushState` to `/shorts/...` is blocked
- saving a new list in the popup works and takes effect

Chrome is driven by `scripts/lib/chrome.mjs`. It uses the `--remote-debugging-pipe` and
`--enable-unsafe-extension-debugging` flags, because recent Chrome versions ignore `--load-extension`.
The temporary profile is deleted at the end. Set `CHROME_PATH` if Chrome is not in `/Applications`.

The test depends on the live YouTube site. If the click test prints `SKIP`, YouTube changed its markup and the selector in `e2e.mjs` needs an update.

## Icons and store images

`npm run assets` redraws everything from `store/src/`:

- `extension/icons/icon-{16,32,48,128}.png` from `icon.svg`. The 128px icon keeps 16px of empty space around the artwork, as Chrome asks.
- `store/screenshot-1.png` and `store/screenshot-2.png` (1280x800). They use real captures of the popup and the blocked page, so run this again after changing those pages.
- `store/promo-small.png` (440x280).

To change the look, edit the files in `store/src/` and run the command again. Do not put the YouTube logo in any image.

## Release

1. Bump `version` in `extension/manifest.json` and `package.json`.
2. Run `npm test` and `npm run test:e2e`.
3. If the popup or blocked page changed, run `npm run assets`.
4. Run `npm run pack`.
5. Chrome Web Store: open the item in the developer dashboard, go to **Package**, upload the new zip, and submit for review.
   Text for the listing and the privacy tab is in `store/listing.md`.
6. Create a GitHub release and attach the same zip.

Users who installed from the store get the update by themselves after review.
Users with the unpacked version have to replace the folder and click reload in `chrome://extensions`.
