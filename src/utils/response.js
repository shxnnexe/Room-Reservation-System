function successResponse(res, statusCode = 200, payload = null, meta = {}) {
  const body = {
    success: true,
    data: payload,
    meta,
  };

  return res.status(statusCode).json(body);
}

function errorResponse(res, statusCode = 400, message = 'Request failed', details = null) {
  const body = {
    success: false,
    error: {
      message,
      details,
    },
  };

  return res.status(statusCode).json(body);
}

module.exports = {
  successResponse,
  errorResponse,
};
