/**
 * Migration Script: Phase 64 — Institution (Tenant) Schema & Data Migration
 * 
 * Backfills institutionId onto all tenant-scoped documents across all microservices
 * and prepares existing institutions for the new multi-tenant Institution schema.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../services/user-service/.env') });

const BASE_MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://shivamsharmait27_db_user:v98lK1beZGiJQ0jf@collegeerp.p6ixsac.mongodb.net/user-service';

// Service databases to migrate
const SERVICE_DBS = [
  'user-service',
  'academic-service',
  'attendance-service',
  'results-service',
  'fees-service',
  'notice-service',
  'notification-service',
  'auth-service'
];

async function migrate() {
  console.log('====================================================');
  console.log('Starting Phase 64: Multi-Tenant Data Migration');
  console.log('====================================================');

  console.log(`Connecting to MongoDB cluster...`);
  await mongoose.connect(BASE_MONGO_URI);
  console.log('Connected to MongoDB successfully.\n');

  const client = mongoose.connection.client;
  const userDb = client.db('user-service');

  // 1. Locate SuperAdmin User if exists
  const superAdminUser = await userDb.collection('users').findOne({ roles: 'SUPERADMIN' });
  const superAdminId = superAdminUser ? superAdminUser._id : new mongoose.Types.ObjectId();
  console.log(`Identified SuperAdmin: ${superAdminUser ? superAdminUser.email : 'Generated fallback ID'} (${superAdminId})`);

  // 2. Ensure or Upgrade Institutions in user-service
  const institutionsCol = userDb.collection('institutions');
  let institutions = await institutionsCol.find({}).toArray();

  if (institutions.length === 0) {
    console.log('No existing institution found. Creating default institution (Apex Institute of Technology)...');
    const defaultInst = {
      _id: new mongoose.Types.ObjectId(),
      name: 'Apex Institute of Technology',
      code: 'AIT',
      slug: 'apex-tech',
      subdomain: 'apex-tech',
      customDomain: 'apex.edu',
      domain: 'apex.edu',
      logoUrl: '',
      themeConfig: {
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4',
        faviconUrl: ''
      },
      branding: {
        logoUrl: '',
        faviconUrl: '',
        primaryColor: '#4f46e5',
        secondaryColor: '#06b6d4'
      },
      isActive: true,
      status: 'ACTIVE',
      createdBy: superAdminId,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    await institutionsCol.insertOne(defaultInst);
    institutions = [defaultInst];
    console.log(`Created default institution with ID: ${defaultInst._id}`);
  } else {
    console.log(`Found ${institutions.length} existing institution(s). Upgrading schema fields...`);
    for (const inst of institutions) {
      const subdomain = (inst.subdomain || inst.slug || inst.code?.toLowerCase() || 'inst')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/^-+|-+$/g, '');

      const logoUrl = inst.logoUrl || inst.branding?.logoUrl || '';
      const themeConfig = {
        primaryColor: inst.themeConfig?.primaryColor || inst.branding?.primaryColor || '#4f46e5',
        secondaryColor: inst.themeConfig?.secondaryColor || inst.branding?.secondaryColor || '#06b6d4',
        faviconUrl: inst.themeConfig?.faviconUrl || inst.branding?.faviconUrl || ''
      };
      const customDomain = inst.customDomain || inst.domain || null;
      const isActive = inst.isActive !== undefined ? inst.isActive : (inst.status === 'ACTIVE');
      const createdBy = inst.createdBy || superAdminId;

      await institutionsCol.updateOne(
        { _id: inst._id },
        {
          $set: {
            subdomain,
            slug: subdomain, // backward compatibility
            customDomain,
            domain: customDomain, // backward compatibility
            logoUrl,
            themeConfig,
            branding: {
              logoUrl,
              faviconUrl: themeConfig.faviconUrl,
              primaryColor: themeConfig.primaryColor,
              secondaryColor: themeConfig.secondaryColor
            }, // backward compatibility
            isActive,
            status: isActive ? 'ACTIVE' : 'SUSPENDED',
            createdBy
          }
        }
      );
      console.log(`  Updated institution: "${inst.name}" -> subdomain: "${subdomain}"`);
    }
  }

  // 3. Select Primary Default Institution (prefer 'apex-tech', fallback to first)
  const defaultInstitution = institutions.find(i => (i.subdomain === 'apex-tech' || i.slug === 'apex-tech')) || institutions[0];
  const defaultInstitutionId = defaultInstitution._id;
  console.log(`\nPrimary default institution for backfills: "${defaultInstitution.name}" (${defaultInstitutionId})\n`);

  // Build a map of User ID -> institutionId for audit log attribution
  const allUsers = await userDb.collection('users').find({}).toArray();
  const userTenantMap = new Map();
  for (const u of allUsers) {
    if (u.institutionId) {
      userTenantMap.set(u._id.toString(), u.institutionId);
    }
  }

  let totalBackfilled = 0;

  // 4. Backfill specific collections in user-service
  console.log('--- Processing user-service ---');

  // 4a. Users (nullable ONLY for SUPERADMIN)
  const nonAdminUsersWithoutInst = await userDb.collection('users').find({
    roles: { $ne: 'SUPERADMIN' },
    $or: [{ institutionId: null }, { institutionId: { $exists: false } }]
  }).toArray();

  if (nonAdminUsersWithoutInst.length > 0) {
    const res = await userDb.collection('users').updateMany(
      {
        roles: { $ne: 'SUPERADMIN' },
        $or: [{ institutionId: null }, { institutionId: { $exists: false } }]
      },
      { $set: { institutionId: defaultInstitutionId } }
    );
    console.log(`  users: backfilled ${res.modifiedCount} documents`);
    totalBackfilled += res.modifiedCount;
  } else {
    console.log(`  users: all non-superadmin documents already have institutionId`);
  }

  // 4b. RoleAssignments
  const roleRes = await userDb.collection('roleassignments').updateMany(
    { $or: [{ institutionId: null }, { institutionId: { $exists: false } }] },
    { $set: { institutionId: defaultInstitutionId } }
  );
  if (roleRes.modifiedCount > 0) {
    console.log(`  roleassignments: backfilled ${roleRes.modifiedCount} documents`);
    totalBackfilled += roleRes.modifiedCount;
  }

  // 4c. Departments
  const deptRes = await userDb.collection('departments').updateMany(
    { $or: [{ institutionId: null }, { institutionId: { $exists: false } }] },
    { $set: { institutionId: defaultInstitutionId } }
  );
  if (deptRes.modifiedCount > 0) {
    console.log(`  departments: backfilled ${deptRes.modifiedCount} documents`);
    totalBackfilled += deptRes.modifiedCount;
  }

  // 4d. AuditLogs
  const auditLogs = await userDb.collection('auditlogs').find({
    $or: [{ institutionId: null }, { institutionId: { $exists: false } }]
  }).toArray();

  if (auditLogs.length > 0) {
    let auditUpdated = 0;
    for (const log of auditLogs) {
      let assignedInstId = defaultInstitutionId;

      if (log.targetType === 'Institution' && log.targetId) {
        assignedInstId = log.targetId;
      } else if (log.actorId && userTenantMap.has(log.actorId.toString())) {
        assignedInstId = userTenantMap.get(log.actorId.toString());
      } else if (log.details?.institutionId) {
        assignedInstId = new mongoose.Types.ObjectId(log.details.institutionId);
      }

      await userDb.collection('auditlogs').updateOne(
        { _id: log._id },
        { $set: { institutionId: assignedInstId } }
      );
      auditUpdated++;
    }
    console.log(`  auditlogs: backfilled ${auditUpdated} documents`);
    totalBackfilled += auditUpdated;
  } else {
    console.log(`  auditlogs: all documents already have institutionId`);
  }

  // 5. Backfill across all other service databases
  for (const dbName of SERVICE_DBS) {
    if (dbName === 'user-service') continue;

    const db = client.db(dbName);
    const collections = await db.listCollections().toArray();
    console.log(`\n--- Processing ${dbName} ---`);

    for (const colMeta of collections) {
      const colName = colMeta.name;
      if (colName.startsWith('system.')) continue;

      const col = db.collection(colName);
      let filter = { $or: [{ institutionId: null }, { institutionId: { $exists: false } }] };

      // In auth-service, users with SUPERADMIN can have null institutionId
      if (dbName === 'auth-service' && colName === 'users') {
        filter = {
          roles: { $ne: 'SUPERADMIN' },
          $or: [{ institutionId: null }, { institutionId: { $exists: false } }]
        };
      }

      const countMissing = await col.countDocuments(filter);
      if (countMissing > 0) {
        const result = await col.updateMany(filter, { $set: { institutionId: defaultInstitutionId } });
        console.log(`  ${colName}: backfilled ${result.modifiedCount} documents`);
        totalBackfilled += result.modifiedCount;
      } else {
        const totalDocs = await col.countDocuments();
        console.log(`  ${colName}: ${totalDocs} documents (all up to date)`);
      }
    }
  }

  // 6. Clean up obsolete globally-unique indexes that prevent multi-tenancy
  console.log('\n--- Checking and cleaning obsolete global unique indexes ---');
  try {
    // Subject code global index in academic-service
    const academicDb = client.db('academic-service');
    const subjectIndexes = await academicDb.collection('subjects').indexes();
    const codeIndex = subjectIndexes.find(i => i.name === 'code_1');
    if (codeIndex) {
      console.log('  academic-service: dropping global unique index "code_1" on subjects...');
      await academicDb.collection('subjects').dropIndex('code_1');
      console.log('  academic-service: dropped "code_1" index successfully.');
    }
  } catch (err) {
    console.warn('  Notice during subject index check:', err.message);
  }

  try {
    // Department code global index in user-service
    const deptIndexes = await userDb.collection('departments').indexes();
    const deptCodeIndex = deptIndexes.find(i => i.name === 'code_1');
    if (deptCodeIndex) {
      console.log('  user-service: dropping global unique index "code_1" on departments...');
      await userDb.collection('departments').dropIndex('code_1');
      console.log('  user-service: dropped "code_1" index successfully.');
    }
  } catch (err) {
    console.warn('  Notice during department index check:', err.message);
  }

  // 7. Strict Orphan Check Across ALL Services
  console.log('\n====================================================');
  console.log('Running Zero-Orphan Verification Check');
  console.log('====================================================');

  const TENANT_COLLECTIONS_MAP = {
    'user-service': ['users', 'departments', 'roleassignments', 'auditlogs'],
    'academic-service': ['years', 'semesters', 'sections', 'subjects', 'teachingassignments', 'sectionassignments'],
    'attendance-service': ['lecturesessions', 'attendancerecords'],
    'results-service': ['examtypes', 'marksrecords'],
    'fees-service': ['feestructures', 'payments'],
    'notice-service': ['notices', 'notes'],
    'notification-service': ['notifications'],
    'auth-service': ['users']
  };

  let orphanCount = 0;

  for (const [dbName, collections] of Object.entries(TENANT_COLLECTIONS_MAP)) {
    const db = client.db(dbName);
    for (const colName of collections) {
      let orphanFilter = {
        $or: [
          { institutionId: null },
          { institutionId: { $exists: false } }
        ]
      };

      // Users with SUPERADMIN role are intentionally allowed to have null institutionId
      if (colName === 'users') {
        orphanFilter = {
          roles: { $ne: 'SUPERADMIN' },
          $or: [
            { institutionId: null },
            { institutionId: { $exists: false } }
          ]
        };
      }

      const col = db.collection(colName);
      const orphans = await col.countDocuments(orphanFilter);
      const total = await col.countDocuments();

      if (orphans > 0) {
        console.error(`  ❌ [FAIL] ${dbName}.${colName} has ${orphans} orphaned document(s) out of ${total}!`);
        orphanCount += orphans;
      } else {
        console.log(`  ✅ [PASS] ${dbName}.${colName}: 0 orphans (${total} total docs verified)`);
      }
    }
  }

  console.log('\n====================================================');
  if (orphanCount === 0) {
    console.log(`MIGRATION COMPLETED SUCCESSFULLY: 0 orphaned documents!`);
    console.log(`Total documents updated: ${totalBackfilled}`);
    console.log('====================================================\n');
  } else {
    throw new Error(`Migration failed: Found ${orphanCount} orphaned documents across services!`);
  }

  await mongoose.disconnect();
}

migrate().catch(err => {
  console.error('Migration error:', err);
  process.exit(1);
});
