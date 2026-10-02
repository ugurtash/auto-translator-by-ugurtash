# Auto-Translator by UgurTash - Privacy Policy Draft

Auto-Translator by UgurTash translates text that the user explicitly hovers over or selects for translation.

The extension does not intentionally collect browsing history, page URLs, account passwords, form data, or payment information.

For translation, the selected text may be transmitted to the configured translation service. Translation content is used only to provide the requested translation and is not used by the extension for advertising or profiling.

Target-language preference and local usage counters are stored in Chrome extension storage.

If a paid version is introduced, payment processing will be handled by the selected payment provider. The extension will not store card numbers or other payment credentials.

Before Chrome Web Store publication, this draft must be replaced by a public privacy-policy URL that accurately reflects the final backend, translation provider, authentication, analytics, and payment architecture.

## Founder account access (version 1.2.2)

Optional founder sign-in sends the supplied email and password over HTTPS through the Auto-Translator Supabase function to Supabase Auth. The extension does not save passwords. Access and refresh tokens are saved in trusted extension storage so the founder can remain signed in; website content scripts cannot read that storage. Founder translation text is sent through the project's Supabase function to Google's translation endpoint. Account identity is checked server-side on each request. The function does not intentionally log passwords, session tokens or translation text. Supabase may retain authentication and operational logs according to its service settings. Signing out removes the stored extension session and requests server sign-out.
