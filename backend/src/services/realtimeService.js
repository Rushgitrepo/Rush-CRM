const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const db = require('../config/database');

class RealtimeService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map();
    this.userSockets = new Map();
    this.userActiveSockets = new Map();
    this.lastSeenAt = new Map();
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: process.env.APP_URL,
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
      // Track multi-tab/socket presence at app level
      const existingSockets = this.userSockets.get(socket.userId) || new Set();
      existingSockets.add(socket.id);
      this.userSockets.set(socket.userId, existingSockets);

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

      socket.on('presence:active', () => {
        const activeSet = this.userActiveSockets.get(socket.userId) || new Set();
        const wasOnline = this.isUserConnected(socket.userId);
        activeSet.add(socket.id);
        this.userActiveSockets.set(socket.userId, activeSet);
        this.lastSeenAt.delete(socket.userId);
        if (!wasOnline) {
          this.emitPresenceUpdate(socket.orgId, socket.userId, true, null);
        }
      });

      socket.on('presence:inactive', () => {
        const activeSet = this.userActiveSockets.get(socket.userId);
        if (activeSet) {
          activeSet.delete(socket.id);
          if (activeSet.size === 0) {
            this.userActiveSockets.delete(socket.userId);
            const now = new Date();
            this.lastSeenAt.set(socket.userId, now);
            this.persistLastSeenAt(socket.userId, now);
            this.emitPresenceUpdate(socket.orgId, socket.userId, false, now);
          } else {
            this.userActiveSockets.set(socket.userId, activeSet);
          }
        }
      });

      // ─── WebRTC Call Signaling ───────────────────────────────
      socket.on('call:initiate', (payload) => {
        // payload: { callId, targetUserId, callerName, callerAvatar, callType: 'video'|'audio' }
        console.log(`[WebRTC] Call initiated: ${socket.userId} -> ${payload.targetUserId} (${payload.callType})`);
        this.io.to(`user:${payload.targetUserId}`).emit('call:incoming', {
          callId: payload.callId,
          callerId: socket.userId,
          callerName: payload.callerName,
          callerAvatar: payload.callerAvatar,
          callType: payload.callType,
        });
      });

      socket.on('call:accept', (payload) => {
        // payload: { callId, callerId, accepterName, accepterAvatar }
        console.log(`[WebRTC] Call accepted: ${socket.userId} accepted call ${payload.callId}`);
        this.io.to(`user:${payload.callerId}`).emit('call:accepted', {
          callId: payload.callId,
          accepterId: socket.userId,
          accepterName: payload.accepterName,
          accepterAvatar: payload.accepterAvatar,
        });
      });

      socket.on('call:reject', (payload) => {
        // payload: { callId, callerId, reason }
        console.log(`[WebRTC] Call rejected: ${socket.userId} rejected call ${payload.callId}`);
        this.io.to(`user:${payload.callerId}`).emit('call:rejected', {
          callId: payload.callId,
          rejectedBy: socket.userId,
          reason: payload.reason || 'declined',
        });
      });

      socket.on('call:join-room', (payload) => {
        // payload: { roomId, userId, name, avatar }
        const roomName = `call_room:${payload.roomId}`;
        socket.join(roomName);
        console.log(`[WebRTC] User ${payload.userId} joined room ${payload.roomId}`);

        // Notify others in the room
        socket.to(roomName).emit('call:user-joined', {
          userId: payload.userId,
          name: payload.name,
          avatar: payload.avatar,
        });
      });

      socket.on('call:offer', (payload) => {
        // payload: { callId, targetUserId, sdp }
        this.io.to(`user:${payload.targetUserId}`).emit('call:offer', {
          callId: payload.callId,
          fromUserId: socket.userId,
          sdp: payload.sdp,
        });
      });

      socket.on('call:answer', (payload) => {
        // payload: { callId, targetUserId, sdp }
        this.io.to(`user:${payload.targetUserId}`).emit('call:answer', {
          callId: payload.callId,
          fromUserId: socket.userId,
          sdp: payload.sdp,
        });
      });

      socket.on('call:ice-candidate', (payload) => {
        // payload: { callId, targetUserId, candidate }
        this.io.to(`user:${payload.targetUserId}`).emit('call:ice-candidate', {
          callId: payload.callId,
          fromUserId: socket.userId,
          candidate: payload.candidate,
        });
      });

      socket.on('call:reaction', (payload) => {
        // payload: { callId, reaction: { id, userId, emoji, userName } }
        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;
          this.io.to(roomName).emit('call:reaction', payload);
        }
      });

      socket.on('call:end', (payload) => {
        // payload: { callId, targetUserId, reason }
        if (payload.targetUserId) {
          this.io.to(`user:${payload.targetUserId}`).emit('call:end', {
            callId: payload.callId,
            fromUserId: socket.userId,
            reason: payload.reason || 'hangup',
          });
        }

        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;
          socket.leave(roomName);
          this.io.to(roomName).emit('call:user-left', {
            userId: socket.userId,
            callId: payload.callId,
          });
        }
      });

      socket.on('call:toggle-media', (payload) => {
        // payload: { callId, targetUserId, mediaType: 'audio'|'video', enabled }
        if (payload.callId) {
          const roomName = `call_room:${payload.callId}`;
          socket.to(roomName).emit('call:toggle-media', {
            callId: payload.callId,
            fromUserId: socket.userId,
            mediaType: payload.mediaType,
            enabled: payload.enabled,
          });
        }
      });

      // Disconnect handling
      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
        const existingSockets = this.userSockets.get(socket.userId);
        const activeSockets = this.userActiveSockets.get(socket.userId);
        const wasOnlineBeforeDisconnect = this.isUserConnected(socket.userId);
        if (existingSockets) {
          existingSockets.delete(socket.id);
          if (existingSockets.size === 0) {
            this.userSockets.delete(socket.userId);
            this.connectedUsers.delete(socket.userId);
          } else {
            this.userSockets.set(socket.userId, existingSockets);
          }
        } else {
          this.connectedUsers.delete(socket.userId);
        }

        if (activeSockets) {
          activeSockets.delete(socket.id);
          if (activeSockets.size === 0) {
            this.userActiveSockets.delete(socket.userId);
          } else {
            this.userActiveSockets.set(socket.userId, activeSockets);
          }
        }

        const isOnlineAfterDisconnect = this.isUserConnected(socket.userId);
        if (wasOnlineBeforeDisconnect && !isOnlineAfterDisconnect) {
          const now = new Date();
          this.lastSeenAt.set(socket.userId, now);
          this.persistLastSeenAt(socket.userId, now);
          this.emitPresenceUpdate(socket.orgId, socket.userId, false, now);
        }
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

  emitWorkgroupNotification(userId, data) {
    this.io.to(`user:${userId}`).emit('workgroup:notification', data);
  }

  emitWorkgroupMemberAdded(workgroupId, member) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup:member_added', member);
  }

  emitWorkgroupMemberRemoved(workgroupId, memberId) {
    this.io.to(`workgroup:${workgroupId}`).emit('workgroup:member_removed', { memberId });
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

  emitWorkgroupUpdated(orgId, payload) {
    this.io.to(`org:${orgId}`).emit('workgroup:updated', payload);
  }

  emitPresenceUpdate(orgId, userId, isOnline, lastSeenAt) {
    this.io.to(`org:${orgId}`).emit('presence:update', {
      userId,
      is_online: isOnline,
      last_seen_at: lastSeenAt ? new Date(lastSeenAt).toISOString() : null,
    });
  }

  // Check if user is connected
  isUserConnected(userId) {
    const sockets = this.userActiveSockets.get(userId);
    return Boolean(sockets && sockets.size > 0);
  }

  getUserPresence(userId) {
    const isOnline = this.isUserConnected(userId);
    return {
      isOnline,
      lastSeenAt: isOnline ? null : this.lastSeenAt.get(userId) || null,
    };
  }

  async persistLastSeenAt(userId, when) {
    try {
      await db.query(
        'UPDATE users SET last_seen_at = $2 WHERE id = $1',
        [userId, when],
      );
    } catch (error) {
      console.error('Failed to persist last_seen_at:', error?.message || error);
    }
  }
}

module.exports = new RealtimeService();
