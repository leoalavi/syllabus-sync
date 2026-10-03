# Translation fallback policy

English is the reviewed source locale. Other locale files may omit keys while translations await review. At load time, the application merges the selected locale over English, so missing keys show English text rather than a raw key name or an empty label. Existing localized values remain in use.

The current gap is 12 campus and Sylla keys in each of 34 non-English locales. `npm run check:i18n` reports these gaps without blocking unrelated code changes. A contributor should translate them only with language review and check long text and right-to-left layouts in a browser. The fallback test covers both a missing key and an existing Persian value.

The fallback is a continuity measure, not a claim that all 35 locales are fully translated. To add or revise translations, edit the relevant `locales/<language>/translations.json`, run `npm run check:i18n`, and test the affected screen at desktop and mobile widths.
