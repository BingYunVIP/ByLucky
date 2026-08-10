# ByLucky Logs

- `development/`: `npm run dev` and `npm run worker:dev` output.
- `production/`: the Web server and Worker started by `bash deploy.sh`.
- `legacy/`: log files migrated from the project root during the logging cleanup.

Runtime log files are intentionally ignored by Git. Process ID files remain in
`.bylucky-runtime/`, so runtime control data and human-readable logs stay separate.
