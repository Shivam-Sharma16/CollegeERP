const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const LectureSession = require('../models/LectureSession.model');
const AttendanceRecord = require('../models/AttendanceRecord.model');
const { verifyCheckIn, getStudentAttendancePercent } = require('./attendance.service');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await LectureSession.deleteMany({});
  await AttendanceRecord.deleteMany({});
});

describe('Attendance Verification Pipeline', () => {
  let session;
  const facultyId = new mongoose.Types.ObjectId();
  const student1 = new mongoose.Types.ObjectId();
  const student2 = new mongoose.Types.ObjectId();
  
  beforeEach(async () => {
    // Create a default valid session
    session = new LectureSession({
      teachingAssignmentId: new mongoose.Types.ObjectId(),
      date: new Date(),
      timeSlot: '10:00-11:00',
      qrTokenSecret: 'secret123',
      qrTokenExpiresAt: new Date(Date.now() + 1000 * 60), // Valid for 1 minute
      geofence: {
        lat: 40.7128,
        lng: -74.0060,
        radiusMeters: 50
      },
      status: 'active'
    });
    await session.save();
  });

  it('1. Rejects expired or mismatched QR token (fails fast)', async () => {
    const expiredSession = new LectureSession({
      teachingAssignmentId: new mongoose.Types.ObjectId(),
      date: new Date(),
      timeSlot: '11:00-12:00',
      qrTokenSecret: 'secret456',
      qrTokenExpiresAt: new Date(Date.now() - 1000), // Expired 1 sec ago
      geofence: { lat: 0, lng: 0, radiusMeters: 50 }
    });
    await expiredSession.save();

    await expect(verifyCheckIn({
      lectureSessionId: expiredSession._id,
      studentId: student1,
      qrToken: 'secret456',
      deviceFingerprint: 'dev1',
      gpsCoords: { lat: 0, lng: 0 }
    })).rejects.toThrow('Invalid or expired QR token');

    await expect(verifyCheckIn({
      lectureSessionId: session._id,
      studentId: student1,
      qrToken: 'wrong_secret',
      deviceFingerprint: 'dev1',
      gpsCoords: { lat: 40.7128, lng: -74.0060 }
    })).rejects.toThrow('Invalid or expired QR token');

    // Ensure no record was created silently
    const count = await AttendanceRecord.countDocuments({});
    expect(count).toBe(0);
  });

  it('2. Flags check-in if geofence fails (does not drop)', async () => {
    // Coords far away from 40.7128, -74.0060
    const record = await verifyCheckIn({
      lectureSessionId: session._id,
      studentId: student1,
      qrToken: 'secret123',
      deviceFingerprint: 'dev1',
      gpsCoords: { lat: 40.7200, lng: -74.0100 } // definitely > 50m
    });

    expect(record.status).toBe('flagged');
    expect(record.verificationMethod).toBe('geofence_fail');
  });

  it('3. Flags both records if same device checks in different students', async () => {
    // Student 1 checks in successfully
    const record1 = await verifyCheckIn({
      lectureSessionId: session._id,
      studentId: student1,
      qrToken: 'secret123',
      deviceFingerprint: 'shared_device',
      gpsCoords: { lat: 40.7128, lng: -74.0060 } // Exact match
    });

    expect(record1.status).toBe('present');
    expect(record1.verificationMethod).toBe('qr+geofence');

    // Student 2 checks in with the same device
    const record2 = await verifyCheckIn({
      lectureSessionId: session._id,
      studentId: student2,
      qrToken: 'secret123',
      deviceFingerprint: 'shared_device',
      gpsCoords: { lat: 40.7128, lng: -74.0060 }
    });

    expect(record2.status).toBe('flagged');
    expect(record2.verificationMethod).toBe('duplicate_device');

    // Re-fetch record 1 to ensure it was also flagged
    const updatedRecord1 = await AttendanceRecord.findById(record1._id);
    expect(updatedRecord1.status).toBe('flagged');
    expect(updatedRecord1.verificationMethod).toBe('duplicate_device');
  });

  it('4. Computes attendance % correctly via aggregation', async () => {
    const s1 = new mongoose.Types.ObjectId();
    
    // Create 4 sessions
    const sessions = [];
    for (let i = 0; i < 4; i++) {
      const sess = new LectureSession({
        teachingAssignmentId: new mongoose.Types.ObjectId(),
        date: new Date(),
        timeSlot: '10:00-11:00',
        qrTokenSecret: 'sec',
        qrTokenExpiresAt: new Date(Date.now() + 100000),
        geofence: { lat: 0, lng: 0, radiusMeters: 50 }
      });
      await sess.save();
      sessions.push(sess);
    }

    // Insert records manually for fixture
    // session 0: present
    // session 1: present
    // session 2: flagged
    // session 3: absent
    await AttendanceRecord.create([
      { lectureSessionId: sessions[0]._id, studentId: s1, status: 'present', deviceFingerprint: '1' },
      { lectureSessionId: sessions[1]._id, studentId: s1, status: 'present', deviceFingerprint: '2' },
      { lectureSessionId: sessions[2]._id, studentId: s1, status: 'flagged', deviceFingerprint: '3' },
      { lectureSessionId: sessions[3]._id, studentId: s1, status: 'absent', deviceFingerprint: '4' }
    ]);

    const percentage = await getStudentAttendancePercent(s1);
    // 2 present out of 4 total records = 50%
    expect(percentage).toBe(50);
  });
});
