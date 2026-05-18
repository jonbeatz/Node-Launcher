'use strict';
const Database = require('better-sqlite3');
const db = new Database('data/vader.sqlite');

const updates = [
  { id: '2e71107e-377f-416d-b9c1-35f087b50f65', url: 'http://talkshowlandv1.local/', slug: 'talkshowlandv1' },
  { id: 'f18fd4f2-90f5-47fa-bd0e-af3f662bd027', url: 'http://iwwiv2.local/', slug: 'iwwiv2' },
];

const stmt = db.prepare('UPDATE projects SET project_url=?, slug=? WHERE id=?');
for (const u of updates) {
  const changes = stmt.run(u.url, u.slug, u.id).changes;
  console.log(`Updated ${u.id}: ${changes} row(s)`);
}

const rows = db.prepare("SELECT id, name, project_url, slug FROM projects WHERE project_type='wordpress-local'").all();
console.log('\nAll WP-local projects:');
console.log(JSON.stringify(rows, null, 2));
db.close();
