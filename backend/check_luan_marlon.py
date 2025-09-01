import sqlite3

conn = sqlite3.connect('agents.db')
cursor = conn.cursor()

# Verificar agentes Luan e Marlon
cursor.execute("SELECT name, id, whatsapp_config FROM agents WHERE name IN ('Luan', 'Marlon')")
agents = cursor.fetchall()

print("=== AGENTES LUAN/MARLON NO BACKEND ===")
for agent in agents:
    name, agent_id, whatsapp_config = agent
    print(f"Nome: {name}")
    print(f"ID: {agent_id}")
    print(f"WhatsApp Config: {whatsapp_config}")
    print("-" * 40)

print(f"\nTotal encontrados: {len(agents)}")

conn.close()