const { errorResponse } = require('../utils/response');

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization || req.headers['x-auth-token'];

  if (!authHeader) {
    return errorResponse(res, 401, 'Authentication required', 'Missing authorization header');
  }

  req.user = { id: 'demo-user', authHeader };
  return next();
}

module.exports = { authMiddleware };
