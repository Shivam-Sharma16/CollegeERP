import { useState, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/ToastContext';
import { 
  useListExamTypesQuery, 
  useCreateExamTypeMutation, 
  useBulkUpsertMarksMutation,
  useListMarksQuery 
} from '../api/resultsApi';
import { useGetFacultyLoadQuery } from '../api/teachingApi';
import { useListSectionStudentsQuery } from '../api/usersApi';
import { Save, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import styles from './FacultyMarksEntryPage.module.css';

export default function FacultyMarksEntryPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  // 1. Select Subject and Section
  const { data: loadData } = useGetFacultyLoadQuery(user?._id, { skip: !user?._id });
  const facultyLoad = loadData?.data || { subjects: [], sections: [] };

  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');

  // 2. Fetch Data based on Selection
  const { data: studentsData } = useListSectionStudentsQuery({ sectionId }, { skip: !sectionId });
  const students = studentsData?.data || [];

  const { data: examTypesData } = useListExamTypesQuery({ subjectId }, { skip: !subjectId });
  const examTypes = examTypesData?.data || [];

  // We should also fetch existing marks to populate the grid
  const { data: marksData } = useListMarksQuery({ subjectId }, { skip: !subjectId });
  const existingMarks = marksData?.data || [];

  // 3. Exam Type Creation State
  const [createExamType, { isLoading: isCreatingExam }] = useCreateExamTypeMutation();
  const [newExamName, setNewExamName] = useState('');
  const [newExamMaxMarks, setNewExamMaxMarks] = useState('');
  const [newExamWeightage, setNewExamWeightage] = useState('');

  // Weightage calculation
  const totalAllocated = useMemo(() => {
    return examTypes.reduce((sum, et) => sum + (Number(et.weightage) || 0), 0);
  }, [examTypes]);

  const remainingWeightage = 100 - totalAllocated;

  const handleCreateExamType = async () => {
    if (!newExamName || !newExamMaxMarks || !newExamWeightage) return;
    if (Number(newExamWeightage) > remainingWeightage) {
      showToast(`Cannot exceed remaining weightage (${remainingWeightage}%)`, 'error');
      return;
    }

    try {
      await createExamType({
        name: newExamName,
        maxMarks: Number(newExamMaxMarks),
        weightage: Number(newExamWeightage),
        subjectId
      }).unwrap();
      showToast('Exam type added', 'success');
      setNewExamName('');
      setNewExamMaxMarks('');
      setNewExamWeightage('');
    } catch (err) {
      showToast(err?.data?.message || 'Failed to add exam type', 'error');
    }
  };

  // 4. Marks Grid State
  // Map of studentId -> { examTypeId -> markValue }
  const [edits, setEdits] = useState({});
  const [bulkUpsertMarks, { isLoading: isSaving }] = useBulkUpsertMarksMutation();

  const handleMarkChange = (studentId, examTypeId, value) => {
    setEdits(prev => ({
      ...prev,
      [studentId]: {
        ...(prev[studentId] || {}),
        [examTypeId]: value
      }
    }));
  };

  // Pre-fill logic combining existing marks + local edits
  const getMarkValue = (studentId, examTypeId) => {
    if (edits[studentId] && edits[studentId][examTypeId] !== undefined) {
      return edits[studentId][examTypeId];
    }
    const existing = existingMarks.find(m => m.studentId === studentId && m.examTypeId === examTypeId);
    return existing ? existing.marks : '';
  };

  const handleBulkSave = async () => {
    // Collect all entries
    const entries = [];
    for (const [studentId, examMap] of Object.entries(edits)) {
      for (const [examTypeId, markStr] of Object.entries(examMap)) {
        if (markStr === '') continue; // Skip empty
        
        const marks = Number(markStr);
        const et = examTypes.find(e => e._id === examTypeId);
        if (et && marks > et.maxMarks) {
          showToast(`Invalid mark for student ID: ${studentId}`, 'error');
          return;
        }

        entries.push({
          studentId,
          examTypeId,
          marks
        });
      }
    }

    if (entries.length === 0) {
      showToast('No new marks to save', 'info');
      return;
    }

    try {
      // Group by examTypeId to match backend expectations, or if backend handles flat array, just send.
      // The backend expects: { examTypeId, subjectId, entries: [{ studentId, marks }] }
      // So we must group by examTypeId
      const grouped = entries.reduce((acc, entry) => {
        if (!acc[entry.examTypeId]) acc[entry.examTypeId] = [];
        acc[entry.examTypeId].push({ studentId: entry.studentId, marks: entry.marks });
        return acc;
      }, {});

      for (const [examTypeId, studentEntries] of Object.entries(grouped)) {
        await bulkUpsertMarks({
          subjectId,
          examTypeId,
          entries: studentEntries
        }).unwrap();
      }

      showToast('Marks saved successfully', 'success');
      setEdits({}); // Clear local edits after save
    } catch (err) {
      showToast(err?.data?.message || 'Failed to save marks', 'error');
    }
  };

  return (
    <DashboardShell title="Marks Entry" subtitle="Continuous Assessment" icon="📝">
      <div className={styles.container}>
        
        {/* Top Controls */}
        <div className={styles.topControls}>
          <div className={styles.field}>
            <label>Select Subject</label>
            <select value={subjectId} onChange={e => setSubjectId(e.target.value)}>
              <option value="">-- Choose Subject --</option>
              {facultyLoad.subjects.map(s => (
                <option key={s._id || s} value={s._id || s}>
                  {s.name || s.code || `Subject ${s}`}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.field}>
            <label>Select Section</label>
            <select value={sectionId} onChange={e => setSectionId(e.target.value)}>
              <option value="">-- Choose Section --</option>
              {facultyLoad.sections.map(s => (
                <option key={s._id || s} value={s._id || s}>
                  {s.name || `Section ${s}`}
                </option>
              ))}
            </select>
          </div>
        </div>

        {subjectId && sectionId ? (
          <>
            {/* Exam Type Builder */}
            <div className={styles.examBuilder}>
              <div className={styles.examBuilderHeader}>
                <h3>Define Assessment Types</h3>
                <div className={`${styles.weightageBadge} ${remainingWeightage === 0 ? styles.weightageFull : ''}`}>
                  {totalAllocated}% allocated, {remainingWeightage}% remaining
                </div>
              </div>

              <div className={styles.examForm}>
                <input 
                  placeholder="e.g. Midterm 1" 
                  value={newExamName} 
                  onChange={e => setNewExamName(e.target.value)}
                  disabled={remainingWeightage === 0}
                />
                <input 
                  type="number" 
                  placeholder="Max Marks" 
                  value={newExamMaxMarks} 
                  onChange={e => setNewExamMaxMarks(e.target.value)}
                  disabled={remainingWeightage === 0}
                />
                <input 
                  type="number" 
                  placeholder="Weightage %" 
                  value={newExamWeightage} 
                  onChange={e => setNewExamWeightage(e.target.value)}
                  disabled={remainingWeightage === 0}
                />
                <Button 
                  variant="primary" 
                  onClick={handleCreateExamType}
                  disabled={!newExamName || remainingWeightage === 0 || isCreatingExam}
                >
                  <Plus size={16} /> Add Type
                </Button>
              </div>

              {examTypes.length > 0 && (
                <div className={styles.examChips}>
                  {examTypes.map(et => (
                    <div key={et._id} className={styles.examChip}>
                      <strong>{et.name}</strong>
                      <span>Max: {et.maxMarks}</span>
                      <span>Weight: {et.weightage}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Spreadsheet Grid */}
            <div className={styles.gridContainer}>
              <div className={styles.gridHeader}>
                <h3>Student Marks</h3>
                {Object.keys(edits).length > 0 && (
                  <Button variant="primary" onClick={handleBulkSave} disabled={isSaving}>
                    <Save size={16} />
                    {isSaving ? 'Saving...' : 'Bulk Save Changes'}
                  </Button>
                )}
              </div>

              {examTypes.length === 0 ? (
                <div className={styles.emptyState}>
                  <AlertCircle size={24} />
                  <p>Create at least one assessment type above to start entering marks.</p>
                </div>
              ) : students.length === 0 ? (
                <div className={styles.emptyState}>
                  <AlertCircle size={24} />
                  <p>No students found in this section.</p>
                </div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.spreadsheet}>
                    <thead>
                      <tr>
                        <th>Roll Number</th>
                        <th>Student Name</th>
                        {examTypes.map(et => (
                          <th key={et._id} title={`Max Marks: ${et.maxMarks}`}>
                            {et.name} <br/>
                            <small className={styles.maxMarkLabel}>(/{et.maxMarks})</small>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {students.map(student => (
                        <tr key={student._id}>
                          <td className={styles.rollNoCell}>{student.rollNumber || 'N/A'}</td>
                          <td className={styles.nameCell}>{student.name || 'Unknown Student'}</td>
                          {examTypes.map(et => {
                            const val = getMarkValue(student._id, et._id);
                            const numVal = Number(val);
                            const isExceeding = val !== '' && numVal > et.maxMarks;
                            
                            return (
                              <td key={et._id} className={styles.inputCell}>
                                <input
                                  type="number"
                                  value={val}
                                  onChange={(e) => handleMarkChange(student._id, et._id, e.target.value)}
                                  className={`${styles.markInput} ${isExceeding ? styles.inputError : ''}`}
                                  min="0"
                                  max={et.maxMarks}
                                  placeholder="-"
                                />
                                {isExceeding && <div className={styles.errorTooltip}>Exceeds max ({et.maxMarks})</div>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className={styles.promptState}>
            <CheckCircle size={48} className={styles.promptIcon} />
            <h2>Select Subject & Section</h2>
            <p>Please select a subject and target section from the dropdowns above to begin entering marks.</p>
          </div>
        )}

      </div>
    </DashboardShell>
  );
}
