# TODO - Laguna Hills HOA System

## Completed (2026-02-09)

- [x] GeoJSON loading fix (dynamic origin for fetch)
- [x] Secure CORS configuration
- [x] Google OAuth feature merged to main
- [x] Whitelist management endpoints added to production
- [x] Pre-approved emails database table created
- [x] Local households data synced to production (910 records)
- [x] CORS bug fixed (origin function cannot access context)
- [x] Global bug logging configured

---

## To Complete

### Google OAuth Sign-In

**Status:** Code merged, needs credentials

1. **Create Google OAuth credentials**
   - Go to https://console.cloud.google.com/
   - Create OAuth 2.0 Client ID
   - Add authorized redirect: `https://lhs-hoa.pages.dev/api/auth/google/callback`

2. **Set production secrets**
   ```bash
   npx wrangler pages secret put GOOGLE_CLIENT_ID --project-name=lhs-hoa
   npx wrangler pages secret put GOOGLE_CLIENT_SECRET --project-name=lhs-hoa
   ```

3. **Test the flow**
   - Add emails via https://lhs-hoa.pages.dev/admin/whitelist
   - Try "Sign in with Google" button

---

## Production URLs

| Service | URL |
|---------|-----|
| Production | https://lhs-hoa.pages.dev |
| Admin | https://lhs-hoa.pages.dev/admin |
| Whitelist | https://lhs-hoa.pages.dev/admin/whitelist |
| Map | https://lhs-hoa.pages.dev/map |

---

## Database Info

- **D1 Database:** `laguna_hills_hoa`
- **Households:** 910 records synced
- **Tables:** 20 (including `pre_approved_emails`)

---

## Custom Domain

When you get a custom domain, update these files:

1. **wrangler.jsonc** - Add `GOOGLE_REDIRECT_URI` with new domain
2. **functions/_middleware.ts** - Add domain to CORS allowlist

---

## Git Worktree Cleanup

The `.worktrees/feature-google-oauth` directory can be removed after verifying Google OAuth works:
```bash
git worktree remove --force .worktrees/feature-google-oauth
git branch -d feature/google-oauth
```

---

## Bug Memory

Location: `.bug-memory/solutions.md`

Recent bugs logged:
- Google OAuth routes missing in production (worker/ vs functions/)
- CORS origin function cannot access context `c`
