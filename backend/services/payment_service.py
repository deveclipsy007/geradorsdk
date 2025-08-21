"""
Payment Service for Stripe and Asaas Integration
Handles payment link generation and processing
"""

import stripe
import requests
import json
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime, timedelta
from decimal import Decimal

logger = logging.getLogger(__name__)

class StripePaymentService:
    """Stripe payment integration with AI Agents SDK support"""
    
    def __init__(self, api_key: str, webhook_secret: str = None):
        """
        Initialize Stripe service
        
        Args:
            api_key: Stripe secret key
            webhook_secret: Webhook endpoint secret for verification
        """
        stripe.api_key = api_key
        self.webhook_secret = webhook_secret
        
    async def create_payment_link(
        self,
        amount: Decimal,
        currency: str = "brl",
        description: str = "",
        customer_email: str = None,
        metadata: Dict[str, str] = None,
        success_url: str = None,
        cancel_url: str = None
    ) -> Dict[str, Any]:
        """
        Create Stripe payment link
        
        Args:
            amount: Payment amount in smallest currency unit (cents)
            currency: Currency code (default: brl)
            description: Payment description
            customer_email: Customer email for receipt
            metadata: Additional metadata
            success_url: Redirect URL on success
            cancel_url: Redirect URL on cancel
            
        Returns:
            Dict with payment link data
        """
        try:
            # Create price object
            price = stripe.Price.create(
                unit_amount=int(amount * 100),  # Convert to cents
                currency=currency,
                product_data={
                    'name': description or 'Pagamento SDK Agent'
                }
            )
            
            # Create payment link
            payment_link = stripe.PaymentLink.create(
                line_items=[{
                    'price': price.id,
                    'quantity': 1,
                }],
                after_completion={
                    'type': 'redirect',
                    'redirect': {
                        'url': success_url or 'https://example.com/success'
                    }
                } if success_url else {
                    'type': 'hosted_confirmation',
                    'hosted_confirmation': {
                        'custom_message': 'Pagamento realizado com sucesso!'
                    }
                },
                metadata=metadata or {},
                customer_creation='always',
                invoice_creation={
                    'enabled': True,
                    'invoice_data': {
                        'description': description,
                        'metadata': metadata or {},
                        'custom_fields': None,
                    }
                }
            )
            
            return {
                'success': True,
                'payment_link_id': payment_link.id,
                'url': payment_link.url,
                'price_id': price.id,
                'amount': float(amount),
                'currency': currency,
                'description': description,
                'created_at': datetime.utcnow().isoformat(),
                'expires_at': None,  # Stripe payment links don't expire by default
                'provider': 'stripe'
            }
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error creating payment link: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'stripe'
            }
        except Exception as e:
            logger.error(f"Unexpected error creating Stripe payment link: {str(e)}")
            return {
                'success': False,
                'error': f"Unexpected error: {str(e)}",
                'provider': 'stripe'
            }
    
    async def get_payment_status(self, payment_link_id: str) -> Dict[str, Any]:
        """Get payment link status from Stripe"""
        try:
            payment_link = stripe.PaymentLink.retrieve(payment_link_id)
            return {
                'success': True,
                'status': payment_link.active,
                'url': payment_link.url,
                'provider': 'stripe'
            }
        except Exception as e:
            logger.error(f"Error getting Stripe payment status: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'stripe'
            }

