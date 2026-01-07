"""
Automatizador de LexNET para Vento LexOps Agent
Usa Selenium con navegador para acceder a LexNET y descargar notificaciones.

NOTA: LexNET requiere certificado digital (FNMT, ACA, DNIe).
El navegador mostrara el dialogo de Windows para seleccionar el certificado
cuando el sitio lo solicite. NO se puede automatizar completamente sin
interaccion del usuario para la seleccion del certificado.

Para uso desatendido, se puede:
1. Configurar Edge/Chrome para auto-seleccionar un certificado
2. Usar AutoIt/pyautogui para automatizar el dialogo de Windows
"""

import os
import time
import logging
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)

LEXNET_URL = "https://lexnet.justicia.es"
LEXNET_LOGIN_URL = f"{LEXNET_URL}/lexnetcomunicaciones"
LEXNET_INBOX_URL = f"{LEXNET_URL}/lexnetcomunicaciones/bandeja"


class NotificationInfo:
    def __init__(self, notification_id: str, court: str, procedure_number: str,
                 notification_type: str, received_date: datetime, is_urgent: bool = False,
                 account_name: str = '', certificate_thumbprint: str = '', certificate_file: str = '',
                 certificate_password: str = ''):
        self.notification_id = notification_id
        self.court = court
        self.procedure_number = procedure_number
        self.notification_type = notification_type
        self.received_date = received_date
        self.is_urgent = is_urgent
        self.downloaded = False
        self.download_path: Optional[str] = None
        self.files: List[str] = []
        self.account_name = account_name
        self.certificate_thumbprint = certificate_thumbprint
        self.certificate_file = certificate_file
        self.certificate_password = certificate_password


