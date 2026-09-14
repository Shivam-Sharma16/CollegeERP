const mongoose = require('mongoose');

/**
 * Phase 6 & Phase 78 getDefaulters aggregation.
 * Supports optional departmentId, year, feeGroup, and institutionId filters.
 * Resolves each student's fee structure via { departmentId, year, studentGroup }.
 */
const getDefaulters = async (departmentId, year, feeGroup, institutionId) => {
  const matchConditions = { role: 'STUDENT' };
  if (institutionId && mongoose.Types.ObjectId.isValid(institutionId)) {
    matchConditions.institutionId = new mongoose.Types.ObjectId(institutionId);
  }

  const pipeline = [
    // 1. Start from RoleAssignments (STUDENTS)
    { $match: matchConditions },

    // 2. Lookup User to resolve student feeGroup
    { $lookup: {
        from: 'users',
        localField: 'userId',
        foreignField: '_id',
        as: 'userDoc'
    }},
    { $unwind: { path: '$userDoc', preserveNullAndEmptyArrays: true } },
    { $addFields: {
        studentFeeGroup: {
          $toLower: { $ifNull: ['$userDoc.feeGroup', 'general'] }
        }
    }},

    // 3. Map student → section → semester → year
    { $lookup: { from: 'sections',  localField: 'sectionId',         foreignField: '_id', as: 'section'   } },
    { $unwind: '$section' },
    { $lookup: { from: 'semesters', localField: 'section.semesterId', foreignField: '_id', as: 'semester'  } },
    { $unwind: '$semester' },
    { $lookup: { from: 'years',     localField: 'semester.yearId',    foreignField: '_id', as: 'yearDoc'   } },
    { $unwind: '$yearDoc' },

    // 4. Optional dept/year/feeGroup filters
    { $match: {
      ...(departmentId ? { departmentId: new mongoose.Types.ObjectId(departmentId) } : {}),
      ...(year         ? { 'yearDoc.yearNumber': Number(year) }                       : {}),
      ...(feeGroup     ? { studentFeeGroup: feeGroup.toString().trim().toLowerCase() } : {})
    }},

    // 5. Join FeeStructure for this dept + yearNumber + studentGroup
    { $lookup: {
      from: 'feestructures',
      let: {
        deptId: '$departmentId',
        yearNum: '$yearDoc.yearNumber',
        sGroup: '$studentFeeGroup'
      },
      pipeline: [{
        $match: {
          $expr: {
            $and: [
              { $eq: ['$departmentId', '$$deptId'] },
              { $eq: ['$year', '$$yearNum'] },
              { $eq: ['$studentGroup', '$$sGroup'] },
              ...(institutionId && mongoose.Types.ObjectId.isValid(institutionId)
                ? [{ $eq: ['$institutionId', new mongoose.Types.ObjectId(institutionId)] }]
                : [])
            ]
          }
        }
      }],
      as: 'feeStructure'
    }},
    { $unwind: '$feeStructure' },

    // 6. Unwind installments to check each one
    { $unwind: { path: '$feeStructure.installments', includeArrayIndex: 'installmentIndex' } },

    // 7. Only overdue installments
    { $match: { 'feeStructure.installments.dueDate': { $lt: new Date() } } },

    // 8. Lookup paid Payments for this student + feeStructure + installment
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

    // 9. Defaulter = no paid payment for this overdue installment
    { $match: { paidPayments: { $size: 0 } } },

    // 10. Group to unique students
    { $group: {
      _id: '$userId',
      name: { $first: '$userDoc.name' },
      email: { $first: '$userDoc.email' },
      feeGroup: { $first: '$studentFeeGroup' },
      departmentId: { $first: '$departmentId' },
      yearNumber:   { $first: '$yearDoc.yearNumber' },
      overdueInstallments: { $push: {
        feeStructureId:   '$feeStructure._id',
        studentGroup:     '$feeStructure.studentGroup',
        installmentIndex: '$installmentIndex',
        amount:           '$feeStructure.installments.amount',
        dueDate:          '$feeStructure.installments.dueDate'
      }}
    }}
  ];

  return mongoose.connection.collection('roleassignments').aggregate(pipeline).toArray();
};

module.exports = { getDefaulters };
