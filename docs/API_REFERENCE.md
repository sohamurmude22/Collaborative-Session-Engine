# API Reference

Base URL: `http://localhost:4000`

## Health

`GET /health`

Returns service status.

## List Sessions

`GET /api/sessions`

Returns available coding sessions.

## Get Session

`GET /api/sessions/:sessionId?role=interviewer`

Returns session files filtered by role.

Roles:

- `candidate`
- `interviewer`
- `proctor`

## Update File Access

`PATCH /api/sessions/:sessionId/files/:fileId/access`

Header:

```text
x-user-role: interviewer
```

Body:

```json
{
  "visibility": "visible",
  "locked": false
}
```

## Replay Events

`GET /api/sessions/:sessionId/replay?role=proctor`

Returns the audit timeline for interviewer and proctor roles.

## Socket Events

Client emits:

- `join-session`
- `file-change`

Server emits:

- `session-state`
- `file-updated`
- `access-updated`
- `audit-event`
- `edit-rejected`
