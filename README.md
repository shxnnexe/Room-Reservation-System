# Room-Reservation-System
Group 14

## Frontend

The frontend is a static HTML/CSS/JavaScript application in the repository root. Start the included frontend server with `node frontend-server.js` while the backend is running on `http://127.0.0.1:3000`. It serves the frontend on port `4173` and proxies `/api/*` requests to the backend, so the browser does not require cross-origin API access. Set `ROOM_API_ORIGIN` to change the backend origin and `FRONTEND_PORT` to change the frontend port. Do not open `index.html` directly as a `file://` URL.

The API base defaults to `/api`. Use the **Backend API** field to configure a different API base URL when needed; a separately hosted API must allow the frontend origin through CORS.

The frontend uses these endpoints:

- `GET /api/rooms`
- `POST /api/users/login`
- `GET /api/reservations`
- `POST /api/reservations`
- `DELETE /api/reservations/:id`

Sign-in is required for reservation operations. The access token remains in memory for the current page session and is not persisted in browser storage. The frontend expects the API responses to return a `data` property or the resource directly, and displays API errors to the user.
