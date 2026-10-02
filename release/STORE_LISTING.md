# Chrome Web Store listing draft

Name: Auto-Translator by UgurTash

Short description: Translate selected text instantly while browsing.

Single purpose: Translate text that the user selects on webpages into a chosen target language, with automatic source-language detection.

Description:
Select text on a webpage and translate it into your preferred language without leaving the page. Auto-Translator detects the source language automatically. Choose your target language from the extension settings and turn translation on or off whenever you need it.

The free plan includes 500 translated words per day per browser installation. Premium removes that daily word quota for €3.99 per month; applicable taxes appear at checkout. Create and verify your account, then subscribe from the signed-in account. Sign in to the same account on another computer to restore Premium access. Translation service availability and per-request limits still apply.

Permission justifications:
- storage: save the target language, translation toggle, daily usage counter and optional trusted account session. Passwords are not saved.
- translate.googleapis.com: send the selected text and target language to the translation provider and read the result.
- cxxbcamghmyttgqikfak.supabase.co: register and authenticate accounts and verify subscription access.
- content scripts on webpages: detect the user's text selection and display translations on the page where the user is reading.

Remote code: No. All executable extension JavaScript ships in the package; remote services return translation and account data.

Data disclosures to review in the dashboard: personally identifiable information (account email), authentication information (password submission/session tokens), website content (selected text), and subscription/transaction information. Card details stay with Lemon Squeezy. No sale of user data, advertising profiling, or browsing-history collection.

Privacy URL after the revised policy deploys:
https://ugurtash.github.io/auto-translator-by-ugurtash/privacy.html

Contact: ugurtash11@gmail.com

Before submission: attach actual product screenshots, confirm the final package version, verify the revised privacy page is live, complete the normal-user test purchase and access recovery, and review the listing/disclosures in the store dashboard. Replace the landing-page Coming soon label with the real listing URL after publication.

Official guidance:
https://developer.chrome.com/docs/webstore/cws-dashboard-privacy/
https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements/
