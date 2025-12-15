# Vento LexOps - Arquitectura del Agente RPA

## Visión General

El Agente RPA de Vento LexOps es una aplicación de escritorio que se ejecuta en equipos Windows con acceso a LexNET. Su función principal es automatizar la descarga de notificaciones judiciales utilizando certificados digitales para la autenticación.

## Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                     VENTO CLOUD (Backend)                        │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────────┐ │
│  │ API Server  │  │  PostgreSQL  │  │  AI Analysis Service    │ │
│  │ (Express)   │  │  (Neon)      │  │  (Gemini/OpenAI)        │ │
│  └──────┬──────┘  └──────────────┘  └─────────────────────────┘ │
│         │                                                        │
│         │ HTTPS/TLS                                              │
└─────────┼────────────────────────────────────────────────────────┘
          │
          │ Túnel Seguro
          │
┌─────────┴────────────────────────────────────────────────────────┐
│                    AGENTE DESKTOP (Windows)                       │
│  ┌─────────────────┐  ┌───────────────┐  ┌───────────────────┐  │
│  │ Agent Service   │  │ Certificate   │  │ LexNET Automator  │  │
│  │ (Python/.NET)   │  │ Manager       │  │ (Selenium/RPA)    │  │
│  └─────────────────┘  └───────────────┘  └───────────────────┘  │
│           │                   │                    │             │
│           │                   │                    │             │
│  ┌────────┴───────────────────┴────────────────────┴──────────┐ │
│  │              Windows Certificate Store (MSCAPI)             │ │
│  │              Certificados FNMT / DNIe                       │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

## Componentes del Agente

### 1. Agent Service (Servicio Principal)

Responsable de la comunicación con Vento Cloud y la orquestación de tareas.

```python
# Ejemplo de estructura del agente
class VentoAgent:
    def __init__(self):
        self.agent_id = self.generate_agent_id()
        self.api_base = os.getenv('VENTO_API_URL')
        self.heartbeat_interval = 30  # segundos
        
    async def start(self):
        """Inicia el ciclo principal del agente"""
        await self.register()
        while True:
            command = await self.heartbeat()
            if command == 'SYNC_LEXNET':
                await self.sync_lexnet()
            await asyncio.sleep(self.heartbeat_interval)
    
    async def heartbeat(self):
        """Envía heartbeat y recibe comandos"""
        response = await self.api_post('/api/agent/heartbeat', {
            'agentId': self.agent_id,
            'hostInfo': self.get_host_info()
        })
        return response.get('command', 'IDLE')
    
    async def log(self, level, message, context=None):
        """Envía log al servidor"""
        await self.api_post('/api/agent/log', {
            'agentId': self.agent_id,
            'level': level,
            'message': message,
            'context': context
        })
```

### 2. Certificate Manager

Gestiona el acceso a los certificados digitales almacenados en Windows.

```python
# Acceso a certificados con pywin32
import win32crypt
import win32security

class CertificateManager:
    def __init__(self):
        self.store_name = "MY"  # Almacén personal
        
    def list_certificates(self):
        """Lista todos los certificados disponibles"""
        store = win32crypt.CertOpenStore(
            win32crypt.CERT_STORE_PROV_SYSTEM,
            0,
            None,
            win32crypt.CERT_SYSTEM_STORE_CURRENT_USER,
            self.store_name
        )
        # ...
        
    def get_certificate_by_thumbprint(self, thumbprint):
        """Obtiene un certificado específico"""
        # ...
        
    def sign_request(self, data, thumbprint):
        """Firma datos con el certificado seleccionado"""
        # ...
```

### 3. LexNET Automator

Automatiza la interacción con el portal de LexNET.

```python
from selenium import webdriver
from selenium.webdriver.common.by import By

class LexNetAutomator:
    def __init__(self, certificate_thumbprint):
        self.certificate = certificate_thumbprint
        self.driver = None
        
    def setup_browser(self):
        """Configura el navegador con soporte de certificados"""
        options = webdriver.EdgeOptions()
        # Configurar Edge para usar certificado del sistema
        self.driver = webdriver.Edge(options=options)
        
    async def login(self):
        """Inicia sesión en LexNET con certificado"""
        self.driver.get("https://lexnet.justicia.es")
        # Seleccionar autenticación con certificado
        # El navegador mostrará el diálogo de selección de certificado
        
    async def get_new_notifications(self):
        """Obtiene nuevas notificaciones pendientes"""
        # Navegar a bandeja de entrada
        # Parsear tabla de notificaciones
        # Devolver lista de notificaciones nuevas
        
    async def download_notification(self, notification_id):
        """Descarga una notificación específica"""
        # Acceder a la notificación
        # Descargar documentos adjuntos
        # Firmar acuse de recibo
        # Devolver payload con contenido
```

