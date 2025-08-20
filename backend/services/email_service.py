"""
Email Service for SendGrid and SMTP integration
Handles email sending, templates, and delivery tracking
"""

import smtplib
import requests
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Dict, Any, List, Optional
from datetime import datetime
import json

logger = logging.getLogger(__name__)

class SendGridEmailService:
    """SendGrid email service integration"""
    
    def __init__(self, api_key: str):
        """
        Initialize SendGrid service
        
        Args:
            api_key: SendGrid API key
        """
        self.api_key = api_key
        self.base_url = "https://api.sendgrid.com/v3"
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
    
    async def send_email(
        self,
        to_emails: List[str],
        subject: str,
        content: str,
        from_email: str,
        from_name: str = None,
        content_type: str = "text/html",
        template_id: str = None,
        template_data: Dict = None
    ) -> Dict[str, Any]:
        """
        Send email via SendGrid
        
        Args:
            to_emails: List of recipient emails
            subject: Email subject
            content: Email content (HTML or text)
            from_email: Sender email
            from_name: Sender name
            content_type: Content type ('text/html' or 'text/plain')
            template_id: SendGrid template ID (optional)
            template_data: Template variables (optional)
            
        Returns:
            Dict with send result
        """
        try:
            # Prepare recipient list
            to_list = [{"email": email} for email in to_emails]
            
            # Prepare email data
            email_data = {
                "personalizations": [{
                    "to": to_list,
                    "subject": subject
                }],
                "from": {
                    "email": from_email,
                    "name": from_name or from_email
                },
                "reply_to": {
                    "email": from_email,
                    "name": from_name or from_email
                }
            }
            
            # Add template data if using template
            if template_id and template_data:
                email_data["template_id"] = template_id
                email_data["personalizations"][0]["dynamic_template_data"] = template_data
            else:
                # Add content
                email_data["content"] = [{
                    "type": content_type,
                    "value": content
                }]
            
            # Send email
            response = requests.post(
                f"{self.base_url}/mail/send",
                headers=self.headers,
                json=email_data
            )
            
            if response.status_code == 202:
                return {
                    'success': True,
                    'message': 'Email sent successfully',
                    'recipients': to_emails,
                    'subject': subject,
                    'sent_at': datetime.utcnow().isoformat(),
                    'provider': 'sendgrid'
                }
            else:
                error_data = response.json() if response.headers.get('content-type') == 'application/json' else {}
                return {
                    'success': False,
                    'error': error_data.get('errors', [{'message': f'HTTP {response.status_code}'}])[0].get('message'),
                    'status_code': response.status_code,
                    'provider': 'sendgrid'
                }
                
        except Exception as e:
            logger.error(f"Error sending email via SendGrid: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'sendgrid'
            }
    
    async def send_payment_confirmation(
        self,
        to_email: str,
        customer_name: str,
        payment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send payment confirmation email
        
        Args:
            to_email: Customer email
            customer_name: Customer name
            payment_data: Payment information
            
        Returns:
            Dict with send result
        """
        try:
            provider = payment_data.get('provider', 'unknown')
            amount = payment_data.get('amount', 0)
            description = payment_data.get('description', 'Pagamento')
            payment_id = payment_data.get('payment_id', payment_data.get('payment_link_id'))
            
            subject = f"Confirmação de Pagamento - {description}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Confirmação de Pagamento</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }}
                    .container {{ max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .success-icon {{ font-size: 48px; color: #28a745; margin-bottom: 20px; }}
                    h1 {{ color: #333; margin: 0; }}
                    .payment-info {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }}
                    .payment-row {{ display: flex; justify-content: space-between; margin: 10px 0; }}
                    .label {{ font-weight: bold; color: #666; }}
                    .value {{ color: #333; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="success-icon">✅</div>
                        <h1>Pagamento Confirmado!</h1>
                    </div>
                    
                    <p>Olá {customer_name},</p>
                    
                    <p>Seu pagamento foi processado com sucesso. Abaixo estão os detalhes da transação:</p>
                    
                    <div class="payment-info">
                        <div class="payment-row">
                            <span class="label">Descrição:</span>
                            <span class="value">{description}</span>
                        </div>
                        <div class="payment-row">
                            <span class="label">Valor:</span>
                            <span class="value">R$ {amount:.2f}</span>
                        </div>
                        <div class="payment-row">
                            <span class="label">ID da Transação:</span>
                            <span class="value">{payment_id}</span>
                        </div>
                        <div class="payment-row">
                            <span class="label">Provedor:</span>
                            <span class="value">{provider.title()}</span>
                        </div>
                        <div class="payment-row">
                            <span class="label">Data:</span>
                            <span class="value">{datetime.now().strftime('%d/%m/%Y às %H:%M')}</span>
                        </div>
                    </div>
                    
                    <p>Se você tiver alguma dúvida sobre este pagamento, entre em contato conosco.</p>
                    
                    <div class="footer">
                        <p>Este é um e-mail automático, não responda a esta mensagem.</p>
                        <p>SDK Agentes Especializados - Sistema de Pagamentos</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            return await self.send_email(
                to_emails=[to_email],
                subject=subject,
                content=html_content,
                from_email="noreply@sdkagents.com",
                from_name="SDK Agentes",
                content_type="text/html"
            )
            
        except Exception as e:
            logger.error(f"Error sending payment confirmation email: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'sendgrid'
            }

class SMTPEmailService:
    """SMTP email service for standard email sending"""
    
    def __init__(
        self,
        smtp_server: str,
        smtp_port: int,
        username: str,
        password: str,
        use_tls: bool = True
    ):
        """
        Initialize SMTP service
        
        Args:
            smtp_server: SMTP server hostname
            smtp_port: SMTP server port
            username: SMTP username
            password: SMTP password
            use_tls: Use TLS encryption
        """
        self.smtp_server = smtp_server
        self.smtp_port = smtp_port
        self.username = username
        self.password = password
        self.use_tls = use_tls
    
    async def send_email(
        self,
        to_emails: List[str],
        subject: str,
        content: str,
        from_email: str,
        from_name: str = None,
        content_type: str = "html"
    ) -> Dict[str, Any]:
        """
        Send email via SMTP
        
        Args:
            to_emails: List of recipient emails
            subject: Email subject
            content: Email content
            from_email: Sender email
            from_name: Sender name
            content_type: Content type ('html' or 'plain')
            
        Returns:
            Dict with send result
        """
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{from_name} <{from_email}>" if from_name else from_email
            msg['To'] = ', '.join(to_emails)
            
            # Add content
            if content_type == 'html':
                msg.attach(MIMEText(content, 'html', 'utf-8'))
            else:
                msg.attach(MIMEText(content, 'plain', 'utf-8'))
            
            # Send email
            with smtplib.SMTP(self.smtp_server, self.smtp_port) as server:
                if self.use_tls:
                    server.starttls()
                server.login(self.username, self.password)
                server.send_message(msg)
            
            return {
                'success': True,
                'message': 'Email sent successfully',
                'recipients': to_emails,
                'subject': subject,
                'sent_at': datetime.utcnow().isoformat(),
                'provider': 'smtp'
            }
            
        except Exception as e:
            logger.error(f"Error sending email via SMTP: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'smtp'
            }

class EmailManager:
    """Unified email manager for multiple providers"""
    
    def __init__(self, sendgrid_config: Dict = None, smtp_config: Dict = None):
        """
        Initialize email manager
        
        Args:
            sendgrid_config: Dict with 'api_key'
            smtp_config: Dict with SMTP configuration
        """
        self.sendgrid_service = None
        self.smtp_service = None
        
        if sendgrid_config and sendgrid_config.get('api_key'):
            self.sendgrid_service = SendGridEmailService(
                api_key=sendgrid_config['api_key']
            )
        
        if smtp_config and all(k in smtp_config for k in ['server', 'port', 'username', 'password']):
            self.smtp_service = SMTPEmailService(
                smtp_server=smtp_config['server'],
                smtp_port=smtp_config['port'],
                username=smtp_config['username'],
                password=smtp_config['password'],
                use_tls=smtp_config.get('use_tls', True)
            )
    
    async def send_email(
        self,
        provider: str,
        to_emails: List[str],
        subject: str,
        content: str,
        from_email: str,
        **kwargs
    ) -> Dict[str, Any]:
        """
        Send email using specified provider
        
        Args:
            provider: 'sendgrid' or 'smtp'
            to_emails: List of recipient emails
            subject: Email subject
            content: Email content
            from_email: Sender email
            **kwargs: Provider-specific parameters
            
        Returns:
            Dict with send result
        """
        if provider.lower() == 'sendgrid' and self.sendgrid_service:
            return await self.sendgrid_service.send_email(
                to_emails=to_emails,
                subject=subject,
                content=content,
                from_email=from_email,
                **kwargs
            )
        elif provider.lower() == 'smtp' and self.smtp_service:
            return await self.smtp_service.send_email(
                to_emails=to_emails,
                subject=subject,
                content=content,
                from_email=from_email,
                **kwargs
            )
        else:
            return {
                'success': False,
                'error': f'Email provider {provider} not configured',
                'provider': provider
            }
    
    async def send_appointment_confirmation(
        self,
        provider: str,
        to_email: str,
        customer_name: str,
        appointment_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Send appointment confirmation email
        
        Args:
            provider: Email provider to use
            to_email: Customer email
            customer_name: Customer name
            appointment_data: Appointment information
            
        Returns:
            Dict with send result
        """
        try:
            title = appointment_data.get('title', 'Agendamento')
            start_time = appointment_data.get('start_time', '')
            end_time = appointment_data.get('end_time', '')
            location = appointment_data.get('location', 'A definir')
            description = appointment_data.get('description', '')
            event_url = appointment_data.get('event_url', '')
            hangout_link = appointment_data.get('hangout_link', '')
            
            subject = f"Confirmação de Agendamento - {title}"
            
            html_content = f"""
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Confirmação de Agendamento</title>
                <style>
                    body {{ font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }}
                    .container {{ max-width: 600px; margin: 0 auto; background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
                    .header {{ text-align: center; margin-bottom: 30px; }}
                    .calendar-icon {{ font-size: 48px; color: #007aff; margin-bottom: 20px; }}
                    h1 {{ color: #333; margin: 0; }}
                    .appointment-info {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0; }}
                    .appointment-row {{ display: flex; justify-content: space-between; margin: 10px 0; }}
                    .label {{ font-weight: bold; color: #666; }}
                    .value {{ color: #333; }}
                    .buttons {{ text-align: center; margin: 30px 0; }}
                    .btn {{ display: inline-block; padding: 12px 24px; margin: 0 10px; text-decoration: none; border-radius: 5px; font-weight: bold; }}
                    .btn-primary {{ background-color: #007aff; color: white; }}
                    .btn-secondary {{ background-color: #28a745; color: white; }}
                    .footer {{ text-align: center; margin-top: 30px; color: #666; font-size: 14px; }}
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="calendar-icon">📅</div>
                        <h1>Agendamento Confirmado!</h1>
                    </div>
                    
                    <p>Olá {customer_name},</p>
                    
                    <p>Seu agendamento foi confirmado com sucesso. Abaixo estão os detalhes:</p>
                    
                    <div class="appointment-info">
                        <div class="appointment-row">
                            <span class="label">Título:</span>
                            <span class="value">{title}</span>
                        </div>
                        <div class="appointment-row">
                            <span class="label">Data/Hora de Início:</span>
                            <span class="value">{start_time}</span>
                        </div>
                        <div class="appointment-row">
                            <span class="label">Data/Hora de Término:</span>
                            <span class="value">{end_time}</span>
                        </div>
                        <div class="appointment-row">
                            <span class="label">Local:</span>
                            <span class="value">{location}</span>
                        </div>
                        {f'<div class="appointment-row"><span class="label">Descrição:</span><span class="value">{description}</span></div>' if description else ''}
                    </div>
                    
                    <div class="buttons">
                        {f'<a href="{event_url}" class="btn btn-primary">Ver no Google Calendar</a>' if event_url else ''}
                        {f'<a href="{hangout_link}" class="btn btn-secondary">Entrar na Reunião</a>' if hangout_link else ''}
                    </div>
                    
                    <p>Lembre-se de adicionar este evento ao seu calendário pessoal.</p>
                    
                    <div class="footer">
                        <p>Se precisar reagendar ou cancelar, entre em contato conosco.</p>
                        <p>SDK Agentes Especializados - Sistema de Agendamentos</p>
                    </div>
                </div>
            </body>
            </html>
            """
            
            return await self.send_email(
                provider=provider,
                to_emails=[to_email],
                subject=subject,
                content=html_content,
                from_email="noreply@sdkagents.com",
                from_name="SDK Agentes",
                content_type="text/html"
            )
            
        except Exception as e:
            logger.error(f"Error sending appointment confirmation email: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': provider
            }
    
    def get_available_providers(self) -> List[str]:
        """Get list of available email providers"""
        providers = []
        if self.sendgrid_service:
            providers.append('sendgrid')
        if self.smtp_service:
            providers.append('smtp')
        return providers