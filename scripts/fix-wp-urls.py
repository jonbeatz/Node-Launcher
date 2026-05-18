import sqlite3

db = sqlite3.connect('data/vader.sqlite')
db.execute("UPDATE projects SET project_url='http://talkshowlandv1.local/', slug='talkshowlandv1' WHERE id='2e71107e-377f-416d-b9c1-35f087b50f65'")
db.execute("UPDATE projects SET project_url='http://iwwiv2.local/', slug='iwwiv2' WHERE id='f18fd4f2-90f5-47fa-bd0e-af3f662bd027'")
db.commit()
rows = db.execute("SELECT id, name, project_url, slug FROM projects WHERE project_type='wordpress-local'").fetchall()
for row in rows:
    print(row)
db.close()
print("Done.")
