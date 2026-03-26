const express = require('express');
const multer = require('multer');
const { protect } = require('../middlewares/auth.middleware');
const { adminOnly } = require('../middlewares/admin.middleware');
const { uploadImage, deleteImage } = require('../controllers/upload.controller');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

router.post('/', protect, adminOnly, upload.single('file'), uploadImage);
router.delete('/', protect, adminOnly, deleteImage);

module.exports = router;
