import psycopg2
conn = psycopg2.connect("postgresql://postgres:13831377@localhost:5432/calliope_ai")
print("Connected!")
conn.close()