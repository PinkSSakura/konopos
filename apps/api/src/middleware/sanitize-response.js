const { serializers } = require('../utils')();
const { sanitizeForClient } = serializers;


/**
 * Wraps res.json so `data` is sanitized before leaving the API.
 */
function sanitizeResponse(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === 'object' && Object.prototype.hasOwnProperty.call(body, 'data')) {
      return originalJson({
        ...body,
        data: sanitizeForClient(body.data),
      });
    }
    return originalJson(body);
  };
  next();
}

module.exports = sanitizeResponse;
