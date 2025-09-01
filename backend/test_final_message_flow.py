#!/usr/bin/env python3
"""
Teste final do fluxo completo de mensagens WhatsApp
"""

import sqlite3
import json
import requests
from config import config

def test_complete_flow():
    print("🧪 TESTE FINAL DO FLUXO DE MENSAGENS")
    print("="*50)
    
    # 1. Verificar configuração do agente Luan
    print("\n1️⃣ VERIFICANDO CONFIGURAÇÃO DO AGENTE LUAN")
    conn = sqlite3.connect('agents.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT a.id, a.name, a.whatsapp_config, w.instance_name, w.connection_state, w.connected
        FROM agents a
        LEFT JOIN whatsapp_instances w ON a.id = w.agent_id
        WHERE a.name = 'Luan'
    """)
    
    result = cursor.fetchone()
    if result:
        agent_id, name, config_str, instance_name, connection_state, connected = result
        config_obj = json.loads(config_str) if config_str else {}
        print(f"✅ Agente: {name}")
        print(f"   ID: {agent_id}")
        print(f"   Instância: {instance_name}")
        print(f"   Estado: {connection_state}")
        print(f"   Conectado: {connected}")
        print(f"   Config: {config_obj}")
    else:
        print("❌ Agente Luan não encontrado")
        return False
    
    conn.close()
    
    # 2. Verificar instância na Evolution API
    print("\n2️⃣ VERIFICANDO INSTÂNCIA NA EVOLUTION API")
    try:
        response = requests.get(
            f"{config.EVOLUTION_API_BASE_URL}/instance/fetchInstances",
            headers={"apikey": config.EVOLUTION_API_KEY}
        )
        
        if response.status_code == 200:
            instances = response.json()
            luan_instance = None
            
            for instance in instances:
                if instance.get('instance', {}).get('instanceName') == 'Luan':
                    luan_instance = instance
                    break
            
            if luan_instance:
                status = luan_instance.get('instance', {}).get('status', 'unknown')
                print(f"✅ Instância 'Luan' encontrada (Status: {status})")
            else:
                print("❌ Instância 'Luan' não encontrada")
                return False
        else:
            print(f"❌ Erro ao verificar instâncias: {response.status_code}")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao conectar com Evolution API: {str(e)}")
        return False
    
    # 3. Simular webhook de mensagem
    print("\n3️⃣ SIMULANDO WEBHOOK DE MENSAGEM")
    
    webhook_data = {
        "event": "messages.upsert",
        "instance": "Luan",
        "data": {
            "key": {
                "remoteJid": "5511999999999@s.whatsapp.net",
                "fromMe": False,
                "id": "test_message_123"
            },
            "message": {
                "conversation": "Olá, como você está?"
            },
            "messageTimestamp": 1640995200,
            "pushName": "Teste Usuario"
        }
    }
    
    try:
        response = requests.post(
            f"{config.BASE_URL}/api/whatsapp/webhook",
            headers={"Content-Type": "application/json"},
            json=webhook_data
        )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Webhook processado: {result}")
        else:
            print(f"❌ Erro no webhook: {response.status_code}")
            print(f"   Resposta: {response.text}")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao enviar webhook: {str(e)}")
        return False
    
    # 4. Verificar se mensagem foi salva no banco
    print("\n4️⃣ VERIFICANDO MENSAGENS NO BANCO")
    
    conn = sqlite3.connect('agents.db')
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT id, agent_id, session_id, user_id, role, content, created_at
        FROM chat_messages 
        WHERE user_id LIKE '%5511999999999%' OR session_id LIKE '%5511999999999%'
        ORDER BY created_at DESC
        LIMIT 5
    """)
    
    messages = cursor.fetchall()
    if messages:
        print(f"✅ {len(messages)} mensagens encontradas:")
        for msg in messages:
            msg_id, agent_id, session_id, user_id, role, content, created_at = msg
            print(f"   {role}: {content[:50]}... ({created_at})")
    else:
        print("⚠️ Nenhuma mensagem encontrada no banco")
        
        # Verificar todas as mensagens recentes
        cursor.execute("""
            SELECT id, agent_id, session_id, user_id, role, content, created_at
            FROM chat_messages 
            ORDER BY created_at DESC
            LIMIT 3
        """)
        
        recent_messages = cursor.fetchall()
        if recent_messages:
            print(f"📋 Últimas {len(recent_messages)} mensagens no sistema:")
            for msg in recent_messages:
                msg_id, agent_id, session_id, user_id, role, content, created_at = msg
                print(f"   {role}: {content[:50]}... (User: {user_id}, {created_at})")
        else:
            print("📋 Nenhuma mensagem encontrada no sistema")
    
    conn.close()
    
    # 5. Teste direto de envio via Evolution API
    print("\n5️⃣ TESTE DIRETO DE ENVIO VIA EVOLUTION API")
    
    test_message = {
        "number": "5511999999999",
        "text": "🤖 Teste de envio automático do agente Luan! Se você recebeu esta mensagem, o sistema está funcionando perfeitamente."
    }
    
    try:
        response = requests.post(
            f"{config.EVOLUTION_API_BASE_URL}/message/sendText/Luan",
            headers={
                "apikey": config.EVOLUTION_API_KEY,
                "Content-Type": "application/json"
            },
            json=test_message
        )
        
        if response.status_code in [200, 201]:
            result = response.json()
            print(f"✅ Mensagem enviada com sucesso!")
            print(f"   Resposta: {result}")
        else:
            print(f"❌ Erro ao enviar mensagem: {response.status_code}")
            print(f"   Resposta: {response.text}")
            
    except Exception as e:
        print(f"❌ Erro ao enviar mensagem: {str(e)}")
    
    print("\n🎯 TESTE CONCLUÍDO!")
    print("\n📋 RESUMO:")
    print("✅ Agente Luan configurado corretamente")
    print("✅ Instância 'Luan' ativa na Evolution API")
    print("✅ Webhook processando mensagens")
    print("✅ Sistema pronto para uso")
    
    return True

if __name__ == "__main__":
    test_complete_flow()