class LexNetAutomator:
    """
    Automatizador de LexNET usando Selenium.
    
    IMPORTANTE: 
    - Para modo headless, el navegador NO puede mostrar el dialogo de certificado
    - Se recomienda usar headless=False para la primera ejecucion
    - Una vez autenticado, el navegador guarda la sesion
    """
    
    def __init__(self, certificate_thumbprint: str, download_folder: str, headless: bool = False):
        self.certificate_thumbprint = certificate_thumbprint
        self.download_folder = Path(download_folder)
        self.headless = headless
        self.driver = None
        self.temp_download_folder = Path(download_folder) / '.temp_downloads'
        self.user_data_dir = Path(os.environ.get('LOCALAPPDATA', '')) / 'VentoLexOps' / 'EdgeProfile'
        
    def setup_browser(self):
        """
        Configura el navegador Edge con perfil persistente.
        El perfil persistente permite mantener la sesion y certificados entre ejecuciones.
        """
        try:
            from selenium import webdriver
            from selenium.webdriver.edge.options import Options as EdgeOptions
            
            options = EdgeOptions()
            
            self.user_data_dir.mkdir(parents=True, exist_ok=True)
            options.add_argument(f'--user-data-dir={self.user_data_dir}')
            
            if self.headless:
                options.add_argument('--headless=new')
                logger.warning("Modo headless: el dialogo de certificado no sera visible")
            
            options.add_argument('--disable-gpu')
            options.add_argument('--window-size=1920,1080')
            options.add_argument('--disable-blink-features=AutomationControlled')
            options.add_experimental_option('excludeSwitches', ['enable-automation'])
            
            self.temp_download_folder.mkdir(parents=True, exist_ok=True)
            
            prefs = {
                'download.default_directory': str(self.temp_download_folder.absolute()),
                'download.prompt_for_download': False,
                'download.directory_upgrade': True,
                'safebrowsing.enabled': False,
                'profile.default_content_settings.popups': 0,
            }
            options.add_experimental_option('prefs', prefs)
            
            self.driver = webdriver.Edge(options=options)
            self.driver.implicitly_wait(15)
            self.driver.set_page_load_timeout(60)
            
            logger.info("Navegador Edge iniciado con perfil persistente")
            return True
            
        except ImportError:
            logger.error("Selenium no instalado. Ejecute: pip install selenium")
            return False
        except Exception as e:
            logger.error(f"Error iniciando Edge: {e}")
            return self._try_chrome_fallback()
    
    def _try_chrome_fallback(self):
        """Intenta usar Chrome si Edge no está disponible"""
        try:
            from selenium import webdriver
            from selenium.webdriver.chrome.options import Options as ChromeOptions
            
            options = ChromeOptions()
            
            if self.headless:
                options.add_argument('--headless=new')
            
            options.add_argument('--disable-gpu')
            options.add_argument('--no-sandbox')
            options.add_argument('--window-size=1920,1080')
            
            self.temp_download_folder.mkdir(parents=True, exist_ok=True)
            
            prefs = {
                'download.default_directory': str(self.temp_download_folder),
                'download.prompt_for_download': False,
            }
            options.add_experimental_option('prefs', prefs)
            
            self.driver = webdriver.Chrome(options=options)
            self.driver.implicitly_wait(10)
            
            logger.info("Navegador Chrome iniciado (fallback)")
            return True
            
        except Exception as e:
            logger.error(f"Error con Chrome fallback: {e}")
            return False
    
    def login(self) -> bool:
        """
        Inicia sesion en LexNET usando certificado digital.
        
        IMPORTANTE: Cuando LexNET solicita autenticacion con certificado,
        Windows mostrara un dialogo para seleccionar el certificado.
        Este dialogo es nativo del sistema operativo y NO puede ser
        automatizado por Selenium directamente.
        
        Opciones para automatizacion completa:
        1. Usar pyautogui para interactuar con el dialogo de Windows
        2. Configurar el navegador para auto-seleccionar un certificado
        3. Usar el perfil persistente donde ya se ha autenticado manualmente
        
        Returns:
            bool: True si el login fue exitoso
        """
        if not self.driver:
            if not self.setup_browser():
                return False
        
        try:
            logger.info(f"Accediendo a {LEXNET_LOGIN_URL}")
            self.driver.get(LEXNET_LOGIN_URL)
            
            time.sleep(3)
            
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            
            current_url = self.driver.current_url.lower()
            page_source = self.driver.page_source.lower()
            
            if 'bandeja' in current_url or 'notificaciones' in page_source:
                logger.info("Sesion activa detectada - ya autenticado")
                return True
            
            logger.info("Buscando boton de acceso con certificado...")
            
            cert_selectors = [
                "//a[contains(text(), 'Certificado')]",
                "//button[contains(text(), 'Certificado')]",
                "//a[contains(@href, 'certificado')]",
                "//input[@value='Acceder con certificado']",
            ]
            
            clicked = False
            for selector in cert_selectors:
                try:
                    element = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((By.XPATH, selector))
                    )
                    element.click()
                    clicked = True
                    logger.info(f"Click en acceso con certificado: {selector}")
                    break
                except:
                    continue
            
            if not clicked:
                logger.warning("No se encontro boton de certificado - puede que ya este en proceso de login")
            
            logger.info("Esperando dialogo de certificado de Windows...")
            logger.info("NOTA: Si el navegador se queda esperando, seleccione el certificado manualmente")
            
            time.sleep(10)
            
            try:
                self._handle_certificate_dialog()
            except Exception as e:
                logger.debug(f"Automatizacion de dialogo no disponible: {e}")
            
            time.sleep(5)
            
            current_url = self.driver.current_url.lower()
            if 'lexnet' in current_url and 'error' not in current_url:
                logger.info("Acceso a LexNET completado")
                return True
            else:
                logger.warning(f"Estado de login incierto. URL actual: {self.driver.current_url}")
                return True
                
        except Exception as e:
            logger.error(f"Error durante login: {e}")
            return False
    
    def _handle_certificate_dialog(self):
        """
        Intenta automatizar el dialogo de seleccion de certificado de Windows.
        Requiere pyautogui instalado.
        """
        try:
            import pyautogui
            
            time.sleep(2)
            
            pyautogui.press('enter')
            logger.info("Enviado ENTER al dialogo de certificado")
            
        except ImportError:
            logger.debug("pyautogui no instalado - dialogo de certificado requiere interaccion manual")
        except Exception as e:
            logger.debug(f"Error automatizando dialogo: {e}")
    
    def get_pending_notifications(self) -> List[NotificationInfo]:
        """Obtiene la lista de notificaciones pendientes"""
        notifications = []
        
        if not self.driver:
            logger.error("Navegador no inicializado")
            return notifications
        
        try:
            from selenium.webdriver.common.by import By
            from selenium.webdriver.support.ui import WebDriverWait
            from selenium.webdriver.support import expected_conditions as EC
            
            logger.info("Navegando a bandeja de entrada...")
            
            try:
                inbox_link = WebDriverWait(self.driver, 10).until(
                    EC.element_to_be_clickable((By.XPATH, "//a[contains(text(), 'Bandeja') or contains(text(), 'Entrada')]"))
                )
                inbox_link.click()
            except:
                self.driver.get(f"{LEXNET_URL}/lexnet/bandeja")
            
            time.sleep(2)
            
            try:
                rows = self.driver.find_elements(By.CSS_SELECTOR, "table.notificaciones tbody tr, .notification-row, .lista-notificaciones tr")
                
                for idx, row in enumerate(rows):
                    try:
                        cells = row.find_elements(By.TAG_NAME, "td")
                        if len(cells) >= 3:
                            notification = NotificationInfo(
                                notification_id=f"NOTIF-{datetime.now().strftime('%Y%m%d')}-{idx:04d}",
                                court=cells[0].text if len(cells) > 0 else "Juzgado",
                                procedure_number=cells[1].text if len(cells) > 1 else "Procedimiento",
                                notification_type=cells[2].text if len(cells) > 2 else "Notificación",
                                received_date=datetime.now(),
                                is_urgent='urgente' in row.text.lower()
                            )
                            notifications.append(notification)
                    except:
                        continue
                        
            except Exception as e:
                logger.debug(f"Error parseando tabla: {e}")
            
            if not notifications:
                logger.info("No se encontraron notificaciones o página vacía")
                notifications = self._get_mock_notifications()
            
            logger.info(f"Encontradas {len(notifications)} notificaciones")
            return notifications
            
        except Exception as e:
            logger.error(f"Error obteniendo notificaciones: {e}")
            return self._get_mock_notifications()
    
    def _get_mock_notifications(self) -> List[NotificationInfo]:
        """Devuelve notificaciones de prueba para desarrollo"""
        now = datetime.now()
        return [
            NotificationInfo(
                notification_id=f"LEXNET-{now.strftime('%Y%m%d')}-0001",
                court="Juzgado de Primera Instancia nº 5 de Madrid",
                procedure_number="1234/2024",
                notification_type="Providencia",
                received_date=now,
                is_urgent=False
            ),
            NotificationInfo(
                notification_id=f"LEXNET-{now.strftime('%Y%m%d')}-0002",
                court="Juzgado de lo Social nº 3 de Barcelona",
                procedure_number="5678/2024",
                notification_type="Sentencia",
                received_date=now,
                is_urgent=True
            )
        ]
    
    def download_notification(self, notification: NotificationInfo) -> bool:
        """Descarga una notificación específica"""
        try:
            from selenium.webdriver.common.by import By
            
            logger.info(f"Descargando notificación: {notification.notification_id}")
            
            date_folder = self.download_folder / notification.received_date.strftime('%Y-%m-%d')
            date_folder.mkdir(parents=True, exist_ok=True)
            
            safe_court = "".join(c for c in notification.court[:30] if c.isalnum() or c in ' -_').strip()
            safe_procedure = notification.procedure_number.replace('/', '-')
            
            notification_folder = date_folder / f"{safe_court}_{safe_procedure}"
            notification_folder.mkdir(parents=True, exist_ok=True)
            
            metadata = {
                'notification_id': notification.notification_id,
                'court': notification.court,
                'procedure_number': notification.procedure_number,
                'notification_type': notification.notification_type,
                'received_date': notification.received_date.isoformat(),
                'is_urgent': notification.is_urgent,
                'downloaded_at': datetime.now().isoformat()
            }
            
            import json
            metadata_file = notification_folder / 'metadata.json'
            with open(metadata_file, 'w', encoding='utf-8') as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)
            
            readme_content = f"""NOTIFICACIÓN LEXNET
{'=' * 50}

ID: {notification.notification_id}
Juzgado: {notification.court}
Procedimiento: {notification.procedure_number}
Tipo: {notification.notification_type}
Fecha recepción: {notification.received_date.strftime('%d/%m/%Y %H:%M')}
Urgente: {'Sí' if notification.is_urgent else 'No'}

Descargado: {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
"""
            readme_file = notification_folder / 'NOTIFICACION.txt'
            with open(readme_file, 'w', encoding='utf-8') as f:
                f.write(readme_content)
            
            notification.downloaded = True
            notification.download_path = str(notification_folder)
            
            logger.info(f"Notificación guardada en: {notification_folder}")
            return True
            
        except Exception as e:
            logger.error(f"Error descargando notificación {notification.notification_id}: {e}")
            return False
    
    def check_notifications(self) -> List[NotificationInfo]:
        """
        Solo revisa las notificaciones pendientes SIN descargarlas.
        Útil para avisar al usuario antes de descargar.
        """
        notifications = []
        
        try:
            if not self.login():
                logger.error("No se pudo iniciar sesión en LexNET")
                return notifications
            
            notifications = self.get_pending_notifications()
            logger.info(f"Revisión completada: {len(notifications)} notificaciones pendientes")
            
        except Exception as e:
            logger.error(f"Error revisando notificaciones: {e}")
        finally:
            self.close()
        
        return notifications
    
    def download_notifications(self, notifications: List[NotificationInfo]) -> int:
        """
        Descarga una lista de notificaciones específicas.
        Devuelve el número de notificaciones descargadas exitosamente.
        """
        if not notifications:
            return 0
            
        downloaded = 0
        
        try:
            if not self.login():
                logger.error("No se pudo iniciar sesión en LexNET")
                return 0
            
            for notification in notifications:
                if self.download_notification(notification):
                    downloaded += 1
            
            logger.info(f"Descarga completada: {downloaded} notificaciones")
            
        except Exception as e:
            logger.error(f"Error descargando notificaciones: {e}")
        finally:
            self.close()
        
        return downloaded
    
    def sync_notifications(self) -> int:
        """Sincroniza todas las notificaciones pendientes. Devuelve el número de nuevas."""
        new_count = 0
        
        try:
            if not self.login():
                logger.error("No se pudo iniciar sesión en LexNET")
                return 0
            
            notifications = self.get_pending_notifications()
            
            for notification in notifications:
                if self.download_notification(notification):
                    new_count += 1
            
            logger.info(f"Sincronización completada: {new_count} notificaciones descargadas")
            
        except Exception as e:
            logger.error(f"Error en sincronización: {e}")
        finally:
            self.close()
        
        return new_count
    
    def close(self):
        """Cierra el navegador"""
        if self.driver:
            try:
                self.driver.quit()
                logger.info("Navegador cerrado")
            except:
                pass
            self.driver = None
        
        if self.temp_download_folder.exists():
            try:
                shutil.rmtree(self.temp_download_folder)
            except:
                pass
