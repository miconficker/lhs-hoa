# Security Guide

## Critical Security Issues and Remediation

### 🚨 CRITICAL: Git History Contains Real Secrets

**Status:** The repository's git history contains REAL credentials that must be removed immediately.

**Exposed Secrets (in git history):**
- `JWT_SECRET` - Allows forging authentication tokens
- `GOOGLE_CLIENT_ID` - Can be used for OAuth abuse
- `GOOGLE_CLIENT_SECRET` - Can be used for OAuth abuse

**Affected Commits:**
- `7af6f54` - feat: add Admin Panel section header to sidebar
- `2b9b58a` - fix: use effective_date for historical rate accuracy in payment demands
- `1731c95` - feat: add Google OAuth authentication with email whitelist

## Immediate Actions Required

### 1. Rotate ALL Exposed Secrets (DO THIS NOW)

⚠️ **These secrets are now compromised. Anyone with access to the git repository has them.**

#### JWT Secret Rotation

Generate a new JWT secret:
```bash
openssl rand -base64 32
```

Update the new secret in:
- Local `.dev.vars` file
- Production environment variables (Cloudflare Workers dashboard)
- Any staging environments

#### Google OAuth Credentials Rotation

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Revoke the compromised OAuth 2.0 client ID
3. Create a new OAuth 2.0 client ID
4. Update credentials in:
   - Local `.dev.vars` file
   - Production environment variables
   - Google Cloud Console authorized redirect URIs

### 2. Clean Git History

After rotating secrets, remove them from git history using one of these methods:

#### Option A: Using BFG Repo-Cleaner (Faster)

```bash
# Install BFG
brew install bfg  # macOS
# or download from https://rtyley.github.io/bfg-repo-cleaner/

# Clean .dev.vars from history
bfg --delete-files .dev.vars

# Clean any references to the specific secrets
bfg --replace-text passwords.txt  # Create passwords.txt with the old secrets

# Final cleanup
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### Option B: Using git filter-branch (Built-in)

```bash
# Remove .dev.vars from all history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .dev.vars' \
  --prune-empty --tag-name-filter cat -- --all

# Clean up references
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

#### Option C: Using git-filter-repo (Recommended)

```bash
# Install git-filter-repo
pip install git-filter-repo

# Remove .dev.vars from history
git filter-repo --path .dev.vars --invert-paths

# Force push to all remotes (WARNING: This rewrites history)
git push origin --force --all
git push origin --force --tags
```

⚠️ **WARNING:** These methods rewrite git history. All collaborators will need to:
- Clone fresh copies of the repository
- Rebase any unpushed work
- Update their remote branches

### 3. Verify Cleanup

After cleaning git history, verify secrets are gone:

```bash
# Check if .dev.vars is in history
git log --all --full-history -- .dev.vars

# Search for specific secrets
git log -S "D3g/b9I7bREI8bAlhlh/jXqes4/h90fmwHMc9UMtNPQ=" --all
git log -S "487583822447-8c4cvkl7qlhfpouh32btusbjg3o5med0" --all
git log -S "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" --all

# Should return no results
```

## Prevention: Security Best Practices

### Environment Variable Management

✅ **DO:**
- Use `.dev.vars.example` template files
- Keep `.dev.vars` in `.gitignore`
- Run `npm run validate-env` before starting development
- Rotate secrets regularly
- Use different secrets for each environment
- Store production secrets in Cloudflare Workers environment variables

❌ **DO NOT:**
- Commit `.dev.vars` or `.env` files
- Use real secrets in example/template files
- Share secrets via email, chat, or issue trackers
- Reuse secrets across environments

### Pre-commit Hooks (Recommended)

Create `.git/hooks/pre-commit` to prevent future accidental commits:

```bash
#!/bin/bash
# Prevent committing secrets

# Check for .dev.vars in staging
if git diff --cached --name-only | grep -q "^\.dev\.vars$"; then
  echo "❌ ERROR: Attempting to commit .dev.vars file!"
  echo "This file contains secrets and should not be committed."
  exit 1
fi

# Check for common secret patterns
if git diff --cached --text | grep -E "(JWT_SECRET|GOOGLE_CLIENT_SECRET|SK_|api_key)" | grep -v "^+" | grep -E "^\+" | grep -v "example"; then
  echo "❌ WARNING: Possible secret in staged changes"
  echo "Please review and remove any real credentials."
  # exit 1  # Uncomment to enforce blocking
fi
```

Make it executable:
```bash
chmod +x .git/hooks/pre-commit
```

### Environment Variable Validation

Before starting development, validate your environment:

```bash
npm run validate-env
```

This checks:
- All required variables are set
- No placeholder values are being used
- Formats are correct (e.g., Google client ID structure)
- JWT secret is sufficiently long

### Secrets Management

**Development:**
- Use `.dev.vars` file (gitignored)
- Never commit real secrets
- Generate new secrets for each new setup

**Production:**
- Store secrets in Cloudflare Workers environment variables
- Use Cloudflare Workers Secrets for sensitive data
- Rotate secrets quarterly or after any suspected breach
- Use different secrets for staging and production

## Security Checklist

- [ ] All exposed secrets have been rotated
- [ ] Git history has been cleaned of secrets
- [ ] `.dev.vars` is in `.gitignore`
- [ ] `.dev.vars.example` template exists
- [ ] Pre-commit hooks are configured
- [ ] All collaborators have been notified of history rewrite
- [ ] Fresh repository clones have been made
- [ ] Environment validation passes (`npm run validate-env`)
- [ ] Production secrets are updated in Cloudflare dashboard
- [ ] Google OAuth credentials have been revoked and regenerated

## Additional Resources

- [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [OWASP Secret Scanning](https://owasp.org/www-community/Scanning_For_Secrets)
- [git-secrets](https://github.com/awslabs/git-secrets) - Prevents accidental secret commits
- [TruffleHog](https://trufflesecurity.com/trufflehog/) - Secret scanner for git history

## Reporting Security Issues

If you discover a security vulnerability, please:
1. Do NOT create a public issue
2. Email security@lagunahills.com (or appropriate contact)
3. Include details and reproduction steps
4. Allow time for remediation before disclosure
