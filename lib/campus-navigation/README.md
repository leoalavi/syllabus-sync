# Campus Navigation integration

Hands a navigation request from Syllabus Sync (web) to the **Campus Navigation**
Android/iOS app, or offers the store listings when it is not installed.

Campus Navigation has **no web build**, so nothing here ever falls back to a
browser destination.

| File | Role |
|---|---|
| `config.ts` | Store URLs + deep-link transport constants. **The only place a store URL is defined.** |
| `deep-link.ts` | Canonical `/open` link construction. The only place a navigation URL is built. |
| `platform.ts` | iOS / Android / desktop detection — used only to order the store buttons. |
| `handoff.ts` | Attempts the app, detects failure, reports `opened` / `not-installed` / `unsupported-platform`. |

The payload shape is owned by Campus Navigation. See
`MQ_Navigation/docs/SYLLABUS_SYNC_INTEGRATION.md` and
`MQ_Navigation/lib/features/deep_link/deep_link_contract.dart`.

## Enabling the iOS download

`CAMPUS_NAV_IOS_STORE_URL` is `null` until the App Store listing exists; the iOS
button is disabled and labelled "coming soon". To enable it, set:

```
NEXT_PUBLIC_CAMPUS_NAV_IOS_STORE_URL=https://apps.apple.com/app/id<APP_ID>
```

No other file needs to change.
