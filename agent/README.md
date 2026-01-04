# Vento LexOps Agent

Agente de escritorio Windows para la descarga automática de notificaciones de LexNET.

## Características

- **Icono en bandeja del sistema**: Funciona en segundo plano sin molestar
- **Descarga automática**: Sincroniza notificaciones según intervalo configurado
- **Múltiples certificados**: Soporta varios abogados con diferentes certificados
- **Notificaciones**: Avisa cuando hay nuevas notificaciones descargadas
- **Navegador headless**: No abre ventanas visibles del navegador

## Requisitos

- Windows 10 / 11 (64-bit)
- Python 3.10 o superior
- Microsoft Edge o Google Chrome instalado
- Certificados digitales instalados (FNMT, ACA, DNIe)

## Instalación

### Opción 1: Ejecutar desde código fuente

```bash
# Instalar dependencias
pip install -r requirements.txt

# Ejecutar
python vento_agent.py
```

### Opción 2: Generar ejecutable

```bash
# Instalar PyInstaller
pip install pyinstaller

# Generar .exe
pyinstaller --onefile --windowed --icon=vento.ico --name=VentoLexOps vento_agent.py
```

El ejecutable se generará en la carpeta `dist/`.

### Opción 3: Descargar desde la plataforma (recomendado para usuarios)

1. Inicia sesión en Vento LexOps
2. Ve a **Configuración** → **Agente Desktop**
3. Haz clic en **Descargar VentoLexOps.exe**

## Distribución del ejecutable

Para que los usuarios puedan descargar el agente desde la plataforma:

1. Compila el ejecutable en Windows con `build.bat`
2. Copia `dist/VentoLexOps.exe` a `public/downloads/VentoLexOps.exe` en el servidor
3. Actualiza `public/downloads/version.json` con la nueva versión:

```json
{
  "version": "1.0.0",
  "releaseDate": "2025-01-04",
  "changelog": [
    "Primera versión del agente"
  ]
}
```

La plataforma mostrará automáticamente el enlace de descarga cuando el archivo esté disponible.

## Uso

1. **Primera ejecución**: El agente aparecerá como icono en la bandeja del sistema (junto al reloj)
2. **Configurar**: Haz clic derecho en el icono → "Configuración..."
3. **Añadir cuentas**: En la pestaña "Cuentas/Certificados" añade los certificados a usar
4. **Carpeta de descargas**: Elige dónde guardar las notificaciones
5. **Intervalo**: Define cada cuántos minutos sincronizar (mínimo 5 min)

## Menú del icono

- **Estado**: Muestra si está activo o pausado
- **Última sync**: Hora de la última sincronización
- **Nuevas**: Número de notificaciones nuevas descargadas
- **Sincronizar ahora**: Fuerza una sincronización inmediata
- **Configuración**: Abre la ventana de opciones
- **Ver carpeta**: Abre la carpeta de descargas
- **Pausar/Reanudar**: Pausa la sincronización automática
- **Salir**: Cierra el agente

## Estructura de descargas

Las notificaciones se organizan por fecha:

```
VentoLexNet/
├── 2024-01-15/
│   ├── Juzgado Primera Instancia 5 Madrid_1234-2024/
│   │   ├── metadata.json
│   │   ├── NOTIFICACION.txt
│   │   └── [documentos adjuntos]
│   └── ...
├── 2024-01-16/
│   └── ...
```

## Configuración avanzada

El archivo de configuración se guarda en:
`%APPDATA%\VentoLexOps\config.json`

```json
{
  "download_folder": "C:\\Users\\Usuario\\VentoLexNet",
  "sync_interval_minutes": 30,
  "headless": true,
  "auto_start": true,
  "accounts": [
    {
      "name": "María García",
      "certificate_thumbprint": "A1B2C3...",
      "enabled": true
    }
  ]
}
```

## Solución de problemas

### El navegador no inicia
- Asegúrate de tener Edge o Chrome instalado
- Descarga el driver correspondiente: [Edge WebDriver](https://developer.microsoft.com/en-us/microsoft-edge/tools/webdriver/) o [ChromeDriver](https://chromedriver.chromium.org/)

### No encuentra los certificados
- Asegúrate de que el certificado está instalado en el almacén "Personal" del usuario actual
- El certificado debe tener la clave privada asociada

### Error de conexión a LexNET
- Verifica tu conexión a internet
- LexNET puede tener mantenimiento programado

## Logs

Los logs se guardan en `vento_agent.log` junto al ejecutable.

## Licencia

Propiedad de Vento Legal Tech.
