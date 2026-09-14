const PDFDocument = require('pdfkit');
const User = require('../models/User.model');
const RoleAssignment = require('../models/RoleAssignment.model');
const Institution = require('../models/Institution.model');
const Department = require('../models/Department.model');
const { fail } = require('@college-erp/shared-utils');

/**
 * Helper to fetch student and institution context
 */
async function resolveCertificateContext(req, res) {
  const tenantId = req.tenantId || req.headers['x-tenant-id'] || req.user?.institutionId || req.body.institutionId;
  let targetStudentId = req.body.studentId || req.body.userId || req.query.studentId;

  // If student requests certificate, default to own id
  if (!targetStudentId) {
    if (req.user?.roles?.includes('STUDENT') || !req.user?.roles?.includes('ADMIN')) {
      targetStudentId = req.user?.userId || req.user?.id;
    }
  }

  if (!targetStudentId) {
    res.status(400).json(fail('studentId is required'));
    return null;
  }

  const studentFilter = { _id: targetStudentId };
  if (tenantId && !req.user?.roles?.includes('SUPERADMIN')) {
    studentFilter.institutionId = tenantId;
  }

  const student = await User.findOne(studentFilter);
  if (!student) {
    res.status(404).json(fail('Student not found'));
    return null;
  }

  // Fetch student's role assignment & department
  const assignment = await RoleAssignment.findOne({
    userId: student._id,
    role: 'STUDENT',
    $or: [{ validTo: null }, { validTo: { $gt: new Date() } }]
  });

  let deptName = 'General Academics';
  if (assignment?.departmentId) {
    const dept = await Department.findById(assignment.departmentId);
    if (dept) deptName = dept.name;
  }

  // Fetch institution branding
  const instId = tenantId || student.institutionId;
  const institution = instId ? await Institution.findById(instId) : null;

  const brandColor = institution?.branding?.primaryColor || 
                     institution?.themeConfig?.primaryColor || 
                     '#1e3a8a';
  const instName = institution?.name || 'COLLEGE OF ENGINEERING & TECHNOLOGY';
  const subdomain = institution?.subdomain ? `${institution.subdomain}.college-erp.local` : 'college-erp.local';

  return { student, departmentName: deptName, institution, brandColor, instName, subdomain };
}

/**
 * POST /certificates/bonafide
 */
