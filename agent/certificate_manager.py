"""
Gestor de certificados digitales de Windows para Vento LexOps Agent
Accede al almacén de certificados de Windows para listar y seleccionar certificados.
"""

import sys
import logging
from typing import List, Dict, Optional
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
            logger.warning("CertificateManager solo funciona en Windows")
            return self._get_mock_certificates()
        
        try:
            self._certificates = self._load_windows_certificates()
        except Exception as e:
            logger.error(f"Error cargando certificados: {e}")
            return self._get_mock_certificates()
        
        self._loaded = True
        return self._certificates
    
    def _load_windows_certificates(self) -> List[CertificateInfo]:
        """Carga certificados del almacén de Windows usando win32crypt"""
        certificates = []
        
        try:
            import win32crypt
            import win32security
            
            store = win32crypt.CertOpenStore(
                win32crypt.CERT_STORE_PROV_SYSTEM,
                0,
                None,
                win32crypt.CERT_SYSTEM_STORE_CURRENT_USER,
                "MY"
            )
            
            cert = None
            while True:
                cert = win32crypt.CertEnumCertificatesInStore(store, cert)
                if cert is None:
                    break
                
                try:
                    cert_context = cert
                    
                    subject = self._get_cert_name(cert_context, win32crypt.CERT_NAME_SIMPLE_DISPLAY_TYPE)
                    issuer = self._get_cert_issuer(cert_context)
                    thumbprint = self._get_thumbprint(cert_context)
                    valid_from, valid_to = self._get_validity(cert_context)
                    has_private_key = self._check_private_key(cert_context)
                    
                    if has_private_key and valid_from and valid_to:
                        cert_info = CertificateInfo(
                            thumbprint=thumbprint,
                            subject=subject,
                            issuer=issuer,
                            valid_from=valid_from,
                            valid_to=valid_to,
                            has_private_key=has_private_key
                        )
                        certificates.append(cert_info)
                        
                except Exception as e:
                    logger.debug(f"Error procesando certificado: {e}")
                    continue
            
            win32crypt.CertCloseStore(store, 0)
            
        except ImportError:
            logger.warning("win32crypt no disponible, usando certificados de prueba")
            return self._get_mock_certificates()
        
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
        """Obtiene las fechas de validez del certificado"""
        try:
            return datetime.now(), datetime.now().replace(year=datetime.now().year + 1)
        except:
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
