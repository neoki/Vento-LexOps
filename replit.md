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
├── agent/                 # Agente de escritorio Windows para LexNET
│   ├── vento_agent.py     # Aplicación principal con icono en bandeja
│   ├── config_manager.py  # Gestión de configuración persistente
│   ├── certificate_manager.py # Acceso a certificados de Windows
│   ├── lexnet_automator.py    # Automatización Selenium de LexNET
│   ├── scheduler.py       # Programador de tareas
│   ├── config_window.py   # Ventana de configuración Tkinter
│   ├── requirements.txt   # Dependencias Python
│   └── build.bat          # Script para generar ejecutable
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
- `GET /api/integrations/invento/status` - Estado conexión Invento
- `POST /api/integrations/invento/test` - Probar conexión Invento
- `GET /api/integrations/invento/expedientes?q=texto` - Buscar expedientes en Vento API
- `GET /api/integrations/invento/expediente/:id` - Obtener expediente por ID

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
- 2025-01-04: Agente de escritorio Windows para LexNET
  - **Agente Desktop** (agent/):
    - Aplicación Python con icono en bandeja del sistema (pystray)
    - Sincronización automática programable (cada X minutos)
    - Soporte para múltiples certificados digitales (FNMT, ACA, DNIe)
    - Navegador headless Edge/Chrome con Selenium
    - Carpeta de descargas configurable por la gestora
    - Notificaciones toast cuando hay nuevas descargas
    - Ventana de configuración Tkinter (carpeta, intervalo, cuentas)
    - Script build.bat para generar ejecutable .exe con PyInstaller
    - Perfil persistente de navegador para mantener sesión
  - **Componentes**:
    - vento_agent.py: Aplicación principal con menú de bandeja
    - config_manager.py: Persistencia en %APPDATA%/VentoLexOps
    - certificate_manager.py: Acceso al almacén de certificados de Windows
    - lexnet_automator.py: Automatización con Selenium + pyautogui
    - scheduler.py: Programador de tareas por intervalo o hora fija
    - config_window.py: GUI Tkinter para configuración

- 2025-01-02: Sistema de gestión de despacho y mejoras operativas
  - **Panel Air Traffic Control** (screens/AirTrafficControl.tsx):
    - Vista en tiempo real de todos los abogados con indicadores de carga (LOW/NORMAL/HIGH/CRITICAL)
    - Monitoreo de notificaciones pendientes, plazos urgentes y tareas vencidas
    - Alertas de "Regla de 3 Días" integradas
    - Acceso rápido a gestión de abogados
  - **Gestión de Letrados** (screens/LawyerManagement.tsx):
    - CRUD completo con colores corporativos (15 preset + selector personalizado)
    - Tipos de certificado digital (ACA/FNMT/Otros)
    - Asignación a equipos
    - Endpoints: GET/POST/PUT/DELETE /api/manager/lawyers
  - **Dashboard Simplificado Letrado** (screens/LawyerDashboard.tsx):
    - Vista personal: "Mis Vencimientos" + "Mis Notificaciones Pendientes"
    - Endpoints: GET /api/lawyer/stats, /api/lawyer/deadlines, /api/lawyer/notifications/pending
  - **Regla de los 3 Días** (server/three-day-rule-service.ts):
    - Alertas escalonadas: WARNING (<48h), URGENT (<24h), CRITICAL (<6h)
    - Generación de emails HTML con urgencia
    - Endpoint: GET /api/alerts/three-day-rule
  - **Retro-planning Señalamientos** (server/hearing-tasks-service.ts):
    - Tareas automáticas: T-1.5m, T-1m, T-15d antes de vista
    - Templates configurables por tipo de procedimiento
    - Endpoint: POST /api/hearings/:notificationId/generate-tasks
  - **Parser LexNET** (server/lexnet-parser.ts):
    - Extracción de juzgado, tipo procedimiento, año, número autos, NIG
    - Soporte para todos los tipos de órganos judiciales españoles
  - **Newsletter Diaria** (server/daily-newsletter-service.ts):
    - Resumen codificado por colores de abogado
    - Adjunto ZIP con paquetes del día
    - Endpoints: GET /api/newsletter/preview, POST /api/newsletter/generate
  - **Cola OCR Prioritaria** (server/ocr-queue-service.ts):
    - Detección de PDFs "imagen plana" sin texto extraíble
    - Cola priorizada por urgencia
    - Endpoints: GET /api/ocr/queue, POST /api/ocr/detect/:packageId
  - **Sincronización Outlook** (server/calendar-sync-service.ts):
    - Eventos "Todo el día" con categorías de color
    - Estado GRIS para tareas completadas
    - Auditoría de plazos vencidos con justificación obligatoria
    - Endpoints: GET /api/calendar/events, POST /api/tasks/:taskId/complete, POST /api/tasks/:taskId/justify, GET /api/audit/missed-deadlines

- 2024-12-29: Implementación completa del procedimiento LexNET automatizado
  - **Motor de plazos procesales** (server/deadline-calculator.ts):
    - Cálculo de días hábiles excluyendo fines de semana, festivos y agosto
    - Día de gracia hasta las 15:00:59h del siguiente día hábil (LEC art. 135.1)
    - Integración con tabla holidays para festivos por oficina
    - Alertas automáticas 24-48h antes de vencimientos
  - **Sistema de alertas** (server/alert-service.ts):
    - Generación de alertas pendientes basada en plazos próximos
    - Templates HTML para emails de alerta con niveles de urgencia
    - Integración preparada para Microsoft Graph
    - Endpoints: GET /api/alerts/pending, GET /api/alerts/summary
  - **Protocolo ACCEDA** (server/acceda-service.ts):
    - Detección automática de documentos >10 MB
    - Instrucciones paso a paso para presentación vía ACCEDA-Justicia
    - Generación de informes texto y JSON
    - Endpoints: GET /api/acceda/analyze/:packageId, GET /api/acceda/pending
  - **Validación documental** (server/document-validation.ts):
    - Verificación PDF/A y detección de documentos sin OCR
    - Detección de duplicados por hash
    - Informes de validación por paquete
    - Endpoints: GET /api/validation/package/:packageId, GET /api/validation/duplicates
  - **Calendar View mejorado** (screens/CalendarView.tsx):
    - Muestra día de gracia en tooltip
    - Indicadores de urgencia para plazos próximos
    - Contador de días hábiles restantes

- 2024-12-23: Integración API Vento (Invento) completa
  - Cliente invento-api.ts reescrito para usar API real de Vento (ventoapi.vento.es)
  - Endpoints: /api/Presupuesto/Buscar, /api/FileManager/file-manager-file-system-scripts
  - executeAction() en execution-plan-service.ts conectado a cliente real
  - UPLOAD_INVENTO ejecuta subida real de documentos a expedientes
  - Configuración de Invento por oficina (offices.inventoApiUrl, offices.inventoSecretKeyName)
  - Nuevos endpoints: GET /api/integrations/invento/expedientes, POST /api/integrations/invento/test

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
