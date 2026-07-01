const express = require('express');
const router = express.Router();
const { auth, requireOrg } = require('../../middleware/auth');
const {
  getStats,
  getActivities,
  getAttendance,
  getTodayAttendance,
  getMyTodayAttendance,
  getMyHistory,
  clockIn,
  clockOut,
  startBreak,
  endBreak,
} = require('../../controllers/hrms/hrmsController');

// Apply auth middleware to all routes
router.use(auth);
router.use(requireOrg);

// Statistics and dashboard
router.get('/stats', getStats);
router.get('/activities', getActivities);

// Attendance routes
router.get('/attendance', getAttendance);
router.get('/attendance/today', getTodayAttendance);
router.get('/attendance/my-today', getMyTodayAttendance);
router.get('/attendance/my-history', getMyHistory);

// Clock in/out routes
router.post('/attendance/clock-in', clockIn);
router.post('/attendance/clock-out', clockOut);
router.post('/attendance/break-start', startBreak);
router.post('/attendance/break-end', endBreak);

module.exports = router;
