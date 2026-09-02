# GitHub CLI Authorization

## Local (interactive)
```bash
gh auth login
gh auth status
```

## Local or CI (token-based)
1. Create a token with repository permissions required for your operation.
2. Export it as `GH_TOKEN`.

```bash
export GH_TOKEN=<token>
gh auth status
gh api user
```

## CI workflow usage
Set `GH_TOKEN` in workflow jobs:

```yaml
env:
  GH_TOKEN: ${{ github.token }}
```

If job actions need broader permissions than `github.token`, use a repository secret:

```yaml
env:
  GH_TOKEN: ${{ secrets.YOUR_PAT_SECRET }}
```

## Repository auth check helper
Run:

```bash
npm run gh:auth:check
```

The helper validates current `gh` login and falls back to `GH_TOKEN` checks.
