const { Router } = require('express');
const { lan } = require('../utils')();
const { getLocalIPv4 } = lan;

const router = Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      timestamp: new Date().toISOString(),
      local_addresses: getLocalIPv4(),
      port: process.env.PORT || 5000,
    },
  });
});

module.exports = router;
