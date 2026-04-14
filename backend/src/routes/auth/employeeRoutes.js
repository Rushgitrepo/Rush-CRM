const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const { checkPermission } = require('../../middleware/permissionAccess');
const employeeController = require('../../controllers/auth/employeeController');

router.use(auth, requireOrg);

router.get('/', checkPermission('members', 'view'), employeeController.getAll);
router.get('/:id/profile', checkPermission('members', 'view'), employeeController.getProfile);
router.get('/:id', checkPermission('members', 'view'), employeeController.getById);
router.post('/', checkPermission('members', 'create'), employeeController.create);
router.put('/:id', checkPermission('members', 'edit'), employeeController.update);
router.delete('/:id', checkPermission('members', 'delete'), employeeController.remove);
router.post('/:id/reset-password', checkPermission('members', 'edit'), employeeController.resetPassword);

module.exports = router;
