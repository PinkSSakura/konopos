const { Router } = require('express');
const { authenticate } = require('../middleware/auth');
const requirePermission = require('../middleware/require-permission');
const requireOpenShift = require('../middleware/require-open-shift');
const blockKitchenStaff = require('../middleware/block-kitchen-staff');
const blockSystemposShell = require('../middleware/block-systempos-shell');
const { order, payment, kitchenPrint } = require('../controllers')();

const router = Router();
router.use(authenticate);
router.use(blockSystemposShell);

router.get('/', requirePermission('order_view'), order.listOrders);
router.get('/:id/receipt', requirePermission('payment_process'), payment.getReceipt);
router.get('/:id', requirePermission('order_view'), order.getOrder);
router.post('/', blockKitchenStaff, requireOpenShift, requirePermission('order_create'), order.createOrder);
router.put('/:id', blockKitchenStaff, requireOpenShift, requirePermission('order_update'), order.updateOrder);
router.post('/:id/cancel', blockKitchenStaff, requireOpenShift, requirePermission('order_cancel'), order.cancelOrder);
router.post('/:id/refund-and-cancel', blockKitchenStaff, requireOpenShift, requirePermission('order_cancel'), order.refundAndCancelOrder);
router.post('/:id/send', blockKitchenStaff, requireOpenShift, requirePermission('order_send'), order.sendToKitchen);
router.post('/:id/checkout', requirePermission('payment_process'), requireOpenShift, payment.checkout);
router.post('/:id/print-kitchen', requirePermission('print_kitchen'), kitchenPrint.printKitchen);
router.post('/:id/print-caisse', requirePermission('print_receipt'), payment.printCaisse);
router.post('/:id/mark-delivered', requirePermission('order_mark_served'), requireOpenShift, order.markDelivered);
router.post('/:id/items', blockKitchenStaff, requireOpenShift, requirePermission('order_update'), order.addItem);
router.put('/:id/items/:itemId', blockKitchenStaff, requireOpenShift, requirePermission('order_update'), order.updateItem);
router.delete('/:id/items/:itemId', blockKitchenStaff, requireOpenShift, requirePermission('order_update'), order.removeItem);
router.post('/:id/items/:itemId/void-served', blockKitchenStaff, requireOpenShift, requirePermission('order_item_void'), order.voidServedItem);
router.post('/:id/items/:itemId/replace', blockKitchenStaff, requireOpenShift, requirePermission('order_item_void'), order.replaceServedItem);

module.exports = router;
