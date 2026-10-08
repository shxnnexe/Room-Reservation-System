const API_BASE_URL = window.ROOM_API_BASE_URL || "/api";

const roomList = document.querySelector("#rooms-list");
const roomStatus = document.querySelector("#rooms-status");
const refreshButton = document.querySelector("#refresh-rooms");

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const body = await response.json();

  if (!response.ok || body.success === false) {
    throw new Error(body.error?.message || `Request failed (${response.status})`);
  }

  return body.data;
}

function renderRooms(rooms) {
  roomList.replaceChildren();

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
  roomStatus.classList.remove("status-error");
  roomStatus.textContent = "Loading rooms...";

  try {
    const rooms = await apiRequest("/rooms");
    if (!Array.isArray(rooms)) {
      throw new Error("The rooms API returned an unexpected response.");
    }
    renderRooms(rooms);
  } catch (error) {
    roomList.replaceChildren();
    roomStatus.classList.add("status-error");
    roomStatus.textContent = error.message;
  } finally {
    refreshButton.disabled = false;
  }
}

refreshButton.addEventListener("click", loadRooms);
loadRooms();
