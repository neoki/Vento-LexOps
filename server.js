
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// --- IN-MEMORY DATABASE (Simulating Postgres) ---
let agents = {
    'AGENT-WS-01': { status: 'OFFLINE', lastHeartbeat: null, logs: [] }
};

let notifications = [
    // Initial data
    {
        id: 'NOT-2024-SERVER-01',
        lexnetId: 'LEX-REAL-001',
        receivedDate: new Date().toISOString(),
        downloadedDate: new Date().toISOString(),
        court: 'Juzgado Social 1 Madrid',
        procedureNumber: '101/2024',
        status: 'TRIAGE_REQUIRED',
        priority: 'HIGH',
        docType: 'SENTENCIA',
        aiConfidence: 45,
        aiReasoning: ['Modelo detectó ambigüedad en fallo'],
        extractedDeadlines: [],
        assignedLawyerId: '1',
        suggestedCaseId: ''
    }
];

// --- API ENDPOINTS ---

// 1. Frontend: Get Dashboard Data
app.get('/api/dashboard', (req, res) => {
    const isAgentOnline = agents['AGENT-WS-01'].status === 'ONLINE' && 
                          (Date.now() - agents['AGENT-WS-01'].lastHeartbeat < 10000);
    
    res.json({
        stats: {
            incoming: notifications.length,
            triage: notifications.filter(n => n.status === 'TRIAGE_REQUIRED').length,
            synced: notifications.filter(n => n.status === 'SYNCED').length
        },
        agentStatus: isAgentOnline ? 'ONLINE' : 'OFFLINE',
        recentLogs: agents['AGENT-WS-01'].logs.slice(0, 10)
    });
});

// 2. Frontend: Get Notifications
app.get('/api/notifications', (req, res) => {
    res.json(notifications);
});

// 3. Agent: Heartbeat (I am alive)
app.post('/api/agent/heartbeat', (req, res) => {
    const { agentId } = req.body;
    if (!agents[agentId]) agents[agentId] = { logs: [] };
    
    agents[agentId].status = 'ONLINE';
    agents[agentId].lastHeartbeat = Date.now();
    
    // Command & Control: Tell the agent if it should do work
    // In a real app, we would check a job queue here
    const shouldSync = Math.random() > 0.8; // Randomly ask to sync
    
    res.json({ command: shouldSync ? 'SYNC_LEXNET' : 'IDLE' });
});

// 4. Agent: Upload Log
app.post('/api/agent/log', (req, res) => {
    const { agentId, level, message } = req.body;
    const logEntry = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        level,
        message,
        agentId
    };
    if (agents[agentId]) {
        agents[agentId].logs.unshift(logEntry); // Add to start
    }
    console.log(`[AGENT ${agentId}] ${message}`);
    res.json({ success: true });
});

// 5. Agent: Upload Notification (The result of RPA)
app.post('/api/agent/notification', (req, res) => {
    const newNotif = {
        ...req.body,
        id: `NOT-${Date.now()}`,
        status: 'TRIAGE_REQUIRED', // Default to triage
        downloadedDate: new Date().toISOString()
    };
    notifications.unshift(newNotif);
    console.log("New notification received from Agent!");
    res.json({ success: true, id: newNotif.id });
});

app.listen(PORT, () => {
    console.log(`Vento LexOps Backend running at http://localhost:${PORT}`);
});