exports.generateBonafide = async (req, res) => {
  try {
    const ctx = await resolveCertificateContext(req, res);
    if (!ctx) return;

    const { student, departmentName, instName, brandColor, subdomain } = ctx;
    const certNumber = `BON-${new Date().getFullYear()}-${student.rollNumber || student._id.toString().slice(-6).toUpperCase()}`;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Bonafide Certificate - ${student.name}`,
        Author: instName
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=bonafide-${student.rollNumber || student._id}.pdf`);

    doc.pipe(res);

    // Header Color Accent Bar
    doc.rect(0, 0, doc.page.width, 14).fill(brandColor);

    // Institution Branding Header
    doc.moveDown(1.5);
    doc.fillColor(brandColor).fontSize(22).font('Helvetica-Bold').text(instName.toUpperCase(), { align: 'center' });
    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Affiliated Academic Institution • Portal: ${subdomain}`, { align: 'center' });
    doc.moveDown(0.5);

    // Decorative Line
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(brandColor).lineWidth(1.5).stroke();
    doc.moveDown(1.5);

    // Certificate Meta Info
    const metaY = doc.y;
    doc.fillColor('#475569').fontSize(9).font('Helvetica');
    doc.text(`Certificate No: ${certNumber}`, 50, metaY);
    doc.text(`Date of Issue: ${today}`, doc.page.width - 200, metaY, { width: 150, align: 'right' });
    doc.moveDown(2);

    // Title
    doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text('BONAFIDE CERTIFICATE', { align: 'center' });
    doc.moveDown(1.8);

    // Certificate Body
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica').lineGap(8);
    const bodyParagraph = `This is to certify that Mr./Ms. ${student.name}, son/daughter of institutional roll record, bearing Roll Number: ${student.rollNumber || 'N/A'} and Email ID: ${student.email}, is a bonafide student of ${instName}.`;
    doc.text(bodyParagraph, { align: 'justify' });

    doc.moveDown(1);
    const bodyParagraph2 = `He/She is actively pursuing his/her undergraduate/postgraduate curriculum in the Department of ${departmentName}. During his/her tenure at this institution, his/her conduct and moral character have been found to be good.`;
    doc.text(bodyParagraph2, { align: 'justify' });

    doc.moveDown(1);
    doc.text('This certificate is issued upon the student\'s request for academic, administrative, or official verification purposes.', { align: 'justify' });

    // Footer Signatures
    doc.moveDown(5);
    const sigY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Prepared By', 50, sigY);
    doc.text('Authorized Signatory / Principal', doc.page.width - 250, sigY, { width: 200, align: 'right' });

    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    doc.text('Academic Administration', 50, sigY + 14);
    doc.text(instName, doc.page.width - 250, sigY + 14, { width: 200, align: 'right' });

    // Bottom Footer Accent Bar
    doc.rect(0, doc.page.height - 14, doc.page.width, 14).fill(brandColor);

    doc.end();
  } catch (err) {
    console.error('[CertificateController] Bonafide generation error:', err);
    if (!res.headersSent) {
      res.status(500).json(fail('Failed to generate bonafide certificate: ' + err.message));
    }
  }
};

/**
 * POST /certificates/transfer
 */
exports.generateTransfer = async (req, res) => {
  try {
    const ctx = await resolveCertificateContext(req, res);
    if (!ctx) return;

    const { student, departmentName, instName, brandColor, subdomain } = ctx;
    const certNumber = `TC-${new Date().getFullYear()}-${student.rollNumber || student._id.toString().slice(-6).toUpperCase()}`;
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const doc = new PDFDocument({
      size: 'A4',
      margin: 50,
      info: {
        Title: `Transfer Certificate - ${student.name}`,
        Author: instName
      }
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=transfer-${student.rollNumber || student._id}.pdf`);

    doc.pipe(res);

    // Header Color Accent Bar
    doc.rect(0, 0, doc.page.width, 14).fill(brandColor);

    // Institution Branding Header
    doc.moveDown(1.5);
    doc.fillColor(brandColor).fontSize(22).font('Helvetica-Bold').text(instName.toUpperCase(), { align: 'center' });
    doc.fillColor('#64748b').fontSize(10).font('Helvetica').text(`Institutional Transfer & Leaving Record • Portal: ${subdomain}`, { align: 'center' });
    doc.moveDown(0.5);

    // Decorative Line
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).strokeColor(brandColor).lineWidth(1.5).stroke();
    doc.moveDown(1.5);

    // Certificate Meta Info
    const metaY = doc.y;
    doc.fillColor('#475569').fontSize(9).font('Helvetica');
    doc.text(`TC Reference No: ${certNumber}`, 50, metaY);
    doc.text(`Date of Issue: ${today}`, doc.page.width - 200, metaY, { width: 150, align: 'right' });
    doc.moveDown(2);

    // Title
    doc.fillColor('#0f172a').fontSize(18).font('Helvetica-Bold').text('TRANSFER / LEAVING CERTIFICATE', { align: 'center' });
    doc.moveDown(1.8);

    // Certificate Body
    doc.fillColor('#1e293b').fontSize(12).font('Helvetica').lineGap(8);
    const bodyParagraph = `This is to certify that Mr./Ms. ${student.name}, enrolled under Roll Number: ${student.rollNumber || 'N/A'} (Registered Email: ${student.email}), was a student of ${instName} in the Department of ${departmentName}.`;
    doc.text(bodyParagraph, { align: 'justify' });

    doc.moveDown(1);
    doc.text('It is hereby confirmed that:', { underline: true });
    doc.moveDown(0.5);
    doc.text('1. All institutional library books, laboratory equipment, and college dues have been cleared.');
    doc.text('2. No disciplinary actions or penalties are pending against the student.');
    doc.text(`3. Character and conduct during the student's period of study were satisfactory.`);

    doc.moveDown(1);
    doc.text('Permission is hereby granted to transfer to another institution. We convey our best wishes for their future academic pursuits and career.', { align: 'justify' });

    // Footer Signatures
    doc.moveDown(5);
    const sigY = doc.y;
    doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a');
    doc.text('Registrar / Head of Office', 50, sigY);
    doc.text('Principal / Dean', doc.page.width - 250, sigY, { width: 200, align: 'right' });

    doc.fontSize(8).font('Helvetica').fillColor('#64748b');
    doc.text('Student Affairs Division', 50, sigY + 14);
    doc.text(instName, doc.page.width - 250, sigY + 14, { width: 200, align: 'right' });

    // Bottom Footer Accent Bar
    doc.rect(0, doc.page.height - 14, doc.page.width, 14).fill(brandColor);

    doc.end();
  } catch (err) {
    console.error('[CertificateController] Transfer generation error:', err);
    if (!res.headersSent) {
      res.status(500).json(fail('Failed to generate transfer certificate: ' + err.message));
    }
  }
};
