import sqlite3

conn = sqlite3.connect('agents.db')
cursor = conn.cursor()

# Verificar instâncias WhatsApp
cursor.execute("SELECT * FROM whatsapp_instances")
instances = cursor.fetchall()

# Obter nomes das colunas
cursor.execute("PRAGMA table_info(whatsapp_instances)")
columns = [col[1] for col in cursor.fetchall()]

print("=== INSTÂNCIAS WHATSAPP ===")
print(f"Colunas: {columns}")
print()

for i, instance in enumerate(instances, 1):
    print(f"Instância {i}:")
    for j, col_name in enumerate(columns):
        value = instance[j] if j < len(instance) else 'N/A'
        print(f"  {col_name}: {value}")
    print("-" * 40)

print(f"\nTotal: {len(instances)} instâncias")

conn.close()