const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { auth, requireOrg } = require('../../middleware/auth');
const documentController = require('../../controllers/crm/documentController');

// Multer configuration for CRM file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../../uploads/crm');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit
});

router.use(auth, requireOrg);

router.get('/:entityType/:entityId', documentController.getByEntity);
router.post('/:entityType/:entityId', upload.single('file'), documentController.upload);
router.delete('/:id', documentController.remove);

module.exports = router;
