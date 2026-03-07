# NIP-56

Helpers for `kind:1984` report events.

Primary exports:

- `REPORT_KIND`
- `REPORT_TYPES`
- `createReportEvent`
- `getReportTargets`
- `parseReportEvent`

`createReportEvent` accepts typed targets for profile reports, event reports,
and blob reports. `parseReportEvent` extracts reported targets, `server` tags,
and optional `l` / `L` labels for moderation pipelines.
