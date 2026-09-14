import { useState, useMemo, useCallback } from 'react';
import {
  UploadCloud,
  RefreshCw,
  FileText,
  Inbox,
  CheckCircle,
  AlertTriangle,
  Search,
  Download,
  User,
  X,
  FileCheck,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { useToast } from '../components/ui/ToastContext';

// API hooks
import { useBulkImportMutation, useSearchUsersQuery } from '../api/usersApi';
import { useListDepartmentsQuery } from '../api/departmentsApi';
import { useListYearsQuery, useRolloverMutation } from '../api/academicApi';
import { useIssueCertificateMutation } from '../api/certificatesApi';
import {
  useListQuery as useListGrievancesQuery,
  useResolveMutation as useResolveGrievanceMutation,
} from '../api/grievanceApi';

import styles from './AdminOperations.module.css';

export default function AdminOperations() {
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState('bulk-import');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. BULK IMPORT STATE & HANDLERS
  // ──────────────────────────────────────────────────────────────────────────
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [csvContent, setCsvContent] = useState('');
  const [uploadResults, setUploadResults] = useState(null);

  const [bulkImport, { isLoading: isImporting }] = useBulkImportMutation();

  const handleFileProcess = useCallback((file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      showToast('Please upload a valid CSV file', 'error');
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setCsvContent(e.target?.result || '');
    };
    reader.readAsText(file);
  }, [showToast]);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  }, [handleFileProcess]);

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileProcess(e.target.files[0]);
    }
  };

  const handleExecuteImport = async () => {
    if (!csvContent) {
      showToast('Please select a CSV file first', 'error');
      return;
    }
    try {
      const res = await bulkImport(csvContent).unwrap();
      const payload = res?.data ?? res;
      setUploadResults(payload);
      showToast('Bulk import processed successfully', 'success');
    } catch (err) {
      showToast(err?.data?.message || err?.message || 'Bulk import failed', 'error');
    }
  };

  const resultsData = useMemo(() => {
    if (!uploadResults) return [];
    const successes = (uploadResults.successful || []).map((item, idx) => ({
      key: `s-${idx}`,
      row: item.row ?? (idx + 1),
      identifier: item.email || item.name || `Row ${idx + 1}`,
      role: item.role || item.department || 'User',
      status: 'SUCCESS',
      reason: 'Imported successfully',
    }));

    const failures = (uploadResults.failed || []).map((item, idx) => ({
      key: `f-${idx}`,
      row: item.row ?? (idx + 1),
      identifier: item.email || item.name || `Row ${idx + 1}`,
      role: item.role || '—',
      status: 'FAILED',
      reason: item.error || item.reason || 'Validation error',
    }));

    return [...successes, ...failures].sort(
      (a, b) => (Number(a.row) || 0) - (Number(b.row) || 0)
    );
  }, [uploadResults]);

  const bulkImportColumns = useMemo(
    () => [
      { key: 'row', label: 'Row #' },
      { key: 'identifier', label: 'Identifier (Email / Name)' },
      { key: 'role', label: 'Role / Details' },
      {
        key: 'status',
        label: 'Status',
        render: (_val, r) => (
          <span className={r.status === 'SUCCESS' ? styles.badgeSuccess : styles.badgeFailed}>
            {r.status === 'SUCCESS' ? <CheckCircle size={13} /> : <AlertTriangle size={13} />}
            {r.status}
          </span>
        ),
      },
      {
        key: 'reason',
        label: 'Details / Failure Reason',
        render: (_val, r) =>
          r.status === 'FAILED' ? (
            <span className={styles.errorReasonText}>{r.reason}</span>
          ) : (
            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.825rem' }}>
              {r.reason}
            </span>
          ),
      },
    ],
    []
  );

  // ──────────────────────────────────────────────────────────────────────────
  // 2. ACADEMIC ROLLOVER STATE & HANDLERS
  // ──────────────────────────────────────────────────────────────────────────
  const { data: deptData } = useListDepartmentsQuery();
  const { data: yearsData } = useListYearsQuery();
  const [rollover, { isLoading: isRolloverLoading }] = useRolloverMutation();

  const departments = useMemo(() => {
    return Array.isArray(deptData?.data) ? deptData.data : Array.isArray(deptData) ? deptData : [];
  }, [deptData]);

  const years = useMemo(() => {
    return Array.isArray(yearsData?.data)
      ? yearsData.data
      : Array.isArray(yearsData)
      ? yearsData
      : [];
  }, [yearsData]);

  const [selectedDeptId, setSelectedDeptId] = useState('');
  const [selectedYearId, setSelectedYearId] = useState('');
  const [currentSem, setCurrentSem] = useState(3);
  const [rolloverStudentCount, setRolloverStudentCount] = useState(247);
  const [showRolloverConfirm, setShowRolloverConfirm] = useState(false);

  const selectedDept = departments.find((d) => d._id === selectedDeptId);
  const deptName = selectedDept?.name || 'Computer Science';
  const nextSem = Number(currentSem) + 1;

  const rolloverDescription = `${rolloverStudentCount} students in ${deptName} will move from Sem ${currentSem} to Sem ${nextSem}`;

  const handleConfirmRollover = async () => {
    try {
      await rollover({
        departmentId: selectedDeptId || departments[0]?._id,
        yearId: selectedYearId || years[0]?._id,
        currentSemesterNumber: Number(currentSem),
      }).unwrap();

      showToast(`Rollover completed: ${rolloverDescription}`, 'success');
      setShowRolloverConfirm(false);
    } catch (err) {
      showToast(err?.data?.message || err?.message || 'Rollover failed', 'error');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. CERTIFICATE ISSUE STATE & HANDLERS
  // ──────────────────────────────────────────────────────────────────────────
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [certificateType, setCertificateType] = useState('bonafide');
  const [purpose, setPurpose] = useState('');
  const [reason, setReason] = useState('');

  const { data: searchResults = [], isFetching: isSearching } = useSearchUsersQuery(
    studentSearchQuery,
    { skip: studentSearchQuery.trim().length < 2 }
  );

  const [issueCertificate, { isLoading: isIssuingCert }] = useIssueCertificateMutation();

  const handleSelectStudent = (student) => {
    setSelectedStudent(student);
    setStudentSearchQuery('');
  };

  const handleGenerateCertificate = async (e) => {
    e.preventDefault();
    if (!selectedStudent) {
      showToast('Please search and select a student first', 'error');
      return;
    }
    try {
      const blob = await issueCertificate({
        type: certificateType,
        studentId: selectedStudent._id,
        purpose,
        reason,
      }).unwrap();

      const blobUrl = window.URL.createObjectURL(
        new Blob([blob], { type: 'application/pdf' })
      );
      const link = document.createElement('a');
      link.href = blobUrl;
      const cleanName = (selectedStudent.name || 'student').replace(/\s+/g, '_');
      link.setAttribute('download', `${certificateType}_certificate_${cleanName}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);

      showToast(
        `${certificateType === 'bonafide' ? 'Bonafide' : 'Transfer'} certificate downloaded successfully!`,
        'success'
      );
    } catch (err) {
      showToast(err?.data?.message || err?.message || 'Failed to issue certificate', 'error');
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 4. GRIEVANCE INBOX STATE & HANDLERS
  // ──────────────────────────────────────────────────────────────────────────
  const [grievanceStatusFilter, setGrievanceStatusFilter] = useState('All');
  const {
    data: rawGrievances,
    isLoading: isGrievancesLoading,
  } = useListGrievancesQuery(
    grievanceStatusFilter === 'All' ? {} : { status: grievanceStatusFilter }
  );

  const grievancesList = useMemo(() => {
    const list = Array.isArray(rawGrievances?.data)
      ? rawGrievances.data
      : Array.isArray(rawGrievances)
      ? rawGrievances
      : [];
    return list;
  }, [rawGrievances]);

  const [resolvingGrievance, setResolvingGrievance] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolveGrievance, { isLoading: isResolving }] = useResolveGrievanceMutation();

  const handleOpenResolveModal = (item) => {
    setResolvingGrievance(item);
    setResolutionNotes('');
  };

  const handleSubmitResolution = async (e) => {
    e.preventDefault();
    if (!resolvingGrievance) return;
    try {
      await resolveGrievance({
        id: resolvingGrievance._id,
        resolutionNotes,
      }).unwrap();

      showToast('Grievance resolved successfully', 'success');
      setResolvingGrievance(null);
      setResolutionNotes('');
    } catch (err) {
      showToast(err?.data?.message || err?.message || 'Failed to resolve grievance', 'error');
    }
  };

  const grievanceColumns = useMemo(
    () => [
      {
        key: 'subject',
        label: 'Subject / Category',
        render: (_val, g) => (
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              {g?.title || g?.subject || 'Grievance Issue'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {g?.category || 'General'}
            </div>
          </div>
        ),
      },
      {
        key: 'student',
        label: 'Submitted By',
        render: (_val, g) => (
          <span>
            {g?.student?.name || g?.submittedBy?.name || g?.studentName || 'Student'}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (_val, g) => {
          const s = (g?.status || 'PENDING').toUpperCase();
          let cls = styles.badgePending;
          if (s === 'INVESTIGATING') cls = styles.badgeInvestigating;
          if (s === 'RESOLVED') cls = styles.badgeResolved;
          return <span className={cls}>{s}</span>;
        },
      },
      {
        key: 'createdAt',
        label: 'Date',
        render: (_val, g) => (
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
            {g?.createdAt ? new Date(g.createdAt).toLocaleDateString() : '—'}
          </span>
        ),
      },
      {
        key: 'actions',
        label: 'Action',
        render: (_val, g) => (
          <div>
            {(g?.status || '').toUpperCase() !== 'RESOLVED' ? (
              <Button size="sm" variant="secondary" onClick={() => handleOpenResolveModal(g)}>
                Resolve
              </Button>
            ) : (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                Resolved
              </span>
            )}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className={styles.container}>
      {/* ── Tabs Navigation ── */}
      <nav className={styles.tabNav} aria-label="Admin Operations Tabs">
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'bulk-import' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('bulk-import')}
        >
          <UploadCloud size={18} />
          Bulk Import
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'rollover' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('rollover')}
        >
          <RefreshCw size={18} />
          Academic Rollover
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'certificates' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('certificates')}
        >
          <FileText size={18} />
          Issue Certificates
        </button>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'grievances' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('grievances')}
        >
          <Inbox size={18} />
          Grievance Inbox
        </button>
      </nav>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: BULK IMPORT */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'bulk-import' && (
        <section className={styles.card} aria-labelledby="bulk-import-heading">
          <div className={styles.cardHeader}>
            <h2 id="bulk-import-heading" className={styles.cardTitle}>
              Bulk User Import
            </h2>
            <p className={styles.cardSubtitle}>
              Upload a CSV file containing user records. You will see a detailed row-by-row
              breakdown showing successful rows and specific error reasons for any failed rows.
            </p>
          </div>

          <div
            className={`${styles.dropzone} ${dragActive ? styles.dropzoneActive : ''}`}
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={() => document.getElementById('csv-file-input')?.click()}
          >
            <input
              id="csv-file-input"
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleFileInputChange}
            />
            <div className={styles.dropzoneIcon}>
              <UploadCloud size={28} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--color-text)' }}>
                {selectedFile ? selectedFile.name : 'Drag and drop your CSV file here'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                or click to browse from your computer
              </div>
            </div>
          </div>

          {selectedFile && (
            <div className={styles.filePreviewBar}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <FileCheck size={20} color="var(--color-primary-light)" />
                <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{selectedFile.name}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  ({Math.round(selectedFile.size / 1024)} KB)
                </span>
              </div>
              <Button
                variant="primary"
                onClick={handleExecuteImport}
                disabled={isImporting}
              >
                {isImporting ? 'Processing CSV...' : 'Process Bulk Import'}
              </Button>
            </div>
          )}

          {uploadResults && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-4)' }}>
              <div className={styles.summaryStrip}>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryValue}>
                    {uploadResults.totalRows ??
                      ((uploadResults.successful?.length || 0) + (uploadResults.failed?.length || 0))}
                  </span>
                  <span className={styles.summaryLabel}>Total Rows</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryValue} style={{ color: '#4ade80' }}>
                    {uploadResults.importedCount ?? (uploadResults.successful?.length || 0)}
                  </span>
                  <span className={styles.summaryLabel}>Successfully Imported</span>
                </div>
                <div className={styles.summaryCard}>
                  <span className={styles.summaryValue} style={{ color: '#f87171' }}>
                    {uploadResults.failedCount ?? (uploadResults.failed?.length || 0)}
                  </span>
                  <span className={styles.summaryLabel}>Failed Rows</span>
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 'var(--spacing-3)' }}>
                  Row-by-Row Import Results
                </h3>
                <Table
                  columns={bulkImportColumns}
                  data={resultsData}
                  isLoading={isImporting}
                  emptyIcon="inbox"
                />
              </div>
            </div>
          )}
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: ACADEMIC ROLLOVER */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'rollover' && (
        <section className={styles.card} aria-labelledby="rollover-heading">
          <div className={styles.cardHeader}>
            <h2 id="rollover-heading" className={styles.cardTitle}>
              Academic Rollover
            </h2>
            <p className={styles.cardSubtitle}>
              Advance an entire cohort to their next academic semester. Review the exact impact
              statement before confirming.
            </p>
          </div>

          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="dept-select" className={styles.formLabel}>
                Department
              </label>
              <select
                id="dept-select"
                className={styles.select}
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
              >
                <option value="">Select Department</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="year-select" className={styles.formLabel}>
                Academic Year
              </label>
              <select
                id="year-select"
                className={styles.select}
                value={selectedYearId}
                onChange={(e) => setSelectedYearId(e.target.value)}
              >
                <option value="">Select Academic Year</option>
                {years.map((y) => (
                  <option key={y._id} value={y._id}>
                    {y.name || y.academicYear || y.year}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="sem-select" className={styles.formLabel}>
                Current Semester
              </label>
              <select
                id="sem-select"
                className={styles.select}
                value={currentSem}
                onChange={(e) => setCurrentSem(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5, 6, 7].map((num) => (
                  <option key={num} value={num}>
                    Semester {num}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="student-count-input" className={styles.formLabel}>
                Enrolled Students
              </label>
              <input
                id="student-count-input"
                type="number"
                className={styles.input}
                value={rolloverStudentCount}
                onChange={(e) => setRolloverStudentCount(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className={styles.rolloverPreviewCard}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              Projected Rollover Impact
            </div>
            <div className={styles.rolloverHighlight}>{rolloverDescription}</div>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
              All current section rosters and courses will advance to Semester {nextSem}. Historical
              attendance, marks, and transcripts for Semester {currentSem} are securely preserved.
            </p>
          </div>

          <div>
            <Button
              variant="primary"
              onClick={() => setShowRolloverConfirm(true)}
              disabled={isRolloverLoading}
            >
              Execute Rollover Action
            </Button>
          </div>

          <ConfirmDialog
            isOpen={showRolloverConfirm}
            onClose={() => setShowRolloverConfirm(false)}
            onConfirm={handleConfirmRollover}
            title="Confirm Academic Rollover"
            warningText={`${rolloverDescription}. This will advance all students to the next term. Are you sure you want to execute this rollover?`}
            confirmLabel="Execute Rollover"
            isDestructive={false}
            isLoading={isRolloverLoading}
          />
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: CERTIFICATES */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'certificates' && (
        <section className={styles.card} aria-labelledby="certificate-heading">
          <div className={styles.cardHeader}>
            <h2 id="certificate-heading" className={styles.cardTitle}>
              Issue Student Certificate
            </h2>
            <p className={styles.cardSubtitle}>
              Search for a student, choose the certificate type (Bonafide or Transfer), and generate
              an official signed PDF certificate.
            </p>
          </div>

          <form onSubmit={handleGenerateCertificate} className={styles.certificateForm}>
            {/* Student Search */}
            <div className={styles.formGroup}>
              <label htmlFor="student-search" className={styles.formLabel}>
                Search Student
              </label>
              {!selectedStudent ? (
                <div style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                    <Search
                      size={16}
                      style={{
                        position: 'absolute',
                        left: 12,
                        color: 'var(--color-text-muted)',
                      }}
                    />
                    <input
                      id="student-search"
                      type="text"
                      className={styles.input}
                      style={{ paddingLeft: 36 }}
                      placeholder="Type name, email, or roll number..."
                      value={studentSearchQuery}
                      onChange={(e) => setStudentSearchQuery(e.target.value)}
                    />
                  </div>

                  {searchResults.length > 0 && studentSearchQuery.trim().length >= 2 && (
                    <div className={styles.searchResultsList}>
                      {searchResults.map((user) => (
                        <div
                          key={user._id}
                          className={styles.searchUserRow}
                          onClick={() => handleSelectStudent(user)}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                              {user.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                              {user.email} {user.rollNumber ? `• ${user.rollNumber}` : ''}
                            </div>
                          </div>
                          <Button size="sm" variant="ghost">
                            Select
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  {isSearching && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 4 }}>
                      Searching students...
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.selectedStudentCard}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <User size={20} color="var(--color-primary-light)" />
                    <div>
                      <div style={{ fontWeight: 600 }}>{selectedStudent.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        {selectedStudent.email}{' '}
                        {selectedStudent.rollNumber ? `• ${selectedStudent.rollNumber}` : ''}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedStudent(null)}
                  >
                    Change
                  </Button>
                </div>
              )}
            </div>

            {/* Certificate Type */}
            <div className={styles.formGroup}>
              <label htmlFor="certificate-type-select" className={styles.formLabel}>
                Certificate Type
              </label>
              <select
                id="certificate-type-select"
                className={styles.select}
                value={certificateType}
                onChange={(e) => setCertificateType(e.target.value)}
              >
                <option value="bonafide">Bonafide Certificate</option>
                <option value="transfer">Transfer Certificate (TC)</option>
              </select>
            </div>

            {/* Purpose */}
            <div className={styles.formGroup}>
              <label htmlFor="certificate-purpose" className={styles.formLabel}>
                Purpose of Issuance
              </label>
              <input
                id="certificate-purpose"
                type="text"
                className={styles.input}
                placeholder="e.g. Passport Application, Higher Education, Education Loan"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            {/* Reason / Remarks */}
            <div className={styles.formGroup}>
              <label htmlFor="certificate-reason" className={styles.formLabel}>
                Remarks / Reason
              </label>
              <textarea
                id="certificate-reason"
                className={styles.input}
                rows={3}
                placeholder="Additional details or administrative remarks..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            <div>
              <Button
                type="submit"
                variant="primary"
                disabled={!selectedStudent || isIssuingCert}
              >
                <Download size={16} style={{ marginRight: 6 }} />
                {isIssuingCert ? 'Generating Certificate...' : 'Generate & Download Certificate'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 4: GRIEVANCE INBOX */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'grievances' && (
        <section className={styles.card} aria-labelledby="grievance-heading">
          <div className={styles.cardHeader}>
            <h2 id="grievance-heading" className={styles.cardTitle}>
              Grievance Inbox
            </h2>
            <p className={styles.cardSubtitle}>
              Review submitted student and faculty grievances, filter by status, and document formal
              resolutions.
            </p>
          </div>

          {/* Status Filter Pills */}
          <div className={styles.statusPillBar}>
            {['All', 'PENDING', 'INVESTIGATING', 'RESOLVED'].map((status) => (
              <button
                key={status}
                type="button"
                className={`${styles.statusPill} ${
                  grievanceStatusFilter === status ? styles.statusPillActive : ''
                }`}
                onClick={() => setGrievanceStatusFilter(status)}
              >
                {status}
              </button>
            ))}
          </div>

          <Table
            columns={grievanceColumns}
            data={grievancesList}
            isLoading={isGrievancesLoading}
            emptyIcon="inbox"
          />

          {/* Resolve Grievance Modal */}
          <Modal
            isOpen={!!resolvingGrievance}
            onClose={() => setResolvingGrievance(null)}
            title="Resolve Grievance"
          >
            {resolvingGrievance && (
              <form onSubmit={handleSubmitResolution} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>
                    {resolvingGrievance.title || resolvingGrievance.subject}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                    Submitted by {resolvingGrievance.student?.name || resolvingGrievance.submittedBy?.name || 'Student'}
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="resolution-notes" className={styles.formLabel}>
                    Resolution Notes & Action Taken
                  </label>
                  <textarea
                    id="resolution-notes"
                    className={styles.input}
                    rows={4}
                    required
                    placeholder="Provide details on how this issue was investigated and resolved..."
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setResolvingGrievance(null)}
                    disabled={isResolving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" variant="primary" disabled={isResolving}>
                    {isResolving ? 'Submitting...' : 'Confirm Resolution'}
                  </Button>
                </div>
              </form>
            )}
          </Modal>
        </section>
      )}
    </div>
  );
}
