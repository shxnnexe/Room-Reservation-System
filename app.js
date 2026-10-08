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
let authToken = null;

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
  } catch (error) {
    setStatus(reservationStatus, error.message, true);
  } finally {
    reservationSubmit.disabled = false;
  }
});

refreshButton.addEventListener("click", loadRooms);
const today = new Date();
today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
document.querySelector("#reservation-start").min = today.toISOString().slice(0, 10);
loadRooms();
