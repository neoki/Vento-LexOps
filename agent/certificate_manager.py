"""
Gestor de certificados digitales de Windows para Vento LexOps Agent
Accede al almacén de certificados de Windows o carga certificados desde archivo.
"""

import sys
import os
import logging
from typing import List, Dict, Optional, Tuple
from datetime import datetime

logger = logging.getLogger(__name__)

class CertificateInfo:
    def __init__(self, thumbprint: str, subject: str, issuer: str, 
                 valid_from: datetime, valid_to: datetime, has_private_key: bool):
        self.thumbprint = thumbprint
        self.subject = subject
        self.issuer = issuer
        self.valid_from = valid_from
        self.valid_to = valid_to
        self.has_private_key = has_private_key
        
    @property
    def common_name(self) -> str:
        """Extrae el CN (Common Name) del subject"""
        for part in self.subject.split(','):
            part = part.strip()
            if part.startswith('CN='):
                return part[3:]
        return self.subject
    
    @property
    def is_valid(self) -> bool:
        """Comprueba si el certificado está vigente"""
        now = datetime.now()
        return self.valid_from <= now <= self.valid_to
    
    @property
    def issuer_type(self) -> str:
        """Detecta el tipo de emisor (FNMT, ACA, etc.)"""
        issuer_lower = self.issuer.lower()
        if 'fnmt' in issuer_lower or 'fabrica nacional' in issuer_lower:
            return 'FNMT'
        elif 'aca' in issuer_lower or 'autoritat de certificacio' in issuer_lower:
            return 'ACA'
        elif 'dnie' in issuer_lower or 'direccion general de la policia' in issuer_lower:
            return 'DNIe'
        elif 'camerfirma' in issuer_lower:
            return 'Camerfirma'
        else:
            return 'Otro'
    
    def to_dict(self) -> Dict:
        return {
            'thumbprint': self.thumbprint,
            'subject': self.subject,
            'common_name': self.common_name,
            'issuer': self.issuer,
            'issuer_type': self.issuer_type,
            'valid_from': self.valid_from.isoformat(),
            'valid_to': self.valid_to.isoformat(),
            'is_valid': self.is_valid,
            'has_private_key': self.has_private_key
        }


