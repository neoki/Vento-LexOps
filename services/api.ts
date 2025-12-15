
import { AgentLog, NotificationPackage, StatMetric } from '../types';
import { MOCK_NOTIFICATIONS, MOCK_AGENT_LOGS } from '../constants';

const API_URL = '/api';

// Helper to handle fetch errors gracefully and fallback to mocks if server is down
async function fetchWithFallback<T>(endpoint: string, fallbackData: T): Promise<T> {
    try {
        const res = await fetch(`${API_URL}${endpoint}`);
        if (!res.ok) throw new Error('Network response was not ok');
        return await res.json();
    } catch (error) {
        console.warn(`API Error on ${endpoint}. Using fallback mock data. Is server.js running?`);
        return fallbackData;
    }
}

export const api = {
    getDashboardStats: async () => {
        return fetchWithFallback('/dashboard', {
            stats: { incoming: 12, triage: 3, synced: 42 },
            agentStatus: 'OFFLINE',
            recentLogs: MOCK_AGENT_LOGS
        });
    },

    getNotifications: async (): Promise<NotificationPackage[]> => {
        return fetchWithFallback('/notifications', MOCK_NOTIFICATIONS);
    },

    triggerAgentSync: async () => {
        // In a real app, this would send a push notification to the agent
        // For this demo, the agent polls, so we just wait
        console.log("Triggering manual sync...");
    }
};
