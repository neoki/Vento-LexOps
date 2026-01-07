# Vento LexOps Agent - Documentación Técnica Completa

## Índice

1. [Filosofía del Agente](#filosofía-del-agente)
2. [Arquitectura de Componentes](#arquitectura-de-componentes)
3. [Flujo de Trabajo](#flujo-de-trabajo)
4. [Código por Módulo](#código-por-módulo)
5. [Seguridad](#seguridad)
6. [Instalación y Compilación](#instalación-y-compilación)
7. [Configuración](#configuración)
8. [Solución de Problemas](#solución-de-problemas)

---

## Filosofía del Agente

El agente de escritorio de Vento LexOps está diseñado bajo tres principios fundamentales:

### 1. Control del Usuario Primero

El agente **nunca descarga automáticamente** notificaciones de LexNET. Su función es:
- **Detectar** notificaciones pendientes
- **Avisar** al usuario de su existencia
- **Esperar** a que el usuario decida qué descargar

Esta filosofía respeta el principio legal de que el acceso a una notificación judicial inicia el cómputo de plazos procesales. El usuario debe tener control total sobre cuándo "abre" cada notificación.

### 2. Transparencia Total

Todas las acciones del agente son visibles:
- Icono permanente en la bandeja del sistema
- Menú contextual con estado en tiempo real
- Notificaciones toast informativas
- Logs detallados para auditoría

### 3. Mínima Intervención

El agente funciona en segundo plano sin interrumpir el trabajo:
- Revisiones silenciosas programadas
- Solo notifica cuando hay novedades
- No requiere ventanas permanentemente abiertas
- Consume recursos mínimos

---

## Arquitectura de Componentes

```
agent/
├── vento_agent.py          # Núcleo principal y coordinación
├── certificate_manager.py  # Gestión de certificados digitales
├── lexnet_automator.py     # Automatización del navegador
├── config_manager.py       # Persistencia de configuración
├── config_window.py        # Interfaz gráfica Tkinter
├── scheduler.py            # Programador de tareas
├── requirements.txt        # Dependencias Python
└── build.bat               # Script de compilación
```

### Diagrama de Interacción

```
┌─────────────────────────────────────────────────────────────────┐
│                        USUARIO                                   │
│  ┌─────────┐  ┌─────────────┐  ┌──────────────┐                │
│  │ Bandeja │  │ Menú        │  │ Ventana      │                │
│  │ Sistema │→ │ Contextual  │→ │ Pendientes   │                │
│  └─────────┘  └─────────────┘  └──────────────┘                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                     vento_agent.py                               │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │ Icono Tray │  │ Scheduler  │  │ Notifier   │                │
│  │ (pystray)  │  │            │  │ (toast)    │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└─────────────────────────────────────────────────────────────────┘
        ↓                  ↓                  ↓
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ certificate_  │  │ lexnet_       │  │ config_       │
│ manager.py    │  │ automator.py  │  │ manager.py    │
│               │  │               │  │               │
│ • Almacén Win │  │ • Selenium    │  │ • JSON files  │
│ • Archivos    │  │ • Edge/Chrome │  │ • %APPDATA%   │
│   .pfx/.p12   │  │ • LexNET DOM  │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
        ↓                  ↓
┌───────────────┐  ┌───────────────┐
│ PowerShell    │  │ Navegador     │
│ Cert:\        │  │ Edge/Chrome   │
│ CurrentUser   │  │ (headless)    │
└───────────────┘  └───────────────┘
```

---

## Flujo de Trabajo

### Flujo Principal

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. INICIO                                                        │
│    └── Cargar configuración desde %APPDATA%/VentoLexOps         │
│    └── Crear icono en bandeja del sistema                       │
│    └── Programar revisiones automáticas                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 2. REVISIÓN (automática o manual)                               │
│    └── Por cada cuenta LexNET configurada:                      │
│        ├── Abrir navegador Edge (perfil persistente)            │
│        ├── Navegar a LexNET                                     │
│        ├── Autenticar con certificado digital                   │
│        ├── Acceder a bandeja de entrada                         │
│        ├── Leer tabla de notificaciones (SIN descargar)         │
│        │   ├── Extraer: ID, juzgado, procedimiento, tipo        │
│        │   └── Detectar urgencia                                │
│        ├── Cerrar navegador                                     │
│        └── Acumular en lista de pendientes                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 3. NOTIFICACIÓN AL USUARIO                                      │
│    └── Si hay pendientes:                                       │
│        ├── Toast: "Hay X notificaciones pendientes"             │
│        └── Menú: "Ver pendientes (X)..." se habilita            │
│    └── Si no hay pendientes:                                    │
│        └── Toast: "No hay notificaciones nuevas"                │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 4. DECISIÓN DEL USUARIO                                         │
│    └── Clic derecho en icono → "Ver pendientes"                 │
│    └── Se abre ventana con lista de notificaciones              │
│        ├── Checkboxes para seleccionar                          │
│        ├── Información: juzgado, procedimiento, tipo            │
│        ├── Indicador de urgencia                                │
│        ├── Botón "Descargar seleccionadas"                      │
│        └── Botón "Posponer" (cerrar sin descargar)              │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ 5. DESCARGA (solo si el usuario lo solicita)                    │
│    └── Agrupar notificaciones por cuenta/certificado            │
│    └── Por cada grupo:                                          │
│        ├── Abrir navegador con certificado correspondiente      │
│        ├── Login en LexNET                                      │
│        ├── Por cada notificación seleccionada:                  │
│        │   ├── Acceder a la notificación                        │
│        │   ├── Descargar documentos                             │
│        │   └── Guardar en carpeta configurada                   │
│        └── Cerrar navegador                                     │
│    └── Actualizar lista de pendientes                           │
│    └── Notificar: "Descargadas X notificaciones"                │
└─────────────────────────────────────────────────────────────────┘
```

---

## Código por Módulo

### vento_agent.py - Núcleo Principal

Este es el punto de entrada del agente. Coordina todos los demás componentes.

#### Clase `VentoAgent`

```python
class VentoAgent:
    def __init__(self):
        self.config = ConfigManager()
        self.scheduler = Scheduler()
        self.pending_notifications: List[NotificationInfo] = []
        self.running = True
        self.last_sync: Optional[datetime] = None
        self.icon = None
```

#### Métodos Principales

| Método | Descripción |
|--------|-------------|
| `run()` | Inicia el agente y el icono de la bandeja |
| `build_menu()` | Construye el menú contextual dinámico |
| `on_check_notifications()` | Revisa notificaciones manualmente |
| `on_show_pending()` | Muestra ventana de pendientes |
| `check_all_accounts()` | Revisa todas las cuentas configuradas |
| `show_pending_window()` | Abre la ventana de selección |
| `download_selected_notifications()` | Descarga las seleccionadas |

#### Menú Dinámico

El menú usa funciones callable para actualizar valores en tiempo real:

```python
def build_menu(self):
    def get_pending_text(item):
        return f"Pendientes: {len(self.pending_notifications)}"
    
    def has_pending(item):
        return len(self.pending_notifications) > 0
    
    return pystray.Menu(
        item(get_status_text, None, enabled=False),
        item(get_pending_text, None, enabled=False),
        item(get_pending_button_text, self.on_show_pending, enabled=has_pending),
        # ...
    )
```

---

### certificate_manager.py - Gestión de Certificados

Maneja el acceso a certificados digitales del sistema operativo y archivos externos.

#### Clase `CertificateInfo`

Representa un certificado con sus propiedades:

```python
class CertificateInfo:
    thumbprint: str        # Huella digital SHA1
    subject: str           # CN del titular
    issuer: str            # Emisor (FNMT, ACA, etc.)
    valid_from: datetime   # Fecha inicio validez
    valid_to: datetime     # Fecha fin validez
    has_private_key: bool  # Si tiene clave privada
```

#### Propiedades Calculadas

```python
@property
def common_name(self) -> str:
    """Extrae el CN del subject: 'GARCIA LOPEZ MARIA - 12345678A'"""

@property
def is_valid(self) -> bool:
    """True si el certificado está vigente"""

@property
def issuer_type(self) -> str:
    """Detecta: FNMT, ACA, DNIe, Camerfirma, Otro"""
```

#### Métodos de Carga

**Desde el almacén de Windows (PowerShell):**

```python
def _load_windows_certificates(self) -> List[CertificateInfo]:
    ps_command = '''
    $certs = Get-ChildItem -Path Cert:\\CurrentUser\\My | 
             Where-Object { $_.HasPrivateKey }
    foreach ($cert in $certs) {
        @{
            Thumbprint = $cert.Thumbprint
            Subject = $cert.Subject
            Issuer = $cert.Issuer
            NotBefore = $cert.NotBefore.ToString('yyyy-MM-ddTHH:mm:ss')
            NotAfter = $cert.NotAfter.ToString('yyyy-MM-ddTHH:mm:ss')
        }
    } | ConvertTo-Json
    '''
    # Ejecuta PowerShell y parsea JSON
```

**Desde archivo .pfx/.p12:**

```python
def load_certificate_from_file(self, filepath: str, password: str) -> Tuple[bool, str]:
    """Carga certificado desde USB u otra ubicación"""
    from cryptography.hazmat.primitives.serialization import pkcs12
    
    with open(filepath, 'rb') as f:
        pfx_data = f.read()
    
    private_key, certificate, _ = pkcs12.load_key_and_certificates(
        pfx_data, password.encode(), default_backend()
    )
```

---

### lexnet_automator.py - Automatización de LexNET

Controla el navegador para acceder a LexNET y leer/descargar notificaciones.

#### Clase `NotificationInfo`

```python
class NotificationInfo:
    notification_id: str           # ID único de LexNET
    court: str                     # Juzgado/Tribunal
    procedure_number: str          # Número de procedimiento
    notification_type: str         # Providencia, Sentencia, etc.
    received_date: datetime        # Fecha de recepción
    is_urgent: bool                # Indicador de urgencia
    account_name: str              # Cuenta asociada
    certificate_thumbprint: str    # Certificado usado
```

#### Clase `LexNetAutomator`

**Configuración del navegador:**

```python
def setup_browser(self):
    options = EdgeOptions()
    
    # Perfil persistente para mantener sesión
    options.add_argument(f'--user-data-dir={self.user_data_dir}')
    
    # Configuración de descargas
    prefs = {
        'download.default_directory': str(self.download_folder),
        'download.prompt_for_download': False,
    }
    options.add_experimental_option('prefs', prefs)
    
    self.driver = webdriver.Edge(options=options)
```

**Detección de notificaciones (SIN descargar):**

```python
def get_pending_notifications(self) -> List[NotificationInfo]:
    """Lee la tabla de bandeja de entrada"""
    
    # Múltiples selectores para compatibilidad
    table_selectors = [
        "table tbody tr",
        "#tablaNotificaciones tbody tr",
        ".dataTables_wrapper tbody tr",
    ]
    
    for selector in table_selectors:
        rows = self.driver.find_elements(By.CSS_SELECTOR, selector)
        if rows:
            break
    
    for row in rows:
        # Extraer ID real de LexNET
        notification_id = self._extract_notification_id(row)
        
        # Parsear contenido de celdas
        cells = row.find_elements(By.TAG_NAME, "td")
        court = cells[0].text
        procedure = cells[1].text
        # ...
```

**Estrategia de extracción de IDs:**

```python
def _extract_notification_id(self, row):
    # 1. Atributo data-id
    data_id = row.get_attribute('data-id')
    if data_id:
        return data_id
    
    # 2. Patrón verNotificacion('12345')
    onclick = row.get_attribute('onclick') or ''
    match = re.search(r"verNotificacion\s*\(\s*['\"]?(\d+)['\"]?\s*\)", onclick)
    if match:
        return f"LEXNET-{match.group(1)}"
    
    # 3. Enlaces con id=
    for link in row.find_elements(By.TAG_NAME, "a"):
        href = link.get_attribute('href') or ''
        match = re.search(r'[?&]id[=](\d+)', href)
        if match:
            return f"LEXNET-{match.group(1)}"
    
    # 4. Fallback: hash estable del contenido
    stable_text = normalize_text(row.text)
    return f"LEXNET-HASH-{hashlib.md5(stable_text.encode()).hexdigest()[:12]}"
```

---

### config_manager.py - Persistencia

Almacena configuración en `%APPDATA%/VentoLexOps/`.

#### Estructura de Archivos

```
%APPDATA%/VentoLexOps/
├── config.json           # Configuración general
├── accounts.json         # Cuentas LexNET
├── EdgeProfile/          # Perfil del navegador
└── logs/                 # Logs de ejecución
```

#### config.json

```json
{
  "download_folder": "C:\\Users\\Usuario\\Documents\\LexNET",
  "check_interval_minutes": 30,
  "auto_start": true,
  "server_url": "https://tu-servidor.replit.app"
}
```

#### accounts.json

```json
[
  {
    "name": "Despacho Principal",
    "certificate_thumbprint": "A1B2C3D4...",
    "certificate_file": null,
    "certificate_password": null,
    "enabled": true
  },
  {
    "name": "Certificado USB",
    "certificate_thumbprint": null,
    "certificate_file": "E:\\certs\\abogado.pfx",
    "certificate_password": "***",
    "enabled": true
  }
]
```

---

### config_window.py - Interfaz Gráfica

Ventanas Tkinter para configuración y gestión.

#### Ventana de Configuración

```python
def open_config_window(config_manager: ConfigManager):
    root = tk.Tk()
    root.title("Vento LexOps - Configuración")
    
    # Carpeta de descargas
    folder_frame = ttk.LabelFrame(root, text="Carpeta de descargas")
    folder_entry = ttk.Entry(folder_frame)
    browse_btn = ttk.Button(folder_frame, text="Examinar...", 
                            command=lambda: browse_folder())
    
    # Intervalo de revisión
    interval_frame = ttk.LabelFrame(root, text="Revisión automática")
    interval_spinbox = ttk.Spinbox(interval_frame, from_=5, to=120)
```

#### Ventana de Notificaciones Pendientes

```python
def show_pending_window(notifications: List[NotificationInfo], 
                        on_download: Callable, on_close: Callable):
    root = tk.Tk()
    root.title("Notificaciones Pendientes")
    
    # Lista con checkboxes
    for notif in notifications:
        var = tk.BooleanVar(value=True)
        cb = ttk.Checkbutton(
            frame, 
            text=f"{notif.court} - {notif.procedure_number}",
            variable=var
        )
        
        # Indicador de urgencia
        if notif.is_urgent:
            urgent_label = ttk.Label(frame, text="⚠ URGENTE", 
                                     foreground="red")
    
    # Botones de acción
    download_btn = ttk.Button(root, text="Descargar seleccionadas",
                              command=on_download)
    postpone_btn = ttk.Button(root, text="Posponer",
                              command=on_close)
```

---

### scheduler.py - Programador de Tareas

Programa revisiones automáticas.

```python
class Scheduler:
    def __init__(self):
        self.interval_minutes = 30
        self.fixed_times: List[str] = []  # ["09:00", "14:00"]
        self.running = False
        self._thread: Optional[threading.Thread] = None
    
    def start(self, callback: Callable):
        """Inicia el programador en un thread separado"""
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, 
                                         args=(callback,), daemon=True)
        self._thread.start()
    
    def _run_loop(self, callback):
        while self.running:
            if self._should_run_now():
                callback()
            time.sleep(60)  # Comprobar cada minuto
```

---

## Seguridad

### Gestión de Certificados

- **Sin almacenamiento de contraseñas**: Las contraseñas de certificados .pfx no se guardan de forma persistente
- **Acceso mínimo**: Solo se accede al almacén de certificados cuando es necesario
- **PowerShell seguro**: Se usa `-NoProfile` para evitar cargar scripts externos

### Sesión de LexNET

- **Perfil persistente**: El navegador mantiene la sesión para evitar re-autenticaciones
- **Sin credenciales**: El agente no almacena usuario/contraseña de LexNET
- **Aislamiento**: Cada cuenta usa su propia instancia del navegador

### Comunicación con Servidor

```python
# Heartbeat seguro
def send_heartbeat(self, server_url: str, agent_id: str):
    response = requests.post(
        f"{server_url}/api/agent/heartbeat",
        json={
            "agentId": agent_id,
            "status": "ACTIVE",
            "lastSync": self.last_sync.isoformat()
        },
        timeout=10
    )
```

### Logs

- Los logs no contienen información sensible
- Se almacenan localmente en `%APPDATA%/VentoLexOps/logs/`
- Rotación automática para evitar crecimiento excesivo

---

## Instalación y Compilación

### Requisitos Previos

- Windows 10/11
- Python 3.10+
- Microsoft Edge o Google Chrome
- PowerShell 5.0+ (incluido en Windows)

### Instalación de Dependencias

```batch
cd agent
pip install -r requirements.txt
```

### Compilación del Ejecutable

```batch
cd agent
build.bat
```

El script `build.bat`:

```batch
@echo off
echo Instalando dependencias...
pip install -r requirements.txt
pip install pyinstaller

echo Compilando ejecutable...
python -m PyInstaller --onefile --windowed --icon=icon.ico ^
    --name VentoLexOpsAgent ^
    --add-data "icon.ico;." ^
    --hidden-import=win32timezone ^
    vento_agent.py

echo Ejecutable creado en dist\VentoLexOpsAgent.exe
```

### Distribución

El ejecutable compilado se puede distribuir a los usuarios:
1. Copiar `dist/VentoLexOpsAgent.exe` a la carpeta del usuario
2. Crear acceso directo en Inicio para auto-arranque
3. El agente crea su configuración en el primer arranque

---

## Configuración

### Primera Ejecución

1. Ejecutar `VentoLexOpsAgent.exe`
2. Clic derecho en icono de bandeja → "Configuración"
3. Configurar:
   - Carpeta de descargas
   - Intervalo de revisión
   - Cuentas LexNET (certificados)

### Añadir Cuenta con Certificado del Sistema

1. Configuración → Cuentas → Añadir
2. Seleccionar "Usar certificado del almacén de Windows"
3. Elegir el certificado de la lista
4. Guardar

### Añadir Cuenta con Archivo .pfx/.p12

1. Configuración → Cuentas → Añadir
2. Seleccionar "Usar archivo de certificado"
3. Examinar y seleccionar el archivo .pfx o .p12
4. Introducir contraseña del certificado
5. Guardar

---

## Solución de Problemas

### El agente no encuentra certificados

**Causa**: PowerShell no puede acceder al almacén de certificados.

**Solución**:
1. Abrir PowerShell como administrador
2. Ejecutar: `Get-ChildItem -Path Cert:\CurrentUser\My`
3. Si no aparecen certificados, instalarlos desde el panel de control

### "Revisar notificaciones" no detecta nada

**Causa**: El navegador no puede acceder a LexNET o la sesión expiró.

**Solución**:
1. Ejecutar una revisión manual
2. Si aparece el diálogo de certificado, seleccionar el correcto
3. Verificar que la URL de LexNET es accesible

### El menú "Ver pendientes" está deshabilitado

**Causa**: No hay notificaciones pendientes detectadas.

**Solución**:
1. Pulsar "Revisar notificaciones" para forzar una revisión
2. Esperar a que termine (puede tardar 30-60 segundos)
3. Si hay notificaciones, el menú se habilitará

### Error de compilación con PyInstaller

**Causa**: Dependencias no instaladas o incompatibles.

**Solución**:
```batch
pip uninstall pyinstaller
pip install pyinstaller --upgrade
python -m PyInstaller --onefile vento_agent.py
```

### El navegador no se cierra correctamente

**Causa**: Selenium no puede terminar el proceso del navegador.

**Solución**:
1. Cerrar manualmente los procesos de Edge/Chrome
2. Eliminar la carpeta `%APPDATA%/VentoLexOps/EdgeProfile`
3. Reiniciar el agente

---

## Historial de Versiones

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0.0 | 2025-01-04 | Versión inicial con detección sin descarga |
| 1.0.1 | 2025-01-07 | PowerShell para certificados, IDs estables |

---

## Contacto y Soporte

Para soporte técnico o reportar problemas:
- Crear issue en el repositorio del proyecto
- Incluir logs de `%APPDATA%/VentoLexOps/logs/`
