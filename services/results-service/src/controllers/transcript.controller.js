const mongoose = require('mongoose');
const { computeFinalGrade } = require('../services/results.service');
const { success, fail } = require('@college-erp/shared-utils');

/**
 * GET /students/:id/transcript
 * Runs computeFinalGrade across every subject the student has marks for in their
 * current semester. Returns per-subject breakdown + weighted GPA.
 *
 * Subject discovery: finds all distinct subjectIds from the student's MarksRecords
 * (via examtype lookup), then calls computeFinalGrade per subject.
 */
const getTranscript = async (req, res) => {
  try {
    let { id: studentId } = req.params;
    if (studentId === 'me') studentId = req.user.id;

    // Step 1: Find all distinct subjects the student has been assessed on
    const subjectGroups = await mongoose.connection.db
      .collection('marksrecords')
      .aggregate([
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
        {
          $group: {
            _id: '$examType.subjectId'
          }
        }
      ])
      .toArray();

    if (subjectGroups.length === 0) {
      return res.json(success({ studentId, subjects: [], gpa: 0 }));
    }

    // Step 2: Fetch subject metadata (name, code, credits) from subjects collection
    const subjectIds = subjectGroups.map(g => g._id);
    const subjectDocs = await mongoose.connection.db
      .collection('subjects')
      .find({ _id: { $in: subjectIds } })
      .toArray();

    const subjectMap = Object.fromEntries(subjectDocs.map(s => [s._id.toString(), s]));

    // Step 3: Compute grade per subject using the existing aggregation pipeline
    const subjectBreakdown = await Promise.all(
      subjectIds.map(async (subjectId) => {
        const gradeData = await computeFinalGrade(studentId, subjectId.toString());
        const grade = typeof gradeData === 'number' ? gradeData : gradeData.finalGrade;
        const breakdown = typeof gradeData === 'number' ? [] : gradeData.breakdown;
        
        const meta = subjectMap[subjectId.toString()] || {};
        return {
          subjectId: subjectId.toString(),
          subjectName: meta.name || 'Unknown',
          subjectCode: meta.code || 'N/A',
          credits: meta.credits || 0,
          gradePercent: parseFloat(grade.toFixed(2)),
          letterGrade: toLetter(grade),
          breakdown
        };
      })
    );

    // Step 4: Compute credit-weighted GPA across all subjects
    const totalCredits = subjectBreakdown.reduce((s, sub) => s + sub.credits, 0);
    const weightedSum  = subjectBreakdown.reduce((s, sub) => s + sub.gradePercent * sub.credits, 0);
    const gpa = totalCredits > 0 ? parseFloat((weightedSum / totalCredits).toFixed(2)) : 0;

    res.json(success({
      studentId,
      subjects: subjectBreakdown,
      totalCredits,
      gpa
    }));
  } catch (err) {
    console.error(err);
    res.status(500).json(fail('Internal server error'));
  }
};

/**
 * Convert a 0-100 percentage to a letter grade.
 */
const toLetter = (pct) => {
  if (pct >= 90) return 'O';   // Outstanding
  if (pct >= 80) return 'A+';
  if (pct >= 70) return 'A';
  if (pct >= 60) return 'B+';
  if (pct >= 50) return 'B';
  if (pct >= 40) return 'C';
  return 'F';
};

module.exports = { getTranscript };
