const { setAuthCookie } = require('./authcookie');

/** Login success — token in HttpOnly cookie; native mobile clients also receive token in JSON. */
function sendAuthSuccess(res, {
  token,
  roleKey,
  is_pin_session = false,
  is_quick_waiter_session = false,
  requires_shift_start = false,
  shift_requires_amounts,
  mode,
  req,
}) {
  setAuthCookie(res, token, roleKey);

  const data = {
    is_pin_session: Boolean(is_pin_session),
    is_quick_waiter_session: Boolean(is_quick_waiter_session),
    requires_shift_start: Boolean(requires_shift_start),
    role_key: roleKey || undefined,
  };

  if (shift_requires_amounts !== undefined) {
    data.shift_requires_amounts = Boolean(shift_requires_amounts);
  }
  if (mode) data.mode = mode;
  if (req?.headers?.['x-device-type'] === 'mobile' && token) {
    data.token = token;
  }

  res.json({ success: true, data });
}

module.exports = { sendAuthSuccess };
