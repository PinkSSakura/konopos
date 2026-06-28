module.exports = () => {
  const analytics = require('./analytics.controller');
  const audit = require('./audit.controller');
  const auth = require('./auth.controller');
  const cds = require('./cds.controller');
  const customer = require('./customer.controller');
  const establishment = require('./establishment.controller');
  const expense = require('./expense.controller');
  const extra = require('./extra.controller');
  const kds = require('./kds.controller');
  const kitchenPrint = require('./kitchen-print.controller');
  const license = require('./license.controller');
  const menu = require('./menu.controller');
  const order = require('./order.controller');
  const payment = require('./payment.controller');
  const push = require('./push.controller');
  const room = require('./room.controller');
  const service = require('./service.controller');
  const session = require('./session.controller');
  const setup = require('./setup.controller');
  const shift = require('./shift.controller');
  const table = require('./table.controller');
  const admin = {
    role: require('./admin/role.controller'),
    shiftAdmin: require('./admin/shift-admin.controller'),
    user: require('./admin/user.controller'),
    backup: require('./backup.controller'),
  };

  return {
    analytics,
    audit,
    auth,
    admin,
    cds,
    customer,
    establishment,
    expense,
    extra,
    kds,
    kitchenPrint,
    license,
    menu,
    order,
    payment,
    push,
    room,
    service,
    session,
    setup,
    shift,
    table,
  };
};
