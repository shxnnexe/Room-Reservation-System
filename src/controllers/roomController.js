const { successResponse, errorResponse } = require('../utils/response');

const rooms = [
  { id: 'R101', type: 'single', capacity: 2 },
  { id: 'R202', type: 'double', capacity: 4 },
  { id: 'R303', type: 'suite', capacity: 6 },
];

function getRooms(req, res) {
  return successResponse(res, 200, rooms, { count: rooms.length });
}

function getRoomById(req, res) {
  const { id } = req.params;
  const room = rooms.find((entry) => entry.id === id);

  if (!room) {
    return errorResponse(res, 404, 'Room not found', { roomId: id });
  }

  return successResponse(res, 200, room);
}

module.exports = {
  getRooms,
  getRoomById,
};
