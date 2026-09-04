const mongoose = require('mongoose');
const Year = require('../models/Year.model');
const TeachingAssignment = require('../models/TeachingAssignment.model');
const SectionAssignment = require('../models/SectionAssignment.model');

/**
 * Resolves the entire department tree (Years -> Semesters -> Sections) in a single aggregation pipeline.
 * 
 * @param {string|mongoose.Types.ObjectId} departmentId 
 * @returns {Promise<Array>} Nested JSON structure of the department tree
 */
const resolveDeptTree = async (departmentId) => {
  const deptId = new mongoose.Types.ObjectId(departmentId);

  return await Year.aggregate([
    // 1. Match Years for the given department
    { $match: { departmentId: deptId } },
    
    // 2. Sort Years
    { $sort: { yearNumber: 1 } },

    // 3. Lookup Semesters for each Year
    {
      $lookup: {
        from: 'semesters', // Mongoose usually lowercases and pluralizes model names
        let: { yearId: '$_id' },
        pipeline: [
          { $match: { $expr: { $eq: ['$yearId', '$$yearId'] } } },
          { $sort: { semesterNumber: 1 } },
          // 4. Lookup Sections for each Semester
          {
            $lookup: {
              from: 'sections',
              let: { semesterId: '$_id' },
              pipeline: [
                { $match: { $expr: { $eq: ['$semesterId', '$$semesterId'] } } },
                { $sort: { name: 1 } }
              ],
              as: 'sections'
            }
          }
        ],
        as: 'semesters'
      }
    }
  ]);
};

const getFacultyLoad = async (facultyId) => {
  const facId = new mongoose.Types.ObjectId(facultyId);
  return await TeachingAssignment.aggregate([
    { $match: { facultyId: facId } },
    {
      $lookup: {
        from: 'subjects',
        localField: 'subjectId',
        foreignField: '_id',
        as: 'subject'
      }
    },
    { $unwind: '$subject' },
    {
      $lookup: {
        from: 'departments',
        localField: 'subject.departmentId',
        foreignField: '_id',
        as: 'department'
      }
    },
    { $unwind: { path: '$department', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'sections',
        localField: 'sectionId',
        foreignField: '_id',
        as: 'section'
      }
    },
    { $unwind: '$section' },
    {
      $project: {
        _id: 1,
        facultyId: 1,
        academicYearLabel: 1,
        subject: {
          _id: 1,
          name: 1,
          code: 1,
          credits: 1
        },
        section: {
          _id: 1,
          name: 1
        },
        department: {
          _id: 1,
          name: 1,
          code: 1
        }
      }
    }
  ]);
};

const getSectionCC = async (sectionId, semesterId) => {
  const secId = new mongoose.Types.ObjectId(sectionId);
  const semId = new mongoose.Types.ObjectId(semesterId);
  const now = new Date();

  return await SectionAssignment.findOne({
    sectionId: secId,
    semesterId: semId,
    validFrom: { $lte: now },
    $or: [
      { validTo: null },
      { validTo: { $gt: now } }
    ]
  });
};

module.exports = {
  resolveDeptTree,
  getFacultyLoad,
  getSectionCC
};
