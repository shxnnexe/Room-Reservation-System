# Room Reservation System

Group 14

## Backend

The Express API stores users, rooms, and reservations in SQLite.

`GET /api/rooms` returns an array of rooms (including `id`, `name`, `room_name`, `room_number`, `capacity`, `description`, `location`, and `availability_status`). Pass `?q=term` to search room names and room numbers; an empty result is returned as `[]`. `POST /api/rooms` creates a room and requires a valid bearer token; provide non-empty `room_name`, `room_number`, and `description`, a positive integer `capacity`, and an optional `availability_status` of `available` or `unavailable`.

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

The frontend is a static HTML/CSS/JavaScript application in the repository root. Start the included frontend server with `node frontend-server.js` while the backend is running on `http://127.0.0.1:3000`. It serves the frontend on port `4173` and proxies `/api/*` requests to the backend. The frontend uses these endpoints:

- `GET /api/rooms`
- `POST /api/users/login`
- `GET /api/reservations`
- `POST /api/reservations`
- `DELETE /api/reservations/:id`
