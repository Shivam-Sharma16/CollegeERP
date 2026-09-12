const mongoose = require('mongoose');

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shivamsharmait27_db_user:v98lK1beZGiJQ0jf@collegeerp.p6ixsac.mongodb.net/user-service';

async function run() {
  console.log('Connecting to MongoDB Atlas to migrate user indexes...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected to MongoDB.');

  const db = mongoose.connection.db;
  const usersCol = db.collection('users');

  const existingIndexes = await usersCol.indexes();
  console.log('Existing indexes on users collection:', existingIndexes.map(i => i.name));

  const hasEmailUnique = existingIndexes.some(i => i.name === 'email_1');
  if (hasEmailUnique) {
    console.log('Dropping legacy global unique index "email_1"...');
    await usersCol.dropIndex('email_1');
    console.log('Successfully dropped "email_1" index.');
  } else {
    console.log('No legacy "email_1" index found to drop.');
  }

  console.log('Ensuring compound unique index { institutionId: 1, email: 1 }...');
  await usersCol.createIndex(
    { institutionId: 1, email: 1 },
    { unique: true, name: 'institutionId_1_email_1' }
  );
  console.log('Successfully created "institutionId_1_email_1" compound unique index.');

  const hasRollNumberIndex = existingIndexes.some(i => i.name === 'rollNumber_1' || i.name === 'institutionId_1_rollNumber_1');
  if (hasRollNumberIndex) {
    try {
      await usersCol.dropIndex('rollNumber_1');
      console.log('Dropped old rollNumber_1 index');
    } catch (e) {}
    try {
      await usersCol.dropIndex('institutionId_1_rollNumber_1');
      console.log('Dropped old institutionId_1_rollNumber_1 index');
    } catch (e) {}
  }

  console.log('Creating partial unique index { institutionId: 1, rollNumber: 1 }...');
  await usersCol.createIndex(
    { institutionId: 1, rollNumber: 1 },
    {
      unique: true,
      name: 'institutionId_1_rollNumber_1',
      partialFilterExpression: { rollNumber: { $type: 'string' } }
    }
  );
  console.log('Successfully created "institutionId_1_rollNumber_1" partial compound unique index.');

  const finalIndexes = await usersCol.indexes();
  console.log('Final indexes on users collection:', finalIndexes.map(i => ({ name: i.name, key: i.key, unique: i.unique })));

  await mongoose.disconnect();
  console.log('Index migration completed successfully!');
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
