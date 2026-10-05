# Room Reservation System

Group 14

## Backend

The Express API stores users and reservations in SQLite. The current room inventory is provided by the room controller.

### Reservation API

All reservation routes require a bearer token from `POST /api/users/register` or `POST /api/users/login`.

- `GET /api/reservations` returns the authenticated user's reservations.
- `POST /api/reservations` accepts `roomId`, `startDate`, and `endDate`; dates must be valid and `endDate` must be later than `startDate`.
- `DELETE /api/reservations/:id` cancels the authenticated user's active reservation.

Active overlapping reservations for the same room are rejected with `409 Conflict`. Adjacent reservations are allowed, and a cancelled time slot can be booked again. Responses expose the camelCase reservation fields consumed by the frontend; the previous snake_case create response remains available for compatibility.

### Run locally
```bash
npm install
npm start
```

Set `DB_PATH` to use a non-default SQLite database file and `JWT_SECRET` to configure token signing.
