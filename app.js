const API_BASE_URL = window.ROOM_API_BASE_URL || "/api";

const roomList = document.querySelector("#rooms-list");
const roomStatus = document.querySelector("#rooms-status");
const refreshButton = document.querySelector("#refresh-rooms");
const reservationRoom = document.querySelector("#reservation-room");
const loginPanel = document.querySelector("#sign-in-panel");
const loginForm = document.querySelector("#login-form");
const loginStatus = document.querySelector("#login-status");
const reservationPanel = document.querySelector("#reservation-panel");
const reservationForm = document.querySelector("#reservation-form");
const reservationStatus = document.querySelector("#reservation-status");
const reservationSubmit = document.querySelector("#reservation-submit");
const reservationsList = document.querySelector("#reservations-list");
const reservationsStatus = document.querySelector("#reservations-status");
const refreshReservationsButton = document.querySelector("#refresh-reservations");
let authToken = null;
let roomCatalog = [];

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw new Error(body.error?.message || `Request failed (${response.status})`);
  }

  return body.data ?? body;
}

function setStatus(element, message, isError = false) {
  element.textContent = message;
  element.classList.toggle("status-error", isError);
}

function renderRooms(rooms) {
  roomCatalog = rooms;
  roomList.replaceChildren();
  reservationRoom.replaceChildren(new Option("Choose a room", ""));

  for (const room of rooms) {
    const option = new Option(room.name || room.type || room.id, room.id);
    reservationRoom.append(option);
  }

  if (rooms.length === 0) {
    roomStatus.textContent = "No rooms are currently available.";
    return;
  }

  const cards = rooms.map((room) => {
    const card = document.createElement("article");
    card.className = "room-card";

    const heading = document.createElement("h3");
    heading.textContent = room.name || room.type || room.id;
    card.append(heading);

    const details = document.createElement("dl");
    const items = [
      ["Room ID", room.id],
      ["Capacity", room.capacity],
      ["Location", room.location || "Not specified"],
    ];

    for (const [label, value] of items) {
      if (value === undefined || value === null || value === "") {
        continue;
      }

      const term = document.createElement("dt");
      term.textContent = label;
      const description = document.createElement("dd");
      description.textContent = String(value);
      details.append(term, description);
    }

    card.append(details);
    return card;
  });

  roomList.append(...cards);
  roomStatus.textContent = `${rooms.length} ${rooms.length === 1 ? "room" : "rooms"} found.`;
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeZone: "UTC" }).format(date);
}

async function loadRooms() {
  refreshButton.disabled = true;
  setStatus(roomStatus, "Loading rooms...");

  try {
    const rooms = await apiRequest("/rooms");
    if (!Array.isArray(rooms)) {
      throw new Error("The rooms API returned an unexpected response.");
    }
    renderRooms(rooms);
  } catch (error) {
    roomList.replaceChildren();
    setStatus(roomStatus, error.message, true);
  } finally {
    refreshButton.disabled = false;
  }
}

function renderReservations(reservations) {
  reservationsList.replaceChildren();

  if (reservations.length === 0) {
    setStatus(reservationsStatus, "You do not have any reservations yet.");
    return;
  }

  const cards = reservations.map((reservation) => {
    const card = document.createElement("article");
    card.className = "reservation-card";

    const details = document.createElement("div");
    const room = roomCatalog.find((entry) => entry.id === reservation.roomId);
    const heading = document.createElement("h3");
    heading.textContent = room?.name || room?.type || `Room ${reservation.roomId}`;
    const dates = document.createElement("p");
    dates.textContent = `${formatDate(reservation.startDate)} - ${formatDate(reservation.endDate)}`;
    const status = document.createElement("span");
    status.className = "reservation-status";
    status.textContent = reservation.status || "active";
    details.append(heading, dates, status);
    card.append(details);

    if (String(reservation.status || "active").toLowerCase() !== "cancelled") {
      const cancelButton = document.createElement("button");
      cancelButton.className = "button button-secondary";
      cancelButton.type = "button";
      cancelButton.dataset.reservationId = reservation.id;
      cancelButton.textContent = "Cancel reservation";
      card.append(cancelButton);
    }

    return card;
  });

  reservationsList.append(...cards);
  setStatus(reservationsStatus, `${reservations.length} ${reservations.length === 1 ? "reservation" : "reservations"}.`);
}

async function loadReservations() {
  if (!authToken) {
    return;
  }

  refreshReservationsButton.disabled = true;
  setStatus(reservationsStatus, "Loading reservations...");

  try {
    const reservations = await apiRequest("/reservations", {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    if (!Array.isArray(reservations)) {
      throw new Error("The reservations API returned an unexpected response.");
    }
    renderReservations(reservations);
  } catch (error) {
    reservationsList.replaceChildren();
    setStatus(reservationsStatus, error.message, true);
  } finally {
    refreshReservationsButton.disabled = false;
  }
}

async function cancelReservation(reservationId, button) {
  if (!window.confirm("Cancel this reservation?")) {
    return;
  }

  button.disabled = true;
  setStatus(reservationsStatus, "Cancelling reservation...");

  try {
    await apiRequest(`/reservations/${encodeURIComponent(reservationId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${authToken}` },
    });
    await loadReservations();
  } catch (error) {
    setStatus(reservationsStatus, error.message, true);
    button.disabled = false;
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = loginForm.querySelector("button[type='submit']");
  const formData = new FormData(loginForm);
  submitButton.disabled = true;
  setStatus(loginStatus, "Signing in...");

  try {
    const result = await apiRequest("/users/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        password: formData.get("password"),
      }),
    });

    if (!result.token) {
      throw new Error("The login API did not return an access token.");
    }

    authToken = result.token;
    loginPanel.hidden = true;
    reservationPanel.hidden = false;
    setStatus(reservationStatus, result.user?.name ? `Signed in as ${result.user.name}.` : "Signed in.");
    await loadRooms();
    await loadReservations();
  } catch (error) {
    setStatus(loginStatus, error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

reservationForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(reservationForm);
  const startDate = formData.get("startDate");
  const endDate = formData.get("endDate");

  if (startDate >= endDate) {
    setStatus(reservationStatus, "End date must be after start date.", true);
    return;
  }

  reservationSubmit.disabled = true;
  setStatus(reservationStatus, "Creating reservation...");

  try {
    const reservation = await apiRequest("/reservations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        roomId: formData.get("roomId"),
        startDate,
        endDate,
      }),
    });
    reservationForm.reset();
    setStatus(reservationStatus, `Reservation ${reservation.id} created.`);
    await loadReservations();
  } catch (error) {
    setStatus(reservationStatus, error.message, true);
  } finally {
    reservationSubmit.disabled = false;
  }
});

refreshButton.addEventListener("click", loadRooms);
refreshReservationsButton.addEventListener("click", loadReservations);
reservationsList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-reservation-id]");
  if (button) {
    cancelReservation(button.dataset.reservationId, button);
  }
});
const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
document.querySelector("#reservation-start").min = today.toISOString().slice(0, 10);
loadRooms();
