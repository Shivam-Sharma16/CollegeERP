const mongoose = require('mongoose');

/**
 * Phase 6 getDefaulters aggregation — extracted from test-fees-aggregation.js.
 * Runs entirely in the DB: $lookup Payment onto FeeStructure installments,
 * $match on dueDate < now AND no paid Payment record for that installment.
 */
const getDefaulters = async (departmentId, year) => {
  const pipeline = [
    // 1. Start from RoleAssignments (STUDENTS)
    { $match: { role: 'STUDENT' } },

    // 2. Map student → section → semester → year
    { $lookup: { from: 'sections',  localField: 'sectionId',         foreignField: '_id', as: 'section'   } },
    { $unwind: '$section' },
    { $lookup: { from: 'semesters', localField: 'section.semesterId', foreignField: '_id', as: 'semester'  } },
    { $unwind: '$semester' },
    { $lookup: { from: 'years',     localField: 'semester.yearId',    foreignField: '_id', as: 'yearDoc'   } },
    { $unwind: '$yearDoc' },

    // 3. Optional dept/year filters
    { $match: {
      ...(departmentId ? { departmentId: new mongoose.Types.ObjectId(departmentId) } : {}),
      ...(year         ? { 'yearDoc.yearNumber': Number(year) }                       : {})
    }},

    // 4. Join FeeStructure for this dept + yearNumber
    { $lookup: {
      from: 'feestructures',
      let: { deptId: '$departmentId', yearNum: '$yearDoc.yearNumber' },
      pipeline: [{ $match: { $expr: { $and: [
        { $eq: ['$departmentId', '$$deptId'] },
        { $eq: ['$year',         '$$yearNum'] }
      ]}}}],
      as: 'feeStructure'
    }},
    { $unwind: '$feeStructure' },

    // 5. Unwind installments to check each one
    { $unwind: { path: '$feeStructure.installments', includeArrayIndex: 'installmentIndex' } },

    // 6. Only overdue installments
    { $match: { 'feeStructure.installments.dueDate': { $lt: new Date() } } },

    // 7. Lookup paid Payments for this student + feeStructure + installment
    { $lookup: {
      from: 'payments',
      let: { sid: '$userId', fsid: '$feeStructure._id', idx: '$installmentIndex' },
      pipeline: [{ $match: { $expr: { $and: [
        { $eq: ['$studentId',        '$$sid']  },
        { $eq: ['$feeStructureId',   '$$fsid'] },
        { $eq: ['$installmentIndex', '$$idx']  },
        { $eq: ['$status',           'paid']   }
      ]}}}],
      as: 'paidPayments'
    }},

    // 8. Defaulter = no paid payment for this overdue installment
    { $match: { paidPayments: { $size: 0 } } },

    // 9. Group to unique students
    { $group: {
      _id: '$userId',
      departmentId: { $first: '$departmentId' },
      yearNumber:   { $first: '$yearDoc.yearNumber' },
      overdueInstallments: { $push: {
        feeStructureId:   '$feeStructure._id',
        installmentIndex: '$installmentIndex',
        amount:           '$feeStructure.installments.amount',
        dueDate:          '$feeStructure.installments.dueDate'
      }}
    }}
  ];

  return mongoose.connection.collection('roleassignments').aggregate(pipeline).toArray();
};

module.exports = { getDefaulters };
