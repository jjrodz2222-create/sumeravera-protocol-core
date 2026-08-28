# Known Limits

1. Default secrets in `.env.example` are placeholders and unsafe for real production without rotation.
2. Current frontend bundle warning indicates large client payload size; code-splitting improvements are pending.
3. Some protocol outcomes depend on local Python engine execution and file-backed state paths.
4. Settlement durability relies on correct filesystem permissions and persistent volume mapping.
5. Load/soak checks are synthetic and should be complemented by environment-specific performance tests.
