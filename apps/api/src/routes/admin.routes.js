const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requireSuperAdmin = require('../middleware/require-super-admin');
const { admin, audit } = require('../controllers')();

const router = Router();

router.use(authenticate, requireSuperAdmin);

router.get('/users', admin.user.listUsers);
router.get('/users/:id', admin.user.getUser);
router.post('/users', admin.user.createUser);
router.put('/users/:id', admin.user.updateUser);
router.delete('/users/:id', admin.user.deleteUser);

router.get('/roles', admin.role.listRoles);
router.get('/roles/:id', admin.role.getRole);
router.put('/roles/:id', admin.role.updateRole);
router.get('/permissions', admin.role.listPermissions);
router.get('/roles/:id/permissions', admin.role.getRolePermissions);
router.put('/roles/:id/permissions', admin.role.updateRolePermissions);

router.get('/audit-logs', audit.listSystemAudit);
router.get('/backup/export', admin.backup.exportBackup);

module.exports = router;
