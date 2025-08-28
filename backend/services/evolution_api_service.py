"""
Evolution API Service for WhatsApp Integration
Handles WhatsApp messaging, instance management, and QR code generation
"""

import asyncio
import aiohttp
import json
import logging
import qrcode
import io
import base64
from typing import Dict, Any, Optional, List
from datetime import datetime
from PIL import Image

logger = logging.getLogger(__name__)

class EvolutionAPIService:
    """Evolution API service for WhatsApp Business integration"""
    
    def __init__(self, base_url: str, api_key: str = None):
        """
        Initialize Evolution API service
        
        Args:
            base_url: Evolution API base URL (e.g., 'https://api.evolution.com/v2')
            api_key: API key for authentication (if required)
        """
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            "Content-Type": "application/json"
        }
        
        if api_key:
            self.headers["Authorization"] = f"Bearer {api_key}"
    
    async def create_instance(
        self,
        instance_name: str,
        webhook_url: str = None,
        webhook_events: List[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new WhatsApp instance
        
        Args:
            instance_name: Unique instance name
            webhook_url: URL to receive webhooks
            webhook_events: List of events to receive
            
        Returns:
            Dict with instance creation result
        """
        try:
            webhook_events = webhook_events or [
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE", 
                "MESSAGES_DELETE",
                "SEND_MESSAGE",
                "CONTACTS_UPDATE",
                "GROUPS_UPSERT",
                "PRESENCE_UPDATE",
                "CHATS_UPDATE",
                "CONNECTION_UPDATE"
            ]
            
            instance_data = {
                "instanceName": instance_name,
                "token": instance_name,  # Use instance name as token
                "qrcode": True,
                "markMessagesRead": True,
                "delayMessage": 1000,
                "alwaysOnline": True,
                "readReceipts": True,
                "readStatus": True,
                "syncFullHistory": True
            }
            
            # Add webhook configuration if provided
            if webhook_url:
                instance_data["webhook"] = {
                    "url": webhook_url,
                    "events": webhook_events,
                    "base64": False
                }
            
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.post(
                    f"{self.base_url}/instance/create",
                    json=instance_data
                ) as response:
                    if response.status in [200, 201]:
                        result = await response.json()
                        return {
                            'success': True,
                            'instance_name': instance_name,
                            'instance_data': result,
                            'message': 'Instance created successfully',
                            'created_at': datetime.utcnow().isoformat()
                        }
                    else:
                        error_data = await response.json() if response.headers.get('content-type') == 'application/json' else {}
                        return {
                            'success': False,
                            'error': error_data.get('message', f'HTTP {response.status}'),
                            'status_code': response.status
                        }
                
        except Exception as e:
            logger.error(f"Error creating Evolution API instance: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def get_qr_code(self, instance_name: str) -> Dict[str, Any]:
        """
        Get QR code for WhatsApp connection
        
        Args:
            instance_name: Instance name
            
        Returns:
            Dict with QR code data
        """
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.get(
                    f"{self.base_url}/instance/connect/{instance_name}"
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                    else:
                        result = None
            if result is not None:
                # Check if QR code is available
                if result.get('base64'):
                    # Generate QR code image from base64
                    qr_base64 = result['base64']

                    # Also generate a clean QR code image
                    qr_code_image = await self._generate_qr_code_image(result.get('code', ''))

                    return {
                        'success': True,
                        'qr_code_base64': qr_base64,
                        'qr_code_text': result.get('code', ''),
                        'qr_code_image': qr_code_image,
                        'status': result.get('status', 'connecting'),
                        'instance_name': instance_name,
                        'expires_at': None  # QR codes typically expire after 60 seconds
                    }
                else:
                    return {
                        'success': False,
                        'error': 'QR code not available. Instance may already be connected.',
                        'status': result.get('status', 'unknown')
                    }
            else:
                return {
                    'success': False,
                    'error': 'Failed to get QR code',
                    'status_code': 500
                }
                
        except Exception as e:
            logger.error(f"Error getting QR code: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def _generate_qr_code_image(self, qr_text: str) -> str:
        """Generate QR code image from text and return as base64"""
        try:
            if not qr_text:
                return ""
            
            # Create QR code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(qr_text)
            qr.make(fit=True)
            
            # Create image
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Convert to base64
            buffer = io.BytesIO()
            img.save(buffer, format='PNG')
            img_base64 = base64.b64encode(buffer.getvalue()).decode()
            
            return f"data:image/png;base64,{img_base64}"
            
        except Exception as e:
            logger.error(f"Error generating QR code image: {str(e)}")
            return ""
    
    async def get_instance_status(self, instance_name: str) -> Dict[str, Any]:
        """
        Get instance connection status
        
        Args:
            instance_name: Instance name
            
        Returns:
            Dict with instance status
        """
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.get(
                    f"{self.base_url}/instance/connectionState/{instance_name}"
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            'success': True,
                            'instance_name': instance_name,
                            'status': result.get('state', 'unknown'),
                            'connected': result.get('state') == 'open',
                            'last_update': datetime.utcnow().isoformat()
                        }
                    else:
                        return {
                            'success': False,
                            'error': f'Failed to get instance status: HTTP {response.status}',
                            'status_code': response.status
                        }
                
        except Exception as e:
            logger.error(f"Error getting instance status: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_message(
        self,
        instance_name: str,
        number: str,
        message: str,
        message_type: str = "text"
    ) -> Dict[str, Any]:
        """
        Send WhatsApp message
        
        Args:
            instance_name: Instance name
            number: Recipient phone number (with country code)
            message: Message content
            message_type: Type of message ('text', 'image', 'document', etc.)
            
        Returns:
            Dict with send result
        """
        try:
            # Clean phone number (remove non-digits except +)
            clean_number = ''.join(c for c in number if c.isdigit() or c == '+')
            if not clean_number.startswith('+'):
                clean_number = '+' + clean_number
            
            message_data = {
                "number": clean_number,
                "textMessage": {
                    "text": message
                }
            }
            
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.post(
                    f"{self.base_url}/message/sendText/{instance_name}",
                    json=message_data
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            'success': True,
                            'message_id': result.get('key', {}).get('id'),
                            'recipient': clean_number,
                            'message': message,
                            'sent_at': datetime.utcnow().isoformat(),
                            'instance_name': instance_name
                        }
                    else:
                        error_data = await response.json() if response.headers.get('content-type') == 'application/json' else {}
                        return {
                            'success': False,
                            'error': error_data.get('message', f'HTTP {response.status}'),
                            'status_code': response.status
                        }
                
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def send_payment_link(
        self,
        instance_name: str,
        number: str,
        payment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send payment link via WhatsApp
        
        Args:
            instance_name: Instance name
            number: Recipient phone number
            payment_data: Payment information from payment service
            
        Returns:
            Dict with send result
        """
        try:
            provider = payment_data.get('provider', 'unknown')
            amount = payment_data.get('amount', 0)
            description = payment_data.get('description', 'Pagamento')
            payment_url = payment_data.get('url', payment_data.get('bankSlipUrl'))
            
            # Create formatted message
            if provider == 'stripe':
                message = f"""💳 *Link de Pagamento - Stripe*
                
📋 *Descrição:* {description}
💰 *Valor:* R$ {amount:.2f}
🔗 *Link:* {payment_url}

Clique no link acima para realizar o pagamento de forma segura."""
                
            elif provider == 'asaas':
                message = f"""💳 *Link de Pagamento - Asaas*
                
📋 *Descrição:* {description}
💰 *Valor:* R$ {amount:.2f}
🔗 *Link:* {payment_url}

Formas de pagamento disponíveis:
• PIX (instantâneo)
• Boleto bancário
• Cartão de crédito

Clique no link acima para escolher sua forma de pagamento."""
                
                # Add PIX information if available
                if payment_data.get('pix_code'):
                    message += f"\n\n🏦 *PIX Copia e Cola:*\n`{payment_data['pix_code']}`"
            else:
                message = f"""💳 *Link de Pagamento*
                
📋 *Descrição:* {description}
💰 *Valor:* R$ {amount:.2f}
🔗 *Link:* {payment_url}

Clique no link para realizar o pagamento."""
            
            # Send the message
            result = await self.send_message(
                instance_name=instance_name,
                number=number,
                message=message
            )
            
            if result.get('success'):
                result['payment_provider'] = provider
                result['payment_amount'] = amount
                
            return result
            
        except Exception as e:
            logger.error(f"Error sending payment link: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def delete_instance(self, instance_name: str) -> Dict[str, Any]:
        """
        Delete WhatsApp instance
        
        Args:
            instance_name: Instance name to delete
            
        Returns:
            Dict with deletion result
        """
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.delete(
                    f"{self.base_url}/instance/delete/{instance_name}"
                ) as response:
                    if response.status == 200:
                        return {
                            'success': True,
                            'message': f'Instance {instance_name} deleted successfully',
                            'instance_name': instance_name
                        }
                    else:
                        return {
                            'success': False,
                            'error': f'Failed to delete instance: HTTP {response.status}',
                            'status_code': response.status
                        }
                
        except Exception as e:
            logger.error(f"Error deleting instance: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def list_instances(self) -> Dict[str, Any]:
        """
        List all instances
        
        Returns:
            Dict with instances list
        """
        try:
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.get(
                    f"{self.base_url}/instance/fetchInstances"
                ) as response:
                    if response.status == 200:
                        result = await response.json()
                        return {
                            'success': True,
                            'instances': result.get('instances', []),
                            'count': len(result.get('instances', []))
                        }
                    else:
                        return {
                            'success': False,
                            'error': f'Failed to list instances: HTTP {response.status}',
                            'status_code': response.status
                        }
                
        except Exception as e:
            logger.error(f"Error listing instances: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
    
    async def set_webhook(
        self,
        instance_name: str,
        webhook_url: str,
        webhook_events: List[str] = None
    ) -> Dict[str, Any]:
        """
        Set webhook for instance
        
        Args:
            instance_name: Instance name
            webhook_url: Webhook URL
            webhook_events: List of events to listen
            
        Returns:
            Dict with webhook setup result
        """
        try:
            webhook_events = webhook_events or ["MESSAGES_UPSERT"]
            
            webhook_data = {
                "url": webhook_url,
                "events": webhook_events,
                "base64": False
            }
            
            async with aiohttp.ClientSession(headers=self.headers) as session:
                async with session.post(
                    f"{self.base_url}/webhook/set/{instance_name}",
                    json=webhook_data
                ) as response:
                    if response.status == 200:
                        return {
                            'success': True,
                            'message': 'Webhook configured successfully',
                            'instance_name': instance_name,
                            'webhook_url': webhook_url,
                            'events': webhook_events
                        }
                    else:
                        return {
                            'success': False,
                            'error': f'Failed to set webhook: HTTP {response.status}',
                            'status_code': response.status
                        }
                
        except Exception as e:
            logger.error(f"Error setting webhook: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }
