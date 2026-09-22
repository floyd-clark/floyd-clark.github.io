# Google approval service

This Apps Script provides the owner-controlled approval loop for the Signal Intelligence review page.

1. Create a standalone Google Apps Script project under `floyd.clark.usma@gmail.com`.
2. Replace the starter file with `Code.gs`.
3. Deploy as a web app, executing as the owner and allowing anyone to invoke it.
4. Replace `__APPROVAL_SERVICE_URL__` in `../app.js` with the `/exec` deployment URL.
5. Redeploy the web app after Apps Script code changes, then validate the full request → email → decision → unlock loop.

The script creates a private Google Sheet named **Signal Intelligence Access Approvals** on the first request. Decision links open a confirmation page; email security scanners cannot approve a request merely by prefetching the link.
