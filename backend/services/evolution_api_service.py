"""Evolution API Service for WhatsApp Integration - v2.2.3
Handles WhatsApp messaging, instance management, and QR code generation
Compatible with Evolution API v2.2.3 remote server
"""

import httpx
import json
import logging
import qrcode
from qrcode.constants import ERROR_CORRECT_L
import io
import base64
from typing import Dict, Any, Optional, List
from datetime import datetime
from PIL import Image
import asyncio

logger = logging.getLogger(__name__)

class EvolutionAPIService:
    """Evolution API service for WhatsApp Business integration - v2.2.3"""
    
    def __init__(self, base_url: str, api_key: Optional[str] = None, global_api_key: Optional[str] = None, version: str = "2.2.3"):
        self.base_url = base_url.rstrip('/')
        self.api_key = api_key
        self.global_api_key = global_api_key
        self.version = version
        
        # Use global API key as fallback
        effective_key = api_key or global_api_key
        
        self.headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": f"AgnoAgent-EvolutionAPI/{version}"
        }
        
        if effective_key:
            # Evolution API v2.2.3 expects apikey header for authentication
            self.headers["apikey"] = effective_key
            # Some endpoints may also expect Authorization header
            self.headers["Authorization"] = f"Bearer {effective_key}"

    async def create_instance_with_webhook(self, instance_name: str, webhook_url: str, webhook_events: Optional[List[str]] = None) -> Dict[str, Any]:
        """Cria instância Evolution API v2.2.3 com webhook configurado IMEDIATAMENTE"""
        try:
            logger.info(f"🚀 Criando instância {instance_name} com webhook: {webhook_url}")
            
            # Webhook events essenciais para o fluxo completo
            default_events = [
                "APPLICATION_STARTUP",
                "QRCODE_UPDATED", 
                "CONNECTION_UPDATE",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "SEND_MESSAGE",
                "CONTACTS_UPSERT",
                "CHATS_UPSERT"
            ]
            
            events = webhook_events or default_events
            
            # Payload Evolution API v2.2.3 com webhook integrado
            instance_data = {
                "instanceName": instance_name,
                "token": instance_name,  # Use instance name as token
                "integration": "WHATSAPP-BAILEYS",  # Confirmed working integration
                "qrcode": True,  # Enable QR code generation
                # Removido campo 'number' para evitar erro de validação regex
                # Para WHATSAPP-BAILEYS, o número não é necessário na criação
                
                # WEBHOOK CONFIGURATION - CRITICAL FOR IMMEDIATE ACTIVATION
                "webhookUrl": webhook_url,
                "webhookByEvents": False,
                "webhookBase64": False,
                "webhookEvents": events,
                
                # Connection settings optimized for reliability
                "rejectCall": False,
                "msgRetryCounterCache": True,
                "markMessagesRead": True,
                "alwaysOnline": True,
                "readReceipts": True,
                "readStatus": True,
                "syncFullHistory": False,  # Faster connection
                
                # Disable unused integrations for cleaner setup
                "chatwootAccountId": "",
                "chatwootToken": "",
                "chatwootUrl": "",
                "chatwootSignMsg": False,
                "chatwootReopenConversation": False,
                "chatwootConversationPending": False,
                "chatwootImportContacts": False,
                "chatwootNameInbox": "",
                "chatwootMergeBrazilContacts": False,
                "chatwootImportMessages": False,
                "chatwootDaysLimitImportMessages": 0,
                "chatwootOrganization": "",
                "chatwootLogo": "",
                
                "websocketEnabled": False,
                "websocketEvents": [],
                "rabbitmqEnabled": False,
                "rabbitmqEvents": [],
                "sqsEnabled": False,
                "sqsEvents": [],
                
                "typebotUrl": "",
                "typebotName": "",
                "typebotExpire": 0,
                "typebotKeywordFinish": "",
                "typebotDelayMessage": 1000,
                "typebotUnknownMessage": "",
                "typebotListeningFromMe": False,
                "typebotStopBotFromMe": False,
                "typebotKeepOpen": False,
                "typebotDebugMode": False,
                "typebotIgnoreJids": [],
                
                "proxyHost": "",
                "proxyPort": "",
                "proxyProtocol": "",
                "proxyUsername": "",
                "proxyPassword": ""
            }

            logger.info(f"📋 Payload completo: {json.dumps(instance_data, indent=2)[:500]}...")

            async with httpx.AsyncClient(timeout=60.0) as client:
                logger.info(f"🌐 Fazendo POST para: {self.base_url}/instance/create")
                logger.info(f"🔑 Headers: {json.dumps(dict(self.headers), indent=2)}")
                
                response = await client.post(
                    f"{self.base_url}/instance/create", 
                    headers=self.headers, 
                    json=instance_data
                )
                
                logger.info(f"📊 Status HTTP: {response.status_code}")
                logger.info(f"📥 Response headers: {dict(response.headers)}")
                
                try:
                    response_data = response.json()
                    logger.info(f"📄 Response body: {json.dumps(response_data, indent=2)[:1000]}...")
                except:
                    logger.info(f"📄 Response body (text): {response.text[:500]}...")

            if response.status_code in [200, 201]:
                response_data = response.json()
                return {
                    'success': True, 
                    'instance_name': instance_name, 
                    'instance_data': response_data, 
                    'message': 'Instance created successfully with webhook configured', 
                    'webhook_url': webhook_url,
                    'webhook_events': events,
                    'created_at': datetime.utcnow().isoformat()
                }
            elif response.status_code == 409 or (response.status_code == 403 and 'already exists' in response.text.lower()):
                # Instance already exists - this is OK for our use case
                logger.info(f"✅ Instância {instance_name} já existe, continuando...")
                return {
                    'success': True, 
                    'instance_name': instance_name, 
                    'message': f'Instance {instance_name} already exists', 
                    'webhook_url': webhook_url,
                    'already_exists': True, 
                    'created_at': datetime.utcnow().isoformat()
                }
            else:
                error_data = {}
                try:
                    error_data = response.json()
                except:
                    error_data = {'message': response.text}
                    
                logger.error(f"❌ Erro na criação: Status {response.status_code}, Data: {error_data}")
                return {
                    'success': False, 
                    'error': error_data.get('message', f'HTTP {response.status_code}: {response.text}'), 
                    'status_code': response.status_code,
                    'response_data': error_data
                }
                
        except Exception as e:
            logger.error(f"❌ Exceção ao criar instância: {str(e)}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return {'success': False, 'error': str(e)}

    async def create_instance(self, instance_name: str, webhook_url: Optional[str] = None, webhook_events: Optional[List[str]] = None) -> Dict[str, Any]:
        try:
            # Evolution API v2.2.3 instance creation payload
            instance_data = {
                "instanceName": instance_name,
                "token": instance_name,
                "integration": "WHATSAPP-BAILEYS",
                "qrcode": True,
                # Removido campo 'number' para evitar erro de validação regex
                # Para WHATSAPP-BAILEYS, o número não é necessário na criação
                "webhookUrl": webhook_url or "",
                "webhookByEvents": False,
                "webhookBase64": False,
                "webhookEvents": webhook_events or ["APPLICATION_STARTUP", "QRCODE_UPDATED", "MESSAGES_UPSERT", "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE", "CONTACTS_SET", "CONTACTS_UPSERT", "CONTACTS_UPDATE", "PRESENCE_UPDATE", "CHATS_SET", "CHATS_UPSERT", "CHATS_UPDATE", "CHATS_DELETE", "GROUPS_UPSERT", "GROUP_UPDATE", "GROUP_PARTICIPANTS_UPDATE", "CONNECTION_UPDATE", "LABELS_EDIT", "LABELS_ASSOCIATION", "CALL", "TYPEBOT_START", "TYPEBOT_CHANGE_STATUS"],
                "rejectCall": False,
                "msgRetryCounterCache": True,
                "markMessagesRead": True,
                "alwaysOnline": True,
                "readReceipts": True,
                "readStatus": True,
                "syncFullHistory": True,
                "chatwootAccountId": "",
                "chatwootToken": "",
                "chatwootUrl": "",
                "chatwootSignMsg": False,
                "chatwootReopenConversation": False,
                "chatwootConversationPending": False,
                "chatwootImportContacts": False,
                "chatwootNameInbox": "",
                "chatwootMergeBrazilContacts": False,
                "chatwootImportMessages": False,
                "chatwootDaysLimitImportMessages": 0,
                "chatwootOrganization": "",
                "chatwootLogo": "",
                "websocketEnabled": False,
                "websocketEvents": [],
                "rabbitmqEnabled": False,
                "rabbitmqEvents": [],
                "sqsEnabled": False,
                "sqsEvents": [],
                "typebotUrl": "",
                "typebotName": "",
                "typebotExpire": 0,
                "typebotKeywordFinish": "",
                "typebotDelayMessage": 1000,
                "typebotUnknownMessage": "",
                "typebotListeningFromMe": False,
                "typebotStopBotFromMe": False,
                "typebotKeepOpen": False,
                "typebotDebugMode": False,
                "typebotIgnoreJids": [],
                "proxyHost": "",
                "proxyPort": "",
                "proxyProtocol": "",
                "proxyUsername": "",
                "proxyPassword": ""
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/instance/create", headers=self.headers, json=instance_data)

            if response.status_code in [200, 201]:
                return {'success': True, 'instance_name': instance_name, 'instance_data': response.json(), 'message': 'Instance created successfully', 'created_at': datetime.utcnow().isoformat()}
            else:
                error_data = response.json() if 'application/json' in response.headers.get('content-type', '') else {}
                logger.error(f"Evolution API error: Status {response.status_code}, Data: {error_data}")
                if response.status_code == 403 and 'already in use' in str(error_data.get('response', {}).get('message', '')):
                    return {'success': True, 'instance_name': instance_name, 'message': f'Instance {instance_name} already exists', 'already_exists': True, 'created_at': datetime.utcnow().isoformat()}
                return {'success': False, 'error': error_data.get('message', f'HTTP {response.status_code}'), 'status_code': response.status_code}
        except Exception as e:
            logger.error(f"Error creating Evolution API instance: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def get_qr_code(self, instance_name: str) -> Dict[str, Any]:
        """Obtém QR code da instância Evolution API v2.2.3"""
        try:
            logger.info(f"📱 Obtendo QR code para instância: {instance_name}")
            
            # Evolution API v2.2.3 QR code endpoint - try multiple endpoints
            endpoints_to_try = [
                f"/instance/connect/{instance_name}",
                f"/instance/{instance_name}/connect", 
                f"/instance/{instance_name}/qrcode"
            ]
            
            for endpoint in endpoints_to_try:
                try:
                    async with httpx.AsyncClient(timeout=30.0) as client:
                        url = f"{self.base_url}{endpoint}"
                        logger.info(f"🌐 Tentando endpoint: {url}")
                        response = await client.get(url, headers=self.headers)
                        logger.info(f"📊 Status: {response.status_code}")
                        
                        if response.status_code == 200:
                            result = response.json()
                            logger.info(f"✅ Resposta QR obtida: {json.dumps(result, indent=2)[:300]}...")
                            
                            # Extract QR code from different possible response formats
                            qr_code_text = result.get('code') or result.get('qrcode') or result.get('qr')
                            qr_base64 = result.get('base64') or result.get('qrBase64')
                            pairing_code = result.get('pairingCode') or result.get('pairing_code')
                            
                            if qr_code_text or qr_base64:
                                # Generate base64 image if we only have text
                                if qr_code_text and not qr_base64:
                                    qr_base64 = await self._generate_qr_code_image(qr_code_text)
                                
                                return {
                                    'success': True,
                                    'instance_name': instance_name,
                                    'qr_code_text': qr_code_text,
                                    'qr_code_image': qr_base64,
                                    'pairing_code': pairing_code,
                                    'response_data': result,
                                    'endpoint_used': endpoint
                                }
                            else:
                                logger.warning(f"⚠️ QR code não disponível na resposta: {result}")
                        else:
                            logger.warning(f"⚠️ Endpoint {endpoint} retornou: {response.status_code}")
                            
                except Exception as endpoint_error:
                    logger.warning(f"⚠️ Erro no endpoint {endpoint}: {str(endpoint_error)}")
                    continue
            
            # If no endpoint worked, try to get connection state to understand why
            logger.info("🔍 Verificando estado da conexão para diagnóstico...")
            connection_state = await self.get_instance_status(instance_name)
            
            return {
                'success': False,
                'error': 'QR code not available from any endpoint',
                'instance_name': instance_name,
                'connection_state': connection_state,
                'endpoints_tried': endpoints_to_try,
                'suggestion': 'Instance may already be connected or not properly created'
            }
                
        except Exception as e:
            logger.error(f"❌ Erro ao obter QR code: {str(e)}")
            import traceback
            logger.error(f"❌ Traceback: {traceback.format_exc()}")
            return {'success': False, 'error': str(e), 'instance_name': instance_name}

    async def _generate_qr_code_image(self, qr_text: str) -> str:
        if not qr_text: return ""
        qr = qrcode.QRCode(version=1, error_correction=ERROR_CORRECT_L, box_size=10, border=4)
        qr.add_data(qr_text)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buffer = io.BytesIO()
        img.save(buffer, 'PNG')
        img_base64 = base64.b64encode(buffer.getvalue()).decode()
        # Retorna apenas o base64 puro, sem o prefixo data:image/png;base64,
        # O frontend irá adicionar o prefixo quando necessário
        return img_base64

    async def get_instance_status(self, instance_name: str) -> Dict[str, Any]:
        try:
            # Evolution API v2.2.3 connection state endpoint
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.get(f"{self.base_url}/instance/connectionState/{instance_name}", headers=self.headers)
            if response.status_code == 200:
                result = response.json()
                state = result.get('instance', {}).get('state', result.get('state', 'unknown'))
                return {
                    'success': True, 
                    'status': state, 
                    'connected': state == 'open',
                    'instance_data': result
                }
            else:
                return {'success': False, 'error': f'Failed to get status: HTTP {response.status_code}'}
        except Exception as e:
            logger.error(f"Error getting instance status: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def refresh_instance_status(self, instance_name: str, max_retries: int = 3) -> Dict[str, Any]:
        """
        Refresh and get the current status of a WhatsApp instance with retry logic
        This method forces a fresh status check from Evolution API v2.2.3
        """
        last_error = None
        
        for attempt in range(max_retries):
            try:
                logger.info(f"🔄 Refreshing status for instance: {instance_name} (attempt {attempt + 1}/{max_retries})")
                
                # Evolution API v2.2.3 - Get fresh connection state with timeout
                async with httpx.AsyncClient(timeout=15.0) as client:
                    response = await client.get(
                        f"{self.base_url}/instance/connectionState/{instance_name}",
                        headers=self.headers
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        logger.info(f"✅ Fresh status retrieved (attempt {attempt + 1}): {json.dumps(result, indent=2)[:300]}...")
                        
                        # Extract connection info with multiple fallbacks based on Evolution API v2.2.3 docs
                        instance_data = result.get('instance', {})
                        state = instance_data.get('state') or result.get('state') or 'unknown'
                        
                        # Evolution API v2.2.3 connection states: 'open', 'close', 'connecting'
                        is_connected = (
                            state == 'open' or
                            instance_data.get('connectionStatus') == 'open' or
                            result.get('connected') == True or
                            result.get('status') == 'open'
                        )
                    
                        response_data = {
                            'success': True,
                            'status': state,
                            'connected': is_connected,
                            'connection_state': state,
                            'state': state,  # For compatibility with frontend detection
                            'instance_name': instance_name,
                            'timestamp': datetime.now().isoformat(),
                            'raw_response': result,
                            'evolution_api_version': self.version,
                            'attempt': attempt + 1
                        }
                        
                        # Add additional status info if available
                        if 'ownerJid' in instance_data:
                            response_data['owner_jid'] = instance_data['ownerJid']
                        if 'profileName' in instance_data:
                            response_data['profile_name'] = instance_data['profileName']
                        if 'profilePictureUrl' in instance_data:
                            response_data['profile_picture'] = instance_data['profilePictureUrl']
                            
                        logger.info(f"🎯 Status refresh result: connected={is_connected}, state={state}")
                        return response_data
                        
                    elif response.status_code == 404:
                        logger.warning(f"⚠️ Instance {instance_name} not found (attempt {attempt + 1})")
                        return {
                            'success': False,
                            'error': f'Instance {instance_name} not found',
                            'status': 'not_found',
                            'connected': False,
                            'instance_name': instance_name,
                            'attempt': attempt + 1
                        }
                    else:
                        error_msg = f'Failed to refresh status: HTTP {response.status_code}'
                        logger.warning(f"⚠️ {error_msg} (attempt {attempt + 1}/{max_retries})")
                        last_error = {
                            'error': error_msg,
                            'status': 'error',
                            'connected': False,
                            'instance_name': instance_name,
                            'http_status': response.status_code,
                            'attempt': attempt + 1
                        }
                        
                        # If this is the last attempt, return the error
                        if attempt == max_retries - 1:
                            return {'success': False, **last_error}
                        
                        # Wait before retry with exponential backoff
                        await asyncio.sleep(2 ** attempt)
                        
            except httpx.TimeoutException as e:
                error_msg = f"Timeout while refreshing instance status (attempt {attempt + 1})"
                logger.warning(f"⚠️ {error_msg}")
                last_error = {
                    'error': error_msg,
                    'status': 'timeout',
                    'connected': False,
                    'instance_name': instance_name,
                    'attempt': attempt + 1
                }
                
                if attempt == max_retries - 1:
                    return {'success': False, **last_error}
                    
                await asyncio.sleep(2 ** attempt)
                
            except Exception as e:
                error_msg = f"Error refreshing instance status: {str(e)} (attempt {attempt + 1})"
                logger.warning(f"⚠️ {error_msg}")
                last_error = {
                    'error': error_msg,
                    'status': 'error',
                    'connected': False,
                    'instance_name': instance_name,
                    'attempt': attempt + 1
                }
                
                if attempt == max_retries - 1:
                    return {'success': False, **last_error}
                    
                await asyncio.sleep(2 ** attempt)
        
        # If we get here, all retries failed
        return {'success': False, **last_error} if last_error else {
            'success': False,
            'error': 'All retry attempts failed',
            'status': 'error',
            'connected': False,
            'instance_name': instance_name,
            'max_retries': max_retries
        }

    async def configure_webhook(self, instance_name: str, webhook_url: str, webhook_events: List[str]) -> Dict[str, Any]:
        """
        Configure webhook for a WhatsApp instance
        Evolution API v2.2.3 webhook configuration
        """
        try:
            logger.info(f"🔗 Configurando webhook para instância {instance_name}: {webhook_url}")
            
            webhook_config = {
                "webhook": webhook_url,
                "events": webhook_events,
                "webhook_by_events": True,
                "webhook_base64": False
            }
            
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    f"{self.base_url}/webhook/set/{instance_name}",
                    headers=self.headers,
                    json=webhook_config
                )
                
                if response.status_code == 200 or response.status_code == 201:
                    result = response.json()
                    logger.info(f"✅ Webhook configurado com sucesso: {result}")
                    
                    return {
                        'success': True,
                        'instance_name': instance_name,
                        'webhook_url': webhook_url,
                        'events': webhook_events,
                        'evolution_response': result
                    }
                else:
                    error_msg = f'Failed to configure webhook: HTTP {response.status_code}'
                    logger.error(f"❌ {error_msg}")
                    try:
                        error_detail = response.json()
                        logger.error(f"Error details: {error_detail}")
                        error_msg = f"{error_msg} - {error_detail.get('message', 'Unknown error')}"
                    except:
                        pass
                    
                    return {
                        'success': False,
                        'error': error_msg,
                        'http_status': response.status_code
                    }
                    
        except httpx.TimeoutException:
            error_msg = "Timeout while configuring webhook"
            logger.error(f"❌ {error_msg}")
            return {'success': False, 'error': error_msg}
        except Exception as e:
            error_msg = f"Error configuring webhook: {str(e)}"
            logger.error(f"❌ {error_msg}")
            return {'success': False, 'error': error_msg}

    async def send_message(self, instance_name: str, number: str, message: str) -> Dict[str, Any]:
        try:
            # Evolution API v2.2.3 message sending format
            clean_number = ''.join(c for c in number if c.isdigit() or c == '+')
            if not clean_number.endswith('@s.whatsapp.net'):
                clean_number = f"{clean_number}@s.whatsapp.net"
            
            message_data = {
                "number": clean_number,
                "options": {
                    "delay": 1200,
                    "presence": "composing",
                    "linkPreview": False
                },
                "textMessage": {
                    "text": message
                }
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/message/sendText/{instance_name}", headers=self.headers, json=message_data)
            
            if response.status_code == 200:
                result = response.json()
                return {
                    'success': True, 
                    'message_id': result.get('key', {}).get('id'),
                    'response_data': result
                }
            else:
                return {'success': False, 'error': f'Failed to send message: HTTP {response.status_code}'}
        except Exception as e:
            logger.error(f"Error sending message: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def delete_instance(self, instance_name: str) -> Dict[str, Any]:
        logger.info(f"🗑️ Iniciando exclusão da instância: {instance_name}")
        try:
            # 1. Verificar se a instância existe antes de tentar deletar
            exists_check = await self._check_instance_exists(instance_name)
            if not exists_check.get('exists'):
                logger.info(f"Instância '{instance_name}' não encontrada ou já deletada.")
                return {'success': True, 'message': f'Instance {instance_name} already deleted', 'already_deleted': True}
            
            # 2. Executar a exclusão definitiva
            logger.info(f"Executando exclusão para '{instance_name}'...")
            delete_result = await self._execute_deletion(instance_name)
            
            if not delete_result.get('success'):
                logger.error(f"Falha na execução da exclusão: {delete_result.get('error')}")
                return delete_result

            # 3. Verificar se a exclusão foi bem-sucedida
            logger.info(f"Verificando se a instância '{instance_name}' foi removida...")
            verification_result = await self._verify_deletion_with_retries(instance_name)
            
            return {
                'success': verification_result.get('deleted', False),
                'message': f'Instance {instance_name} deletion process completed.',
                'verified_deleted': verification_result.get('deleted', False)
            }
            
        except Exception as e:
            logger.error(f"Erro no processo de delete_instance para '{instance_name}': {str(e)}")
            return {'success': False, 'error': str(e)}

    async def _check_instance_exists(self, instance_name: str) -> Dict[str, Any]:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/instance/connectionState/{instance_name}", headers=self.headers, timeout=10)
            return {'exists': response.status_code == 200}
        except Exception:
            return {'exists': False}


    async def _execute_deletion(self, instance_name: str) -> Dict[str, Any]:
        # O endpoint correto para deletar é /instance/delete/{instanceName}
        # E o método HTTP correto é DELETE.
        # O parâmetro `properly_logout` é para garantir que a sessão seja encerrada.
        endpoint = f"/instance/delete/{instance_name}?properly_logout=true"
        try:
            async with httpx.AsyncClient() as client:
                response = await client.delete(f"{self.base_url}{endpoint}", headers=self.headers, timeout=45)
            
            if response.status_code in [200, 201, 204]:
                logger.info(f"Sucesso na chamada DELETE para a instância '{instance_name}'. Status: {response.status_code}")
                return {'success': True}
            else:
                logger.error(f"Erro na chamada DELETE para '{instance_name}'. Status: {response.status_code}, Resposta: {response.text}")
                return {'success': False, 'error': f'Deletion failed with status {response.status_code}'}

        except httpx.TimeoutException:
            logger.warning(f"Timeout na chamada DELETE para '{instance_name}'. A operação pode ter sido concluída no servidor.")
            return {'success': True, 'error': 'Deletion timed out, but may be processing.'}
        except Exception as e:
            logger.error(f"Exceção ao deletar instância '{instance_name}': {str(e)}")
            return {'success': False, 'error': str(e)}

    async def _verify_deletion_with_retries(self, instance_name: str, max_retries: int = 5) -> Dict[str, Any]:
        for attempt in range(max_retries):
            await asyncio.sleep(2 * (attempt + 1))
            if not (await self._check_instance_exists(instance_name)).get('exists'):
                logger.info(f"✅ Instance deleted confirmed after {attempt + 1} attempts.")
                return {'deleted': True}
        logger.warning(f"❌ Instance still exists after {max_retries} attempts.")
        return {'deleted': False}

    async def list_instances(self) -> Dict[str, Any]:
        try:
            # Evolution API v2.2.3 instance listing endpoint
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.get(f"{self.base_url}/instance/fetchInstances", headers=self.headers)
            
            if response.status_code == 200:
                result = response.json()
                instances = result if isinstance(result, list) else result.get('instances', [])
                return {
                    'success': True, 
                    'instances': instances, 
                    'count': len(instances),
                    'raw_response': result
                }
            else:
                return {'success': False, 'error': f'Failed to list instances: HTTP {response.status_code}', 'status_code': response.status_code}
        except Exception as e:
            logger.error(f"Error listing instances: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def set_webhook(self, instance_name: str, webhook_url: str, webhook_events: Optional[List[str]] = None) -> Dict[str, Any]:
        try:
            # Evolution API v2.2.3 webhook configuration
            webhook_events = webhook_events or [
                "APPLICATION_STARTUP", "QRCODE_UPDATED", "MESSAGES_UPSERT", 
                "MESSAGES_UPDATE", "MESSAGES_DELETE", "SEND_MESSAGE", 
                "CONTACTS_SET", "CONTACTS_UPSERT", "CONTACTS_UPDATE", 
                "PRESENCE_UPDATE", "CHATS_SET", "CHATS_UPSERT", 
                "CHATS_UPDATE", "CHATS_DELETE", "GROUPS_UPSERT", 
                "GROUP_UPDATE", "GROUP_PARTICIPANTS_UPDATE", "CONNECTION_UPDATE"
            ]
            
            webhook_data = {
                "url": webhook_url,
                "enabled": True,
                "events": webhook_events,
                "webhookByEvents": False,
                "webhookBase64": False
            }
            
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(f"{self.base_url}/webhook/set/{instance_name}", headers=self.headers, json=webhook_data)
            
            if response.status_code == 200:
                return {
                    'success': True, 
                    'message': 'Webhook configured successfully', 
                    'instance_name': instance_name, 
                    'webhook_url': webhook_url, 
                    'events': webhook_events,
                    'response_data': response.json()
                }
            else:
                return {'success': False, 'error': f'Failed to set webhook: HTTP {response.status_code}', 'status_code': response.status_code}
        except Exception as e:
            logger.error(f"Error setting webhook: {str(e)}")
            return {'success': False, 'error': str(e)}

    async def debug_instance_status(self, instance_name: str) -> Dict[str, Any]:
        debug_info = {'instance_name': instance_name, 'timestamp': datetime.utcnow().isoformat(), 'checks': {}}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/instance/connectionState/{instance_name}", headers=self.headers, timeout=10)
            debug_info['checks']['connection_state'] = {'status_code': response.status_code, 'response': response.json() if response.status_code == 200 else response.text}
        except Exception as e:
            debug_info['checks']['connection_state'] = {'error': str(e)}
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{self.base_url}/instance/fetchInstances", headers=self.headers, timeout=10)
            if response.status_code == 200:
                instances = response.json()
                found_in_list = any(inst.get('instance', {}).get('instanceName') == instance_name for inst in instances)
                debug_info['checks']['instance_list'] = {'total_instances': len(instances), 'found_in_list': found_in_list, 'instance_names': [inst.get('instance', {}).get('instanceName') for inst in instances]}
            else:
                debug_info['checks']['instance_list'] = {'error': f'HTTP {response.status_code}'}
        except Exception as e:
            debug_info['checks']['instance_list'] = {'error': str(e)}
        return debug_info