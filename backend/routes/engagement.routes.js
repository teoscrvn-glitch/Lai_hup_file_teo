const express = require('express');
const router = express.Router();
const engagementController = require('../controllers/engagement.controller');
const { requireAuth } = require('../middleware/auth.middleware');

// Comments
router.get('/files/:fileId/comments', engagementController.listComments);
router.post('/files/:fileId/comments', requireAuth, engagementController.postComment);

// Ratings
router.post('/files/:fileId/rate', requireAuth, engagementController.rateFile);

// Notifications
router.get('/notifications/me', requireAuth, engagementController.myNotifications);
router.patch('/notifications/:id/read', requireAuth, engagementController.markNotificationRead);
router.patch('/notifications/read-all', requireAuth, engagementController.markAllNotificationsRead);

module.exports = router;
