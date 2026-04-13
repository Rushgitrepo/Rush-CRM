const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

class RealtimeService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.FRONTEND_URL,
        credentials: true,
      },
    });

    // Authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication error'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.orgId = decoded.orgId;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    // Connection handling
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (Org: ${socket.orgId})`);
      
      // Store connection
      this.connectedUsers.set(socket.userId, {
        socketId: socket.id,
        orgId: socket.orgId,
        connectedAt: new Date(),
      });

      // Join organization room
      socket.join(`org:${socket.orgId}`);

      // Subscribe to specific channels
      socket.on('subscribe:campaign', (campaignId) => {
        socket.join(`campaign:${campaignId}`);
      });

      socket.on('subscribe:analytics', () => {
        socket.join(`analytics:${socket.orgId}`);
      });

      socket.on('unsubscribe:campaign', (campaignId) => {
        socket.leave(`campaign:${campaignId}`);
      });

      // Join direct messaging room
      socket.join(`user:${socket.userId}`);

      // Subscribe to workgroup channels
      socket.on('subscribe:workgroup', (workgroupId) => {
        socket.join(`workgroup:${workgroupId}`);
      });
      
      socket.on('unsubscribe:workgroup', (workgroupId) => {
        socket.leave(`workgroup:${workgroupId}`);
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
        this.connectedUsers.delete(socket.userId);
      });
    });

    console.log('✅ Real-time service initialized');
  }

  // Campaign events
  emitCampaignSent(campaignId, data) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:sent', data);
  }

  emitCampaignOpened(campaignId, data) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:opened', data);
  }

  emitCampaignClicked(campaignId, data) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:clicked', data);
  }

  emitCampaignStats(campaignId, stats) {
    this.io.to(`campaign:${campaignId}`).emit('campaign:stats', stats);
  }

  // Analytics events
  emitAnalyticsUpdate(orgId, data) {
    this.io.to(`analytics:${orgId}`).emit('analytics:update', data);
  }

  emitRealtimeMetric(orgId, metric, value) {
    this.io.to(`analytics:${orgId}`).emit('metric:update', { metric, value, timestamp: new Date() });
  }

  // Contact events
  emitContactCreated(orgId, contact) {
    this.io.to(`org:${orgId}`).emit('contact:created', contact);
  }

  emitContactScoreUpdated(orgId, contactId, score) {
    this.io.to(`org:${orgId}`).emit('contact:score_updated', { contactId, score });
  }

  // Form events
  emitFormSubmission(orgId, formId, submission) {
    this.io.to(`org:${orgId}`).emit('form:submission', { formId, submission });
  }

  // Webhook events
  emitWebhookTriggered(orgId, webhookId, status) {
    this.io.to(`org:${orgId}`).emit('webhook:triggered', { webhookId, status });
  }

  // Drive events
  emitDriveUpdate(orgId, data) {
    this.io.to(`org:${orgId}`).emit('drive:update', data);
  }

  // Broadcast to organization
  broadcastToOrg(orgId, event, data) {
    this.io.to(`org:${orgId}`).emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount(orgId) {
    const users = Array.from(this.connectedUsers.values()).filter(u => u.orgId === orgId);
    return users.length;
  }

  // Unibox events
  emitUniboxEmailCreated(orgId, email) {
    this.io.to(`org:${orgId}`).emit('unibox:email_created', email);
  }

  // --- Collaboration Addons ---

  emitDirectMessage(receiverId, message) {
    this.io.to(`user:${receiverId}`).emit('direct_message:new', message);
  }

  emitWorkgroupPost(workgroupId, post) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup_post:new', post);
  }
  
  emitReactionAdded(roomName, data) {
    this.io.to(roomName).emit('reaction:added', data);
  }

  emitMention(userId, message) {
    this.io.to(`user:${userId}`).emit('mention:new', message);
  }

  emitBroadcast(orgId, broadcastData) {
    this.io.to(`org:${orgId}`).emit('broadcast:new', broadcastData);
  }

  // Check if user is connected
  isUserConnected(userId) {
    return this.connectedUsers.has(userId);
  }
}

module.exports = new RealtimeService();
