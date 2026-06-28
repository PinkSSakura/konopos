const { Router } = require('express');

const { authenticate } = require('../middleware/auth');

const requirePermission = require('../middleware/require-permission');

const requireAnyPermission = require('../middleware/require-any-permission');

const { menu } = require('../controllers')();

const { extra } = require('../controllers')();

const {

  categoryImageUpload, extraImageUpload, menuItemImageUpload,

} = require('../middleware/upload');



const router = Router();

router.use(authenticate);



const catalogOr = (adminCode) => requireAnyPermission(['catalog_view', adminCode]);

const menuAdminOrCatalog = requireAnyPermission([
  'catalog_view',
  'category_view',
  'subcategory_view',
  'item_view',
  'extra_view',
]);

router.get('/counts', menuAdminOrCatalog, menu.getCounts);

router.get('/categories', catalogOr('category_view'), menu.listCategories);

router.get('/categories/:id', catalogOr('category_view'), menu.getCategory);

router.post('/categories/upload', requirePermission('category_upload_image'), categoryImageUpload.single('image'), menu.uploadCategoryImage);

router.post('/categories', requirePermission('category_create'), menu.createCategory);

router.put('/categories/:id', requirePermission('category_update'), menu.updateCategory);

router.delete('/categories/:id', requirePermission('category_softdelete'), menu.deleteCategory);



router.get('/extras', catalogOr('extra_view'), extra.listExtras);

router.get('/extras/:id', catalogOr('extra_view'), extra.getExtra);

router.post('/extras/upload', requirePermission('extra_upload_image'), extraImageUpload.single('image'), extra.uploadExtraImage);

router.post('/extras', requirePermission('extra_create'), extra.createExtra);

router.put('/extras/:id', requirePermission('extra_update'), extra.updateExtra);

router.delete('/extras/:id', requirePermission('extra_softdelete'), extra.deleteExtra);



router.get('/subcategories', catalogOr('subcategory_view'), menu.listSubcategories);

router.get('/subcategories/:id', catalogOr('subcategory_view'), menu.getSubcategory);

router.post('/subcategories', requirePermission('subcategory_create'), menu.createSubcategory);

router.put('/subcategories/:id', requirePermission('subcategory_update'), menu.updateSubcategory);

router.delete('/subcategories/:id', requirePermission('subcategory_softdelete'), menu.deleteSubcategory);



router.get('/items', catalogOr('item_view'), menu.listItems);

router.get('/items/:id', catalogOr('item_view'), menu.getItem);

router.post('/items/upload', requirePermission('item_upload_image'), menuItemImageUpload.single('image'), menu.uploadMenuItemImage);

router.post('/items', requirePermission('item_create'), menu.createItem);

router.put('/items/:id', requirePermission('item_update'), menu.updateItem);

router.delete('/items/:id', requirePermission('item_softdelete'), menu.deleteItem);



module.exports = router;

