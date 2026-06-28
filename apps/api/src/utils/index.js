module.exports = () => {
  const auditlabels = require('./auditlabels');
  const authcookie = require('./authcookie');
  const authresponse = require('./authresponse');
  const codes = require('./codes');
  const cors = require('./cors');
  const daterange = require('./daterange');
  const fieldencryption = require('./fieldencryption');
  const kds = require('./kds');
  const lan = require('./lan');
  const orderownership = require('./orderownership');
  const paymentaccess = require('./paymentaccess');
  const query = require('./query');
  const serializers = require('./serializers');
  const shiftroles = require('./shiftroles');
  const staffexport = require('./staffexport');
  const tenant = require('./tenant');

  return {
    auditlabels,
    authcookie,
    authresponse,
    codes,
    cors,
    daterange,
    fieldencryption,
    kds,
    lan,
    orderownership,
    paymentaccess,
    query,
    serializers,
    shiftroles,
    staffexport,
    tenant,
  };
};
