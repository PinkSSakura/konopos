const { Router } = require('express');
const { cds } = require('../controllers')();

const router = Router();

router.get('/info', cds.getInfo);
router.get('/board', cds.getBoard);

module.exports = router;
