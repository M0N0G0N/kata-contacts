const sqlite3 = require('sqlite3')
const open = require('sqlite').open
const fs = require('fs')
const process = require('process')

const filename = 'contacts.sqlite3'
const numContacts = parseInt(process.argv[2], 10);

const shouldMigrate = !fs.existsSync(filename)

/**
 * Generate `numContacts` contacts,
 * one at a time
 *
 */
function* generateContacts() {
  for (let index = 1; index <= numContacts; index++) {
    yield [`name-${index}`, `email-${index}@domain.tld`]
  }
}

const migrate = async (db) => {
  console.log('Migrating db ...')
  await db.run(`DROP TABLE IF EXISTS contacts`)
  await db.exec(`
        CREATE TABLE contacts(
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT NOT NULL
        )
    `)
  await db.run(`CREATE UNIQUE INDEX index_contacts_email ON contacts(email)`)
  console.log('Done migrating db')
}

const insertContacts = async (db) => {
  console.log('Inserting contacts ...')
  // TODO
  const contactsGenerator = generateContacts(numContacts);
  let contactsBatch = [];

  const insertBatch = async (db, contacts) => {
    const placeholder = contacts.map(() => '(?, ?)').join(', ');
    const values = contacts.flatMap(contact => [contact[0], contact[1]]);

    await db.run(`INSERT INTO contacts(name, email) VALUES ${placeholder}`, values);
  }

  for (const contact of contactsGenerator) {
    contactsBatch.push(contact);
    if (contactsBatch.length >= 1000) {
      await insertBatch(db, contactsBatch);
      contactsBatch = [];
    }
  }
  if (contactsBatch.length > 0) {
    await insertBatch(db, contactsBatch);
  }
}


const queryContact = async (db) => {
  const start = Date.now()
  const res = await db.get('SELECT name FROM contacts WHERE email = ?', [`email-${numContacts}@domain.tld`])
  console.log(res)
  if (!res || !res.name) {
    console.error('Contact not found')
    process.exit(1)
  }
  const end = Date.now()
  const elapsed = (end - start) / 1000
  console.log(`Query took ${elapsed} seconds`)
}

(async () => {
  const db = await open({
    filename,
    driver: sqlite3.Database
  })
  await migrate(db)
  await insertContacts(db)
  await queryContact(db)
  await db.close()
})()