class CertificateManager:
    def __init__(self):
        self._certificates: List[CertificateInfo] = []
        self._loaded = False
    
    def list_certificates(self, refresh: bool = False) -> List[CertificateInfo]:
        """Lista todos los certificados personales del almacén de Windows"""
        if self._loaded and not refresh:
            return self._certificates
        
        self._certificates = []
        
        if sys.platform != 'win32':
            logger.warning("CertificateManager solo funciona en Windows - ejecute desde Windows")
            return []
        
        try:
            self._certificates = self._load_windows_certificates()
        except Exception as e:
            logger.error(f"Error cargando certificados del almacén de Windows: {e}")
            return []
        
        self._loaded = True
        return self._certificates
    
    def _load_windows_certificates(self) -> List[CertificateInfo]:
        """Carga certificados del almacén de Windows usando PowerShell (más fiable)"""
        certificates = []
        
        try:
            import subprocess
            import json
            
            ps_command = '''
$certs = Get-ChildItem -Path Cert:\\CurrentUser\\My | Where-Object { $_.HasPrivateKey }
$result = @()
foreach ($cert in $certs) {
    $result += @{
        Thumbprint = $cert.Thumbprint
        Subject = $cert.Subject
        Issuer = $cert.Issuer
        NotBefore = $cert.NotBefore.ToString('yyyy-MM-ddTHH:mm:ss')
        NotAfter = $cert.NotAfter.ToString('yyyy-MM-ddTHH:mm:ss')
        HasPrivateKey = $cert.HasPrivateKey
    }
}
$result | ConvertTo-Json -Compress
'''
            
            result = subprocess.run(
                ['powershell', '-NoProfile', '-Command', ps_command],
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode != 0:
                logger.error(f"PowerShell error: {result.stderr}")
                return []
            
            output = result.stdout.strip()
            if not output or output == 'null':
                logger.info("No se encontraron certificados con clave privada")
                return []
            
            data = json.loads(output)
            
            if isinstance(data, dict):
                data = [data]
            
            for cert_data in data:
                try:
                    valid_from = datetime.fromisoformat(cert_data['NotBefore'])
                    valid_to = datetime.fromisoformat(cert_data['NotAfter'])
                    
                    cert_info = CertificateInfo(
                        thumbprint=cert_data['Thumbprint'],
                        subject=cert_data['Subject'],
                        issuer=cert_data['Issuer'],
                        valid_from=valid_from,
                        valid_to=valid_to,
                        has_private_key=cert_data['HasPrivateKey']
                    )
                    certificates.append(cert_info)
                    logger.debug(f"Certificado cargado: {cert_info.common_name}")
                    
                except Exception as e:
                    logger.debug(f"Error procesando certificado: {e}")
                    continue
            
        except subprocess.TimeoutExpired:
            logger.error("Timeout obteniendo certificados de Windows")
            return []
        except json.JSONDecodeError as e:
            logger.error(f"Error parseando respuesta de PowerShell: {e}")
            return []
        except Exception as e:
            logger.error(f"Error accediendo al almacén de certificados: {e}")
            return []
        
        logger.info(f"Encontrados {len(certificates)} certificados con clave privada")
        return certificates
    
    def _get_cert_name(self, cert, name_type) -> str:
        """Obtiene el nombre del certificado"""
        try:
            import win32crypt
            return win32crypt.CertGetNameString(cert, name_type, 0, None)
        except:
            return "Desconocido"
    
    def _get_cert_issuer(self, cert) -> str:
        """Obtiene el emisor del certificado"""
        try:
            import win32crypt
            return win32crypt.CertGetNameString(
                cert, 
                win32crypt.CERT_NAME_SIMPLE_DISPLAY_TYPE, 
                win32crypt.CERT_NAME_ISSUER_FLAG, 
                None
            )
        except:
            return "Desconocido"
    
    def _get_thumbprint(self, cert) -> str:
        """Obtiene el thumbprint (huella digital) del certificado"""
        try:
            import win32crypt
            import hashlib
            cert_data = win32crypt.CertEncodeCertificateContext(cert)
            return hashlib.sha1(cert_data).hexdigest().upper()
        except:
            return ""
    
    def _get_validity(self, cert):
        """Obtiene las fechas de validez del certificado desde PCCERT_CONTEXT"""
        try:
            import win32crypt
            import ctypes
            from ctypes import wintypes
            
            cert_info = cert[0]
            not_before = cert_info['NotBefore']
            not_after = cert_info['NotAfter']
            
            valid_from = datetime(
                not_before.year, not_before.month, not_before.day,
                not_before.hour, not_before.minute, not_before.second
            )
            valid_to = datetime(
                not_after.year, not_after.month, not_after.day,
                not_after.hour, not_after.minute, not_after.second
            )
            
            return valid_from, valid_to
        except Exception as e:
            logger.debug(f"Error obteniendo fechas de validez via struct: {e}")
            try:
                import subprocess
                thumbprint = self._get_thumbprint(cert)
                if thumbprint:
                    result = subprocess.run(
                        ['powershell', '-Command', 
                         f"$cert = Get-ChildItem -Path Cert:\\CurrentUser\\My\\{thumbprint}; "
                         f"@{{NotBefore=$cert.NotBefore.ToString('yyyy-MM-ddTHH:mm:ss'); NotAfter=$cert.NotAfter.ToString('yyyy-MM-ddTHH:mm:ss')}} | ConvertTo-Json"],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        import json
                        data = json.loads(result.stdout)
                        if 'NotBefore' in data and 'NotAfter' in data:
                            valid_from = datetime.fromisoformat(data['NotBefore'])
                            valid_to = datetime.fromisoformat(data['NotAfter'])
                            return valid_from, valid_to
            except Exception as ps_error:
                logger.debug(f"Error obteniendo fechas via PowerShell: {ps_error}")
            
            return None, None
    
    def _check_private_key(self, cert) -> bool:
        """Comprueba si el certificado tiene clave privada asociada"""
        try:
            import win32crypt
            return win32crypt.CryptAcquireCertificatePrivateKey(cert, 0, None) is not None
        except:
            return True
    
    def _get_mock_certificates(self) -> List[CertificateInfo]:
        """Devuelve certificados de prueba para desarrollo"""
        now = datetime.now()
        return [
            CertificateInfo(
                thumbprint="A1B2C3D4E5F6789012345678901234567890ABCD",
                subject="CN=GARCIA LOPEZ MARIA - 12345678A, OU=Ciudadanos, O=FNMT-RCM",
                issuer="CN=AC FNMT Usuarios, OU=Ceres, O=FNMT-RCM, C=ES",
                valid_from=now.replace(year=now.year - 1),
                valid_to=now.replace(year=now.year + 3),
                has_private_key=True
            ),
            CertificateInfo(
                thumbprint="B2C3D4E5F6789012345678901234567890ABCDEF",
                subject="CN=PEREZ MARTINEZ JUAN - 87654321B, OU=Ciudadanos, O=FNMT-RCM",
                issuer="CN=AC FNMT Usuarios, OU=Ceres, O=FNMT-RCM, C=ES",
                valid_from=now.replace(year=now.year - 1),
                valid_to=now.replace(year=now.year + 2),
                has_private_key=True
            ),
            CertificateInfo(
                thumbprint="C3D4E5F6789012345678901234567890ABCDEF01",
                subject="CN=RODRIGUEZ SANCHEZ ANA - 11223344C",
                issuer="CN=EC-ACC, O=Agencia Catalana de Certificacio, C=ES",
                valid_from=now.replace(year=now.year - 2),
                valid_to=now.replace(year=now.year + 1),
                has_private_key=True
            )
        ]
    
    def get_certificate_by_thumbprint(self, thumbprint: str) -> Optional[CertificateInfo]:
        """Obtiene un certificado por su thumbprint"""
        for cert in self.list_certificates():
            if cert.thumbprint.upper() == thumbprint.upper():
                return cert
        return None
    
    def get_valid_certificates(self) -> List[CertificateInfo]:
        """Devuelve solo los certificados válidos (no caducados)"""
        return [cert for cert in self.list_certificates() if cert.is_valid]
    
    def get_certificates_by_issuer(self, issuer_type: str) -> List[CertificateInfo]:
        """Filtra certificados por tipo de emisor (FNMT, ACA, DNIe, etc.)"""
        return [cert for cert in self.list_certificates() 
                if cert.issuer_type.upper() == issuer_type.upper()]
    
    def load_certificate_from_file(self, filepath: str, password: str = '') -> Tuple[bool, str]:
        """
        Carga un certificado desde archivo .pfx o .p12
        Retorna (success, message)
        """
        if not os.path.exists(filepath):
            return False, f"El archivo no existe: {filepath}"
        
        ext = os.path.splitext(filepath)[1].lower()
        if ext not in ['.pfx', '.p12']:
            return False, f"Formato no soportado: {ext}. Use .pfx o .p12"
        
        try:
            from cryptography.hazmat.primitives.serialization import pkcs12
            from cryptography.hazmat.backends import default_backend
            from cryptography import x509
            
            with open(filepath, 'rb') as f:
                pfx_data = f.read()
            
            pwd = password.encode('utf-8') if password else None
            
            try:
                private_key, certificate, additional_certs = pkcs12.load_key_and_certificates(
                    pfx_data, pwd, default_backend()
                )
            except Exception as e:
                if 'password' in str(e).lower() or 'mac' in str(e).lower():
                    return False, "Contraseña incorrecta"
                return False, f"Error cargando certificado: {e}"
            
            if certificate is None:
                return False, "El archivo no contiene un certificado válido"
            
            subject = certificate.subject.rfc4514_string()
            issuer = certificate.issuer.rfc4514_string()
            thumbprint = certificate.fingerprint(certificate.signature_hash_algorithm).hex().upper()
            valid_from = getattr(certificate, 'not_valid_before_utc', certificate.not_valid_before)
            valid_to = getattr(certificate, 'not_valid_after_utc', certificate.not_valid_after)
            if hasattr(valid_from, 'replace'):
                valid_from = valid_from.replace(tzinfo=None) if hasattr(valid_from, 'tzinfo') else valid_from
                valid_to = valid_to.replace(tzinfo=None) if hasattr(valid_to, 'tzinfo') else valid_to
            
            logger.info(f"Certificado cargado: {subject}")
            return True, f"Certificado válido: {subject}"
            
        except ImportError:
            logger.warning("Librería 'cryptography' no instalada, validación básica")
            return True, f"Archivo encontrado: {os.path.basename(filepath)} (sin validación)"
        except Exception as e:
            return False, f"Error: {e}"
    
    def get_certificate_info_from_file(self, filepath: str, password: str = '') -> Optional[CertificateInfo]:
        """
        Obtiene información de un certificado desde archivo .pfx o .p12
        """
        if not os.path.exists(filepath):
            return None
        
        try:
            from cryptography.hazmat.primitives.serialization import pkcs12
            from cryptography.hazmat.backends import default_backend
            from cryptography.hazmat.primitives import hashes
            
            with open(filepath, 'rb') as f:
                pfx_data = f.read()
            
            pwd = password.encode('utf-8') if password else None
            
            private_key, certificate, _ = pkcs12.load_key_and_certificates(
                pfx_data, pwd, default_backend()
            )
            
            if certificate is None:
                return None
            
            subject = certificate.subject.rfc4514_string()
            issuer = certificate.issuer.rfc4514_string()
            thumbprint = certificate.fingerprint(hashes.SHA1()).hex().upper()
            valid_from = getattr(certificate, 'not_valid_before_utc', certificate.not_valid_before)
            valid_to = getattr(certificate, 'not_valid_after_utc', certificate.not_valid_after)
            if hasattr(valid_from, 'replace') and hasattr(valid_from, 'tzinfo'):
                valid_from = valid_from.replace(tzinfo=None)
                valid_to = valid_to.replace(tzinfo=None)
            
            return CertificateInfo(
                thumbprint=thumbprint,
                subject=subject,
                issuer=issuer,
                valid_from=valid_from,
                valid_to=valid_to,
                has_private_key=private_key is not None
            )
            
        except Exception as e:
            logger.error(f"Error obteniendo info del certificado: {e}")
            return None
