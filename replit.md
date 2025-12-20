# Vento LexOps

## Overview
Vento LexOps es una plataforma de automatización legal para la gestión de notificaciones judiciales de LexNET. Combina un frontend React con un backend Express.js respaldado por PostgreSQL, integrando IA dual (Google Gemini / OpenAI), Microsoft Graph y la API de Invento.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite (puerto 5000)
- **Backend**: Express.js + TypeScript (puerto 3001)
- **Database**: PostgreSQL con Drizzle ORM
- **AI**: Google Gemini + OpenAI (configurado a nivel de oficina, opt-in por usuario)
- **Styling**: TailwindCSS (via CDN)
- **Charts**: Recharts
- **Icons**: Lucide React
- **Auth**: Passport.js con sesiones

## Project Structure
```
/
├── server.ts              # Backend Express principal
├── server/
│   ├── db.ts             # Conexión a PostgreSQL
│   ├── auth.ts           # Autenticación y roles
│   ├── ai-service.ts     # Servicio dual AI (Gemini/OpenAI)
│   ├── config-api.ts     # APIs CRUD de configuración (ADMIN only)
│   ├── packages-api.ts   # APIs de paquetes LexNET
│   ├── package-processor.ts  # Procesamiento de ZIPs y extracción
│   ├── execution-plan-service.ts # Sistema de planes de ejecución
│   ├── storage-service.ts    # Almacenamiento de documentos
│   ├── microsoft-graph.ts # Integración Microsoft 365
│   └── invento-api.ts    # Integración Invento
├── shared/
│   └── schema.ts         # Schema Drizzle (10+ tablas incluyendo offices, teams, packages, etc.)
├── components/
│   └── Layout.tsx        # Layout principal con navegación
├── screens/
│   ├── Dashboard.tsx     # Panel de control
│   ├── Triage.tsx        # Bandeja de triage
│   ├── Packages.tsx      # Gestión de paquetes LexNET
│   ├── Review.tsx        # Revisión de planes de ejecución
│   ├── Configuration.tsx # Configuración multi-oficina (ADMIN)
│   ├── Login.tsx         # Pantalla de login/registro
│   ├── Settings.tsx      # Configuración de usuario y AI
│   ├── Audit.tsx         # Logs de auditoría
│   └── ...
├── services/
│   ├── api.ts            # Cliente API frontend
│   └── geminiService.ts  # Servicio Gemini legacy
├── docs/
│   └── rpa-agent-architecture.md  # Documentación del agente RPA
├── App.tsx               # Componente principal React
├── drizzle.config.ts     # Configuración Drizzle
└── vite.config.ts        # Configuración Vite
```

## Database Schema

### Usuarios (`users`)
- id, username, email, password (hash), fullName, role (ADMIN/LAWYER/ASSISTANT)

### Configuración AI (`user_ai_settings`)
- userId, provider (OPENAI/GEMINI), apiKey, modelPreferences

### Notificaciones (`notifications`)
- lexnetId, court, procedureNumber, status, priority, aiConfidence, aiReasoning, extractedDeadlines

### Agentes (`agents`)
- agentId, name, status, lastHeartbeat, certificateThumbprint

### Logs de Auditoría (`audit_logs`)
- actorUserId, action, targetType, targetId, metadata

### Tokens de Integración (`integration_tokens`)
- userId, provider (MICROSOFT_GRAPH/INVENTO), accessToken, refreshToken

## API Endpoints

### Autenticación
- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Iniciar sesión
- `POST /api/auth/logout` - Cerrar sesión
- `GET /api/auth/me` - Usuario actual

### Dashboard & Notificaciones
- `GET /api/dashboard` - Estadísticas del dashboard
- `GET /api/notifications` - Lista de notificaciones
- `PATCH /api/notifications/:id/status` - Actualizar estado
- `POST /api/notifications/:id/analyze` - Análisis AI
- `POST /api/notifications/:id/sync-invento` - Sincronizar con Invento

### Configuración AI
- `GET /api/users/:id/ai-settings` - Obtener configuración AI
- `PUT /api/users/:id/ai-settings` - Actualizar proveedor y API key

### Agentes
- `POST /api/agent/heartbeat` - Heartbeat del agente
- `POST /api/agent/log` - Enviar log
- `POST /api/agent/notification` - Subir notificación

### Integraciones
- `GET /api/integrations/microsoft/auth-url` - URL OAuth Microsoft
- `GET /api/integrations/microsoft/calendar` - Eventos calendario
- `GET /api/integrations/invento/cases` - Buscar expedientes

## Roles de Usuario
- **ADMIN**: Acceso completo, gestión de usuarios, logs de auditoría
- **LAWYER**: Gestión de notificaciones, análisis AI, sincronización
- **ASSISTANT**: Visualización y triage básico

## Environment Variables
- `DATABASE_URL` - Conexión PostgreSQL (automático en Replit)
- `SESSION_SECRET` - Secreto para sesiones (auto-generado)
- `GEMINI_API_KEY` - API key de Google Gemini (opcional global)
- `AI_INTEGRATIONS_OPENAI_*` - Keys OpenAI via Replit (opcional)
- `MICROSOFT_CLIENT_ID` - App ID Azure para Graph
- `MICROSOFT_CLIENT_SECRET` - Secret Azure
- `INVENTO_API_URL` - URL API de Invento
- `INVENTO_API_KEY` - API key global de Invento (opcional)

## Running the Application
```bash
npm run dev      # Desarrollo (backend + frontend)
npm run build    # Build producción
npm run start    # Producción
npm run db:push  # Sincronizar schema DB
```

## Recent Changes
- 2024-12-20: Refactorización arquitectónica mayor
  - Sistema de invitación/aprobación para registro de usuarios (inviteCode o joinCode)
  - IA configurada a nivel de oficina (aiProvider, aiSecretKeyName en tabla offices)
  - Nuevo enum notification_status: EXTRACTED, TRIAGE_REQUIRED, TRIAGED, PLAN_DRAFTED, PLAN_APPROVED, EXECUTED, EXECUTION_FAILED, CANCELLED_MANUAL
  - Nuevo enum package_source: AGENT, MANUAL_UPLOAD
  - Nueva tabla case_matches para propuestas de expedientes Invento
  - Nueva tabla external_downloads para tracking de descargas externas
  - Nueva tabla user_invitations para sistema de invitaciones
  - Endpoint de aprobación de usuarios: POST /api/users/:id/approve (ADMIN)
  - Dashboard actualizado con métricas "executed" en lugar de "synced"

- 2024-12-15: Implementación completa
  - PostgreSQL con Drizzle ORM
  - Autenticación con roles (ADMIN/LAWYER/ASSISTANT)
  - Servicio AI dual (Gemini + OpenAI) con selección por usuario
  - Integración Microsoft Graph (OAuth, calendario, email)
  - Integración API Invento (expedientes, sincronización)
  - Arquitectura del agente RPA documentada
  - Login/Settings screens
  - Logs de auditoría
