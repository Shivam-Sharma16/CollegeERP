const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Institution = require('../models/Institution.model');
const Department = require('../../../user-service/src/models/Department.model');
const User = require('../../../user-service/src/models/User.model');
const Subject = require('../../../academic-service/src/models/Subject.model');
const Year = require('../../../academic-service/src/models/Year.model');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('Phase 64: Multi-Tenant Schema Validation & Isolation', () => {
  describe('Institution Schema', () => {
    it('successfully creates an institution with valid subdomain and themeConfig', async () => {
      const inst = await Institution.create({
        name: 'Tech Institute of Science',
        subdomain: 'tech-inst',
        customDomain: 'techinst.edu',
        logoUrl: 'https://cdn.example.com/logo.png',
        themeConfig: {
          primaryColor: '#6366f1',
          secondaryColor: '#14b8a6',
          faviconUrl: 'https://cdn.example.com/favicon.ico'
        },
        isActive: true,
        createdBy: new mongoose.Types.ObjectId()
      });

      expect(inst._id).toBeDefined();
      expect(inst.subdomain).toBe('tech-inst');
      expect(inst.slug).toBe('tech-inst'); // synced
      expect(inst.status).toBe('ACTIVE'); // synced
      expect(inst.branding.primaryColor).toBe('#6366f1'); // synced
    });

    it('rejects an invalid subdomain containing uppercase or illegal characters', async () => {
      let err;
      try {
        await Institution.create({
          name: 'Invalid Subdomain Inst',
          subdomain: 'Invalid_Subdomain!',
          createdBy: new mongoose.Types.ObjectId()
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.errors['subdomain']).toBeDefined();
    });

    it('enforces unique subdomain constraint', async () => {
      await Institution.create({
        name: 'Institute A',
        subdomain: 'alpha-tech',
        createdBy: new mongoose.Types.ObjectId()
      });

      await Institution.init(); // ensure indexes built

      let err;
      try {
        await Institution.create({
          name: 'Institute B',
          subdomain: 'alpha-tech',
          createdBy: new mongoose.Types.ObjectId()
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe(11000);
    });
  });

  describe('User Schema (SuperAdmin vs Tenant Users)', () => {
    it('allows SUPERADMIN user with institutionId: null', async () => {
      const superAdmin = await User.create({
        name: 'Super Admin',
        email: 'superadmin@global.test',
        passwordHash: 'hash',
        roles: ['SUPERADMIN'],
        institutionId: null
      });

      expect(superAdmin._id).toBeDefined();
      expect(superAdmin.institutionId).toBeNull();
    });

    it('requires institutionId for non-SUPERADMIN users', async () => {
      let err;
      try {
        await User.create({
          name: 'Faculty Member',
          email: 'faculty@inst.test',
          passwordHash: 'hash',
          roles: ['FACULTY'],
          institutionId: null
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.errors['institutionId']).toBeDefined();
    });
  });

  describe('Tenant-Scoped Per-Institution Uniqueness', () => {
    it('allows two different institutions to have the same department code', async () => {
      await Department.init();

      const instA = new mongoose.Types.ObjectId();
      const instB = new mongoose.Types.ObjectId();

      const deptA = await Department.create({
        name: 'Computer Science',
        code: 'CS',
        institutionId: instA
      });

      const deptB = await Department.create({
        name: 'Computer Science',
        code: 'CS',
        institutionId: instB
      });

      expect(deptA._id).toBeDefined();
      expect(deptB._id).toBeDefined();
      expect(deptA.code).toBe('CS');
      expect(deptB.code).toBe('CS');
    });

    it('rejects duplicate department code within the same institution', async () => {
      await Department.init();

      const instA = new mongoose.Types.ObjectId();

      await Department.create({
        name: 'Computer Science 1',
        code: 'CS',
        institutionId: instA
      });

      let err;
      try {
        await Department.create({
          name: 'Computer Science 2',
          code: 'CS',
          institutionId: instA
        });
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe(11000);
    });

    it('allows two different institutions to have the same subject code', async () => {
      await Subject.init();

      const instA = new mongoose.Types.ObjectId();
      const instB = new mongoose.Types.ObjectId();
      const deptId = new mongoose.Types.ObjectId();

      const subA = await Subject.create({
        name: 'Data Structures',
        code: 'CS101',
        credits: 4,
        departmentId: deptId,
        institutionId: instA
      });

      const subB = await Subject.create({
        name: 'Data Structures',
        code: 'CS101',
        credits: 4,
        departmentId: deptId,
        institutionId: instB
      });

      expect(subA.code).toBe('CS101');
      expect(subB.code).toBe('CS101');
    });

    it('requires institutionId on Subject and Year models', async () => {
      let subErr;
      try {
        await Subject.create({
          name: 'Algorithms',
          code: 'CS201',
          credits: 4,
          departmentId: new mongoose.Types.ObjectId()
        });
      } catch (e) {
        subErr = e;
      }
      expect(subErr).toBeDefined();
      expect(subErr.errors['institutionId']).toBeDefined();

      let yearErr;
      try {
        await Year.create({
          departmentId: new mongoose.Types.ObjectId(),
          yearNumber: 1
        });
      } catch (e) {
        yearErr = e;
      }
      expect(yearErr).toBeDefined();
      expect(yearErr.errors['institutionId']).toBeDefined();
    });
  });
});
