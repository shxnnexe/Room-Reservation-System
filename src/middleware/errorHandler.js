const { errorResponse } = require('../utils/response');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error';

  return errorResponse(res, statusCode, message, err.details || null);
}

module.exports = { errorHandler };
