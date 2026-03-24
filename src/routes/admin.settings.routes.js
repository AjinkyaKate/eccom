const express = require('express');
const { getSettings, updateSettings } = require('../controllers/admin.settings.controller');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');

const router = express.Router();
router.use(protect, adminOnly);

router.get('/', getSettings);
router.put('/', updateSettings);

module.exports = router;
