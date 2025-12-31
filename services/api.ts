
import { AgentLog, NotificationPackage, StatMetric } from '../types';
import { MOCK_NOTIFICATIONS, MOCK_AGENT_LOGS } from '../constants';

const API_URL = '/api';

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

async function apiRequest<T>(method: string, endpoint: string, data?: any): Promise<T> {
    const options: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
    };
    if (data) {
        options.body = JSON.stringify(data);
    }
    const res = await fetch(`${API_URL}${endpoint}`, options);
    if (!res.ok) {
        const error = await res.json().catch(() => ({ message: 'Request failed' }));
        throw new Error(error.message || 'Request failed');
    }
    return res.json();
}

export const api = {
    get: <T = any>(endpoint: string): Promise<T> => apiRequest<T>('GET', endpoint),
    post: <T = any>(endpoint: string, data?: any): Promise<T> => apiRequest<T>('POST', endpoint, data),
    put: <T = any>(endpoint: string, data?: any): Promise<T> => apiRequest<T>('PUT', endpoint, data),
    patch: <T = any>(endpoint: string, data?: any): Promise<T> => apiRequest<T>('PATCH', endpoint, data),
    delete: <T = any>(endpoint: string): Promise<T> => apiRequest<T>('DELETE', endpoint),

    getDashboardStats: async () => {
        return fetchWithFallback('/dashboard', {
            stats: { incoming: 12, triage: 3, executed: 0, reviewed: 0, packagesTotal: 0, packagesToday: 0, packagesIncomplete: 0, packagesAnalyzed: 0 },
            agentStatus: 'OFFLINE',
            recentLogs: MOCK_AGENT_LOGS
        });
    },

    getNotifications: async (): Promise<NotificationPackage[]> => {
        return fetchWithFallback('/notifications', MOCK_NOTIFICATIONS);
    },

    triggerAgentSync: async () => {
        console.log("Triggering manual sync...");
    }
};