## Flujo de Trabajo

1. **Inicio del Agente**
   - El agente se inicia como servicio de Windows
   - Se registra con el servidor Vento Cloud
   - Inicia el ciclo de heartbeat

2. **Sincronización con LexNET**
   - El servidor envía comando `SYNC_LEXNET`
   - El agente abre navegador con certificado
   - Inicia sesión en LexNET
   - Descarga notificaciones nuevas
   - Sube contenido al servidor Vento

3. **Procesamiento en Cloud**
   - El servidor recibe la notificación
   - Ejecuta análisis con IA (Gemini/GPT)
   - Extrae plazos y clasifica documento
   - Añade a bandeja de triage

## Seguridad

### Autenticación del Agente

```typescript
// El agente se autentica con un token de dispositivo
interface AgentCredentials {
  agentId: string;           // Identificador único del agente
  deviceToken: string;       // Token generado durante el emparejamiento
  certificateThumbprint: string; // Huella del certificado usado
}
```

### Emparejamiento Seguro

1. Usuario inicia emparejamiento desde la web
2. Sistema genera código de 6 dígitos temporal
3. Usuario introduce código en agente desktop
4. Servidor valida código y genera token permanente
5. Agente almacena token de forma segura (DPAPI)

### Comunicación Segura

- Todas las comunicaciones via HTTPS/TLS 1.3
- Certificado SSL validado en ambos extremos
- Headers de autenticación en cada request
- Rate limiting para prevenir abusos

## Requisitos del Sistema

### Mínimos
- Windows 10/11 (64-bit)
- .NET 6.0 Runtime o Python 3.10+
- Microsoft Edge (Chromium)
- Certificado digital instalado (FNMT, DNIe)
- Conexión a Internet estable

### Recomendados
- 4GB RAM
- SSD para almacenamiento temporal
- Conexión de 10 Mbps o superior

## Configuración

### Variables de Entorno del Agente

```env
VENTO_API_URL=https://your-vento-instance.replit.app
VENTO_AGENT_ID=AGENT-WS-01
VENTO_DEVICE_TOKEN=xxx-xxx-xxx
CERTIFICATE_THUMBPRINT=A1B2C3D4...
POLLING_INTERVAL=30
LOG_LEVEL=INFO
```

### Archivo de Configuración

```json
{
  "agent": {
    "id": "AGENT-WS-01",
    "name": "Ordenador Despacho Principal"
  },
  "lexnet": {
    "accounts": [
      {
        "id": "cuenta1",
        "certificateThumbprint": "A1B2C3D4...",
        "description": "Procurador García"
      }
    ]
  },
  "sync": {
    "intervalMinutes": 15,
    "autoDownload": true,
    "autoReceipt": false
  }
}
```

## API del Agente

### POST /api/agent/heartbeat
Envía señal de vida y recibe comandos.

### POST /api/agent/log
Envía logs al servidor.

### POST /api/agent/notification
Sube una notificación descargada de LexNET.

### GET /api/agent/config
Obtiene configuración remota del agente.

## Manejo de Errores

El agente implementa reintentos exponenciales para errores de red:

```python
async def retry_with_backoff(func, max_retries=5):
    for attempt in range(max_retries):
        try:
            return await func()
        except NetworkError:
            wait_time = 2 ** attempt  # 1, 2, 4, 8, 16 segundos
            await asyncio.sleep(wait_time)
            await log('WARN', f'Reintentando tras {wait_time}s')
    raise MaxRetriesExceeded()
```

## Logs y Monitorización

Todos los logs se envían al servidor y se pueden visualizar en tiempo real desde el dashboard de Vento LexOps.

Niveles de log:
- `DEBUG`: Información detallada de depuración
- `INFO`: Operaciones normales
- `WARN`: Situaciones anómalas no críticas
- `ERROR`: Errores que impiden operaciones
- `FATAL`: Errores críticos que detienen el agente
