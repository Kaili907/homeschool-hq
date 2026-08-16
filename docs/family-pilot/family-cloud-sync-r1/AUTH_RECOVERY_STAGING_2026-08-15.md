# Family Cloud auth recovery — staging-only configuration

Scope: Supabase project `fqzcxrkvpaivpnzdbuol` and Netlify alias
`family-pilot-cloud-r1` only. Production must not be changed.

## Supabase Auth URL configuration required

In Supabase Dashboard → Authentication → URL Configuration for project
`fqzcxrkvpaivpnzdbuol`, retain the staging Site URL and allow these exact
redirect URLs:

- Site URL: `https://family-pilot-cloud-r1--manuel-academy.netlify.app`
- Redirect URL: `https://family-pilot-cloud-r1--manuel-academy.netlify.app`
- Redirect URL: `https://family-pilot-cloud-r1--manuel-academy.netlify.app/family-pilot`
- Redirect URL: `https://family-pilot-cloud-r1--manuel-academy.netlify.app/family-pilot/reset-password`

The application supplies `/family-pilot/reset-password` explicitly to
`resetPasswordForEmail`. Account confirmation and magic-link requests supply
`/family-pilot` explicitly. Both derive from the current application origin,
so local and other permitted non-production builds do not inherit a hard-coded
staging hostname.

The repository does not push broad Auth configuration because it cannot safely
read and merge Dashboard URL settings. Make only the staging Dashboard change
above; do not add or modify a production URL.

## Human verification

1. Open the staging `/family-pilot` route and choose **Forgot password?**.
2. Submit `srkmanuel@gmail.com`; do not share or record the password.
3. Follow the email link and confirm it lands at `/family-pilot/reset-password`.
4. Set the password. Confirm **Password updated** appears and Family Pilot opens.
5. Sign out, then sign in with `srkmanuel@gmail.com` and the privately held new
   password. Confirm Family Cloud resolves the authenticated household.
6. Request **Email me a sign-in link** and confirm the link returns directly to
   `/family-pilot` with the authenticated session recognized.

Expired or already-used reset links must show the invalid/expired message and
offer **Request another reset**.
