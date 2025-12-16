/**
 * Session Management Service - Handles customer sessions for encryption
 */

class SessionService {
    constructor() {
        this.activeSessions = new Map();
        this.sessionTimeout = 30000; // 30 seconds
    }

    startSession(customerID, sessionKey) {
        this.activeSessions.set(customerID, {
            sessionKey,
            lastSeen: Date.now(),
            files: []
        });
        console.log(`Session started for ${customerID}`);
        return true;
    }

    updateHeartbeat(customerID) {
        if (this.activeSessions.has(customerID)) {
            this.activeSessions.get(customerID).lastSeen = Date.now();
            return true;
        }
        return false;
    }

    endSession(customerID) {
        if (this.activeSessions.has(customerID)) {
            console.log(`Session ended for ${customerID}`);
            this.activeSessions.delete(customerID);
            return true;
        }
        return false;
    }

    isSessionActive(customerID) {
        return this.activeSessions.has(customerID);
    }

    validateSession(customerID, sessionKey) {
        if (!this.activeSessions.has(customerID)) {
            return false;
        }
        const session = this.activeSessions.get(customerID);
        return session.sessionKey === sessionKey;
    }

    cleanupInactiveSessions() {
        const now = Date.now();
        for (const [customerID, session] of this.activeSessions.entries()) {
            if (now - session.lastSeen > this.sessionTimeout) {
                console.log(`Session timeout for ${customerID}`);
                this.activeSessions.delete(customerID);
            }
        }
    }

    getAllSessions() {
        return Array.from(this.activeSessions.entries()).map(([id, session]) => ({
            customerID: id,
            lastSeen: session.lastSeen,
            filesCount: session.files.length
        }));
    }

    startCleanupTimer() {
        this.cleanupTimer = setInterval(() => {
            this.cleanupInactiveSessions();
        }, 10000); // Check every 10 seconds
    }

    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
    }
}

module.exports = new SessionService();
