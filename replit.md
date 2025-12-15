# Vento LexOps

## Overview
Vento LexOps es una aplicación de automatización legal para la gestión de notificaciones judiciales de LexNET. Combina un frontend React con un backend Express.js para gestionar notificaciones, triage y sincronización con agentes desktop.

## Project Architecture
- **Frontend**: React 19 + TypeScript + Vite (puerto 5000)
- **Backend**: Express.js API server (puerto 3001)
- **Styling**: TailwindCSS (via CDN)
- **Charts**: Recharts
- **Icons**: Lucide React
- **AI Integration**: Google Gemini API (@google/genai)

## Directory Structure
```
/
├── components/         # React components (Layout)
├── screens/           # Page components (Dashboard, Triage, etc.)
├── services/          # API and Gemini service modules
├── App.tsx            # Main application component
├── index.tsx          # React entry point
├── index.html         # HTML template
├── server.js          # Express.js backend server
├── types.ts           # TypeScript type definitions
├── constants.ts       # App constants and mock data
└── vite.config.ts     # Vite configuration
```

## Running the Application
The app runs with a single command that starts both frontend and backend:
```bash
npm run dev
```

- Frontend: http://localhost:5000
- Backend API: http://localhost:3001

## API Endpoints
- `GET /api/dashboard` - Dashboard statistics and agent status
- `GET /api/notifications` - List of notifications
- `POST /api/agent/heartbeat` - Agent heartbeat
- `POST /api/agent/log` - Upload agent logs
- `POST /api/agent/notification` - Upload notification from agent

## Environment Variables
- `GEMINI_API_KEY` - Google Gemini API key for AI features

## Recent Changes
- 2024-12-15: Initial Replit setup
  - Configured Vite for port 5000 with proxy to backend
  - Fixed JSX syntax errors
  - Added workflow configuration
