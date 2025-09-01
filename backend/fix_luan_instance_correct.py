#!/usr/bin/env python3
"""
Script para corrigir a associação do agente Luan com a instância correta 'Luan'
"""

import sqlite3
import json
import requests
from config import config

def fix_luan_instance():
    print("🔧 CORRIGINDO ASSOCIAÇÃO DO AGENTE LUAN")
    print("="*50)
    
    # Conectar ao banco de dados
    conn = sqlite3.connect('agents.db')
    cursor = conn.cursor()
    
    try:
        # 1. Verificar agente Luan atual
        print("\n1️⃣ VERIFICANDO AGENTE LUAN ATUAL")
        cursor.execute("""
            SELECT id, name, whatsapp_config 
            FROM agents 
            WHERE name = 'Luan'
        """)
        
        agent_result = cursor.fetchone()
        if not agent_result:
            print("❌ Agente Luan não encontrado!")
            return False
            
        agent_id, agent_name, whatsapp_config_str = agent_result
        whatsapp_config = json.loads(whatsapp_config_str) if whatsapp_config_str else {}
        
        print(f"✅ Agente encontrado: {agent_name} (ID: {agent_id})")
        print(f"   Configuração atual: {whatsapp_config}")
        
        # 2. Verificar instância 'Luan' na Evolution API
        print("\n2️⃣ VERIFICANDO INSTÂNCIA 'Luan' NA EVOLUTION API")
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
                    print(f"✅ Instância 'Luan' encontrada na Evolution API (Status: {status})")
                else:
                    print("❌ Instância 'Luan' não encontrada na Evolution API")
                    return False
            else:
                print(f"❌ Erro ao verificar instâncias: {response.status_code}")
                return False
                
        except Exception as e:
            print(f"❌ Erro ao conectar com Evolution API: {str(e)}")
            return False
        
        # 3. Atualizar configuração do agente
        print("\n3️⃣ ATUALIZANDO CONFIGURAÇÃO DO AGENTE")
        
        # Atualizar whatsapp_config para usar instância 'Luan'
        new_whatsapp_config = {
            "instance_name": "Luan",
            "webhook_url": f"{config.BASE_URL}/api/whatsapp/webhook",
            "enabled": True
        }
        
        cursor.execute("""
            UPDATE agents 
            SET whatsapp_config = ?
            WHERE id = ?
        """, (json.dumps(new_whatsapp_config), agent_id))
        
        print(f"✅ Configuração do agente atualizada: {new_whatsapp_config}")
        
        # 4. Verificar/atualizar tabela whatsapp_instances
        print("\n4️⃣ VERIFICANDO TABELA WHATSAPP_INSTANCES")
        
        cursor.execute("""
            SELECT instance_name, agent_id, connection_state, connected 
            FROM whatsapp_instances 
            WHERE instance_name = 'Luan'
        """)
        
        instance_result = cursor.fetchone()
        
        if instance_result:
            instance_name, current_agent_id, connection_state, connected = instance_result
            print(f"✅ Instância 'Luan' encontrada na tabela (Agent ID: {current_agent_id}, State: {connection_state}, Connected: {connected})")
            
            if current_agent_id != agent_id:
                print(f"🔄 Atualizando agent_id de {current_agent_id} para {agent_id}")
                cursor.execute("""
                    UPDATE whatsapp_instances 
                    SET agent_id = ?, last_update = CURRENT_TIMESTAMP
                    WHERE instance_name = 'Luan'
                """, (agent_id,))
                print("✅ Agent ID atualizado na tabela whatsapp_instances")
        else:
            print("➕ Criando entrada na tabela whatsapp_instances")
            cursor.execute("""
                INSERT INTO whatsapp_instances (instance_name, agent_id, connection_state, connected, last_update)
                VALUES ('Luan', ?, 'open', 1, CURRENT_TIMESTAMP)
            """, (agent_id,))
            print("✅ Entrada criada na tabela whatsapp_instances")
        
        # 5. Configurar webhook na Evolution API
        print("\n5️⃣ CONFIGURANDO WEBHOOK NA EVOLUTION API")
        
        webhook_url = f"{config.BASE_URL}/api/whatsapp/webhook"
        webhook_data = {
            "webhook": webhook_url,
            "webhook_by_events": False,
            "events": [
                "CONNECTION_UPDATE",
                "MESSAGES_UPSERT",
                "MESSAGES_UPDATE",
                "MESSAGES_DELETE",
                "SEND_MESSAGE"
            ]
        }
        
        try:
            response = requests.post(
                f"{config.EVOLUTION_API_BASE_URL}/webhook/set/Luan",
                headers={
                    "apikey": config.EVOLUTION_API_KEY,
                    "Content-Type": "application/json"
                },
                json=webhook_data
            )
            
            if response.status_code in [200, 201]:
                print(f"✅ Webhook configurado: {webhook_url}")
            else:
                print(f"⚠️ Aviso: Erro ao configurar webhook: {response.status_code}")
                print(f"   Resposta: {response.text}")
                
        except Exception as e:
            print(f"⚠️ Aviso: Erro ao configurar webhook: {str(e)}")
        
        # Commit das mudanças
        conn.commit()
        print("\n✅ TODAS AS CORREÇÕES APLICADAS COM SUCESSO!")
        
        # 6. Verificação final
        print("\n6️⃣ VERIFICAÇÃO FINAL")
        cursor.execute("""
            SELECT a.id, a.name, a.whatsapp_config, w.instance_name, w.connection_state, w.connected
            FROM agents a
            LEFT JOIN whatsapp_instances w ON a.id = w.agent_id
            WHERE a.name = 'Luan'
        """)
        
        final_result = cursor.fetchone()
        if final_result:
            agent_id, name, config_str, instance_name, connection_state, connected = final_result
            config_obj = json.loads(config_str) if config_str else {}
            print(f"✅ Agente: {name}")
            print(f"   ID: {agent_id}")
            print(f"   Instância: {instance_name}")
            print(f"   Estado: {connection_state}")
            print(f"   Conectado: {connected}")
            print(f"   Config: {config_obj}")
        
        return True
        
    except Exception as e:
        print(f"❌ Erro durante correção: {str(e)}")
        conn.rollback()
        return False
        
    finally:
        conn.close()

if __name__ == "__main__":
    success = fix_luan_instance()
    if success:
        print("\n🎉 CORREÇÃO CONCLUÍDA! O agente Luan agora está associado à instância 'Luan'.")
        print("\n📋 PRÓXIMOS PASSOS:")
        print("1. Teste o envio de mensagem via WhatsApp")
        print("2. Verifique os logs do backend")
        print("3. Confirme que as respostas estão sendo enviadas")
    else:
        print("\n❌ FALHA NA CORREÇÃO. Verifique os erros acima.")