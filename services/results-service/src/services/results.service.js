const mongoose = require('mongoose');
const ExamType = require('../models/ExamType.model');
const MarksRecord = require('../models/MarksRecord.model');

const checkWeightage = async (subjectId, weightageToAdd, excludeExamTypeId = null) => {
  const query = { subjectId };
  if (excludeExamTypeId) {
    query._id = { $ne: excludeExamTypeId };
  }

  const existingExams = await ExamType.find(query);
  const currentSum = existingExams.reduce((sum, exam) => sum + exam.weightage, 0);

  // Use a small epsilon to handle floating point precision issues
  if (currentSum + weightageToAdd > 1.0001) {
    throw new Error(`Cannot add weightage of ${weightageToAdd}. Current sum is ${currentSum.toFixed(2)}, which would exceed 1.0`);
  }
};

const createExamType = async (data) => {
  await checkWeightage(data.subjectId, data.weightage);
  const exam = new ExamType(data);
  return await exam.save();
};

const updateExamType = async (id, data) => {
  if (data.weightage !== undefined) {
    const exam = await ExamType.findById(id);
    if (!exam) throw new Error('ExamType not found');
    const subjectId = data.subjectId || exam.subjectId;
    await checkWeightage(subjectId, data.weightage, id);
  }
  return await ExamType.findByIdAndUpdate(id, data, { new: true });
};

const computeFinalGrade = async (studentId, subjectId) => {
  const result = await MarksRecord.aggregate([
    { $match: { studentId: new mongoose.Types.ObjectId(studentId) } },
    {
      $lookup: {
        from: 'examtypes',
        localField: 'examTypeId',
        foreignField: '_id',
        as: 'examType'
      }
    },
    { $unwind: '$examType' },
    { $match: { 'examType.subjectId': new mongoose.Types.ObjectId(subjectId) } },
    {
      $group: {
        _id: null,
        finalGrade: {
          $sum: {
            $multiply: [
              { $divide: ['$marksObtained', '$examType.maxMarks'] },
              '$examType.weightage'
            ]
          }
        }
      }
    }
  ]);

  if (!result || result.length === 0) return 0;
  
  // Return the percentage (0-100)
  return result[0].finalGrade * 100;
};

module.exports = {
  createExamType,
  updateExamType,
  computeFinalGrade
};