class AsaasPaymentService:
    """Asaas payment gateway integration for Brazilian market"""
    
    def __init__(self, api_key: str, sandbox: bool = True):
        """
        Initialize Asaas service
        
        Args:
            api_key: Asaas API key
            sandbox: Use sandbox environment
        """
        self.api_key = api_key
        self.base_url = "https://sandbox.asaas.com/api/v3" if sandbox else "https://www.asaas.com/api/v3"
        self.headers = {
            "access_token": api_key,
            "Content-Type": "application/json"
        }
    
    async def create_payment_link(
        self,
        amount: Decimal,
        description: str = "",
        customer_name: str = None,
        customer_email: str = None,
        customer_cpf: str = None,
        due_date: datetime = None,
        billing_type: str = "UNDEFINED",  # PIX, BOLETO, CREDIT_CARD, UNDEFINED
        external_reference: str = None
    ) -> Dict[str, Any]:
        """
        Create Asaas payment
        
        Args:
            amount: Payment amount in BRL
            description: Payment description
            customer_name: Customer name
            customer_email: Customer email
            customer_cpf: Customer CPF (Brazilian tax ID)
            due_date: Payment due date
            billing_type: Payment method (PIX, BOLETO, CREDIT_CARD, UNDEFINED)
            external_reference: External reference ID
            
        Returns:
            Dict with payment data
        """
        try:
            # Create or get customer
            customer_data = None
            if customer_email or customer_cpf:
                customer_data = await self._create_or_get_customer(
                    name=customer_name,
                    email=customer_email,
                    cpf=customer_cpf
                )
            
            # Prepare payment data
            payment_data = {
                "value": float(amount),
                "description": description or "Pagamento SDK Agent",
                "dueDate": (due_date or datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
                "billingType": billing_type,
                "externalReference": external_reference,
                "postalService": False
            }
            
            if customer_data and customer_data.get('success'):
                payment_data["customer"] = customer_data["customer_id"]
            
            # Create payment
            response = requests.post(
                f"{self.base_url}/payments",
                headers=self.headers,
                json=payment_data
            )
            
            if response.status_code == 200:
                payment = response.json()
                
                # Generate PIX QR Code if PIX payment
                pix_data = None
                if billing_type in ["PIX", "UNDEFINED"]:
                    pix_data = await self._generate_pix_qr_code(payment["id"])
                
                return {
                    'success': True,
                    'payment_id': payment["id"],
                    'url': payment.get("invoiceUrl"),
                    'bankSlipUrl': payment.get("bankSlipUrl"),
                    'amount': float(amount),
                    'description': description,
                    'due_date': payment.get("dueDate"),
                    'status': payment.get("status"),
                    'billing_type': billing_type,
                    'pix_qr_code': pix_data.get("qrCode") if pix_data else None,
                    'pix_code': pix_data.get("payload") if pix_data else None,
                    'created_at': datetime.utcnow().isoformat(),
                    'provider': 'asaas'
                }
            else:
                error_msg = response.json().get("errors", [{"description": "Unknown error"}])[0]["description"]
                return {
                    'success': False,
                    'error': error_msg,
                    'provider': 'asaas'
                }
                
        except Exception as e:
            logger.error(f"Error creating Asaas payment: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'asaas'
            }
    
    async def _create_or_get_customer(self, name: str, email: str, cpf: str) -> Dict[str, Any]:
        """Create or retrieve customer in Asaas"""
        try:
            # Search for existing customer
            search_params = {}
            if email:
                search_params["email"] = email
            elif cpf:
                search_params["cpfCnpj"] = cpf
            
            if search_params:
                response = requests.get(
                    f"{self.base_url}/customers",
                    headers=self.headers,
                    params=search_params
                )
                
                if response.status_code == 200:
                    customers = response.json()["data"]
                    if customers:
                        return {
                            'success': True,
                            'customer_id': customers[0]["id"]
                        }
            
            # Create new customer
            customer_data = {
                "name": name or "Cliente SDK Agent",
                "email": email,
                "cpfCnpj": cpf
            }
            
            response = requests.post(
                f"{self.base_url}/customers",
                headers=self.headers,
                json=customer_data
            )
            
            if response.status_code == 200:
                customer = response.json()
                return {
                    'success': True,
                    'customer_id': customer["id"]
                }
            else:
                return {'success': False, 'error': 'Failed to create customer'}
                
        except Exception as e:
            logger.error(f"Error managing Asaas customer: {str(e)}")
            return {'success': False, 'error': str(e)}
    
    async def _generate_pix_qr_code(self, payment_id: str) -> Dict[str, Any]:
        """Generate PIX QR code for payment"""
        try:
            response = requests.get(
                f"{self.base_url}/payments/{payment_id}/pixQrCode",
                headers=self.headers
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                return {}
                
        except Exception as e:
            logger.error(f"Error generating PIX QR code: {str(e)}")
            return {}
    
    async def get_payment_status(self, payment_id: str) -> Dict[str, Any]:
        """Get payment status from Asaas"""
        try:
            response = requests.get(
                f"{self.base_url}/payments/{payment_id}",
                headers=self.headers
            )
            
            if response.status_code == 200:
                payment = response.json()
                return {
                    'success': True,
                    'status': payment.get("status"),
                    'value': payment.get("value"),
                    'due_date': payment.get("dueDate"),
                    'provider': 'asaas'
                }
            else:
                return {
                    'success': False,
                    'error': 'Payment not found',
                    'provider': 'asaas'
                }
                
        except Exception as e:
            logger.error(f"Error getting Asaas payment status: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'provider': 'asaas'
            }

class PaymentManager:
    """Unified payment manager for Stripe and Asaas"""
    
    def __init__(self, stripe_config: Dict = None, asaas_config: Dict = None):
        """
        Initialize payment manager
        
        Args:
            stripe_config: Dict with 'api_key' and optionally 'webhook_secret'
            asaas_config: Dict with 'api_key' and optionally 'sandbox'
        """
        self.stripe_service = None
        self.asaas_service = None
        
        if stripe_config and stripe_config.get('api_key'):
            self.stripe_service = StripePaymentService(
                api_key=stripe_config['api_key'],
                webhook_secret=stripe_config.get('webhook_secret')
            )
        
        if asaas_config and asaas_config.get('api_key'):
            self.asaas_service = AsaasPaymentService(
                api_key=asaas_config['api_key'],
                sandbox=asaas_config.get('sandbox', True)
            )
    
    async def create_payment_link(
        self,
        provider: str,
        amount: Decimal,
        currency: str = "brl",
        **kwargs
    ) -> Dict[str, Any]:
        """
        Create payment link using specified provider
        
        Args:
            provider: 'stripe' or 'asaas'
            amount: Payment amount
            currency: Currency code
            **kwargs: Provider-specific parameters
            
        Returns:
            Dict with payment link data
        """
        if provider.lower() == 'stripe' and self.stripe_service:
            return await self.stripe_service.create_payment_link(
                amount=amount,
                currency=currency,
                **kwargs
            )
        elif provider.lower() == 'asaas' and self.asaas_service:
            return await self.asaas_service.create_payment_link(
                amount=amount,
                **kwargs
            )
        else:
            return {
                'success': False,
                'error': f'Provider {provider} not configured or unavailable',
                'provider': provider
            }
    
    async def get_payment_status(self, provider: str, payment_id: str) -> Dict[str, Any]:
        """Get payment status from specified provider"""
        if provider.lower() == 'stripe' and self.stripe_service:
            return await self.stripe_service.get_payment_status(payment_id)
        elif provider.lower() == 'asaas' and self.asaas_service:
            return await self.asaas_service.get_payment_status(payment_id)
        else:
            return {
                'success': False,
                'error': f'Provider {provider} not configured',
                'provider': provider
            }
    
    def get_available_providers(self) -> List[str]:
        """Get list of available payment providers"""
        providers = []
        if self.stripe_service:
            providers.append('stripe')
        if self.asaas_service:
            providers.append('asaas')
        return providers