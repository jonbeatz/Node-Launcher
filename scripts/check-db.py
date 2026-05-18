import sqlite3, sys

db_path = sys.argv[1] if len(sys.argv) > 1 else 'data/vader.sqlite'
db = sqlite3.connect(db_path)
rows = db.execute("SELECT id, name, project_type, project_url FROM projects ORDER BY name").fetchall()
print(f"Total projects in {db_path}: {len(rows)}")
for r in rows:
    ptype = r[2] or 'None'
    purl = r[3] or ''
    print(f"  {r[0][:8]}... | {r[1]:<30} | type={ptype:<20} | url={purl}")
db.close()
