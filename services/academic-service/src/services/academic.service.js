const mongoose = require('mongoose');
const Year = require('../models/Year.model');

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

module.exports = {
  resolveDeptTree
};
