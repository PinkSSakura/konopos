module.exports = () => {
  const audit = require('./audit');
  const auth = require('./auth');
  const dailycode = require('./dailycode');
  const escpos = require('./escpos');
  const license = require('./license');
  const notify = require('./notify');
  const order = require('./order');
  const payment = require('./payment');
  const permission = require('./permission');
  const print = require('./print');
  const push = require('./push');
  const receipt = require('./receipt');
  const reports = require('./reports');
  const session = require('./session');
  const shift = require('./shift');
  return {
    audit,
    auth,
    dailycode,
    escpos,
    license,
    notify,
    order,
    payment,
    permission,
    print,
    push,
    receipt,
    reports,
    session,
    shift,
  };
};
