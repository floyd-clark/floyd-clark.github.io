# Page-open email alerts

The public page is static. This separate, owner-operated Google Apps Script web app sends one email per successful page-open request to the fixed recipient in `Code.gs`. It does **not** identify visitors, enforce access, or alert on requests blocked by browsers, extensions, connectivity, or mail quotas. Reloads and non-human browser loads can generate alerts. The public endpoint can be forged; its page parameter is only a filter, not authentication.

1. In the owner's Google account, create a standalone Apps Script project named `Signal Intelligence Visitor Alerts`. Paste `Code.gs` into its editor. Keep this project separate from the previous approval service. In Project Settings → Script properties add `ALERT_EMAIL` with the owner's desired private recipient address; never commit its value.
2. Deploy → New deployment → Web app. Execute as **Me**; access **Anyone**. Authorize only the mail scope requested by this project. Copy its `/exec` URL.
3. Set `VISIT_ALERT_URL` in `../visit-alert.js` to that URL, then publish `../index.html` with `<script src="visit-alert.js?v=1" defer></script>` in the head.
4. Open the live page once in a fresh browser tab and check the recipient inbox for `Signal Intelligence page opened`. An email is the delivery test; an opaque browser request alone is not proof of delivery.

Do not put a Google password, OAuth token, spreadsheet ID, or secret in GitHub Pages. The web app URL is public by design. If you require actual authorization before viewing private data, host that private layer behind server-side authentication; this alert is not a gate.
