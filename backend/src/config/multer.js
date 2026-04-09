const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directories exist
const ensureUploadDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration (Dynamically sorts into images or documents folders)
const createStorage = () => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      let folderName = 'documents'; // default folder

      // Automatically route to 'images' folder if it's an image
      if (file.mimetype.startsWith('image/')) {
        folderName = 'images';
      }

      const uploadDir = path.join(__dirname, `../../public/uploads/${folderName}`);
      ensureUploadDir(uploadDir);
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });
};


// ==========================================
// FILE FILTERS
// ==========================================

// File filter for documents (PDF, DOC, DOCX, images, Excel, Zip, etc)
const documentFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png|pdf|doc|docx|xls|xlsx|csv|zip|rar|txt/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedExtensions.test(file.mimetype) || 
                   file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   file.mimetype === 'application/vnd.ms-excel' ||
                   file.mimetype === 'text/csv' ||
                   file.mimetype.includes('image/');
  
  if (extname || mimetype) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported. Allowed: JPEG, PNG, PDF, DOC, DOCX, Excel, CSV, Zip, TXT'));
  }
};

// File filter for spreadsheets only
const spreadsheetFilter = (req, file, cb) => {
  const allowedTypes = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Only spreadsheet files are allowed (CSV, XLSX, XLS)'));
  }
};

// File filter for images only
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WEBP)'));
  }
};

// Allow all file types
const allFilesFilter = (req, file, cb) => {
  cb(null, true);
};

// ==========================================
// MULTER CONFIGURATIONS
// ==========================================

const multerConfig = {
  // Global dynamic uploader helper
  upload: (folder = 'ignored', sizeLimit = 20, type = 'all') => {
    let filter = allFilesFilter;
    if (type === 'image') filter = imageFilter;
    if (type === 'document') filter = documentFilter;
    if (type === 'spreadsheet') filter = spreadsheetFilter;

    return multer({
      storage: createStorage(),
      limits: { fileSize: sizeLimit * 1024 * 1024 },
      fileFilter: filter,
    });
  },

  // Specific predefined configs
  employees: multer({ storage: createStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: documentFilter }),
  imports: multer({ storage: createStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: spreadsheetFilter }),
  workgroups: multer({ storage: createStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: allFilesFilter }),
  drive: multer({ storage: createStorage(), limits: { fileSize: 100 * 1024 * 1024 }, fileFilter: allFilesFilter }),
  profiles: multer({ storage: createStorage(), limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: imageFilter }),
  documents: multer({ storage: createStorage(), limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: documentFilter }),
  carImages: multer({ storage: createStorage(), limits: { fileSize: 10 * 1024 * 1024 }, fileFilter: imageFilter }),
};


module.exports = multerConfig;
