require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const Year = require('./models/Year.model');
const Semester = require('./models/Semester.model');
const Section = require('./models/Section.model');
const { resolveDeptTree } = require('./services/academic.service');
const env = require('./config/env');

const runTest = async () => {
  try {
    await mongoose.connect(env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clean up
    await Year.deleteMany({});
    await Semester.deleteMany({});
    await Section.deleteMany({});

    const departmentId = new mongoose.Types.ObjectId();
    
    // Seed 4 years
    for (let y = 1; y <= 4; y++) {
      const year = await Year.create({ departmentId, yearNumber: y });
      
      // Seed 2 semesters per year (e.g. Year 1 -> Sem 1, 2)
      for (let s = 1; s <= 2; s++) {
        const semesterNumber = (y - 1) * 2 + s;
        const semester = await Semester.create({
          departmentId,
          yearId: year._id,
          semesterNumber
        });

        // Seed 3 sections per semester
        const sections = ['A', 'B', 'C'];
        for (const sec of sections) {
          await Section.create({
            semesterId: semester._id,
            name: sec
          });
        }
      }
    }

    console.log('Seed completed. Running resolveDeptTree...');

    const tree = await resolveDeptTree(departmentId);
    
    console.dir(tree, { depth: null });

    // Verifications
    const is4Years = tree.length === 4;
    const is2SemestersPerYear = tree.every(y => y.semesters && y.semesters.length === 2);
    const is3SectionsPerSemester = tree.every(y => 
      y.semesters.every(s => s.sections && s.sections.length === 3)
    );

    if (is4Years && is2SemestersPerYear && is3SectionsPerSemester) {
      console.log('\\n✅ TEST PASSED: resolveDeptTree correctly aggregates 4 Years x 2 Semesters x 3 Sections.');
    } else {
      console.error('\\n❌ TEST FAILED: The tree structure does not match expectations.');
    }

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
};

runTest();
