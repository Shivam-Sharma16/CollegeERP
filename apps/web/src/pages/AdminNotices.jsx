import { useState } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { useToast } from '../components/ui/ToastContext';
import { useCreateNoticeMutation } from '../api/noticeApi';
import { useListDepartmentsQuery } from '../api/departmentsApi';
import { UploadCloud } from 'lucide-react';
import styles from './AdminNotices.module.css';

export default function AdminNotices() {
  const { data: deptData, isLoading: isLoadingDepts } = useListDepartmentsQuery();
  const [createNotice, { isLoading: isSubmitting }] = useCreateNoticeMutation();
  const { showToast } = useToast();

  const departments = deptData?.data || [];

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  
  // Targeting state
  const [targetAll, setTargetAll] = useState(true);
  const [selectedRoles, setSelectedRoles] = useState([]);
  const [selectedDepartments, setSelectedDepartments] = useState([]);

  const roleOptions = [
    { value: 'STUDENT', label: 'Students' },
    { value: 'FACULTY', label: 'Faculty' },
    { value: 'CC', label: 'Class Coordinators' },
    { value: 'HOD', label: 'Heads of Department' }
  ];

  const handleRoleToggle = (role) => {
    setSelectedRoles(prev => 
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const handleDepartmentToggle = (deptId) => {
    setSelectedDepartments(prev => 
      prev.includes(deptId) ? prev.filter(id => id !== deptId) : [...prev, deptId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const payload = {
        title,
        body,
        targeting: targetAll ? {} : {
          roles: selectedRoles.length > 0 ? selectedRoles : undefined,
          departments: selectedDepartments.length > 0 ? selectedDepartments : undefined
        }
      };

      await createNotice(payload).unwrap();
      showToast('Institution notice published successfully', 'success');
      
      // Reset
      setTitle('');
      setBody('');
      setTargetAll(true);
      setSelectedRoles([]);
      setSelectedDepartments([]);
    } catch (err) {
      showToast(err?.data?.message || 'Failed to publish notice', 'error');
    }
  };

  return (
    <DashboardShell title="Institution Notices" subtitle="Publish announcements and circulars" icon="📢">
      <PageTransition>
        <div className={styles.container}>
          <form className={styles.card} onSubmit={handleSubmit}>
            <StaggerList style={{ display: 'contents' }}>
          
            <StaggerItem>
            <div className={styles.mainContent}>
            <div className={styles.field}>
              <label htmlFor="title">Notice Title</label>
              <input
                id="title"
                required
                type="text"
                className={styles.input}
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isSubmitting}
                placeholder="e.g. Mandatory System Maintenance this Saturday"
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="body">Notice Content</label>
              <textarea
                id="body"
                required
                className={`${styles.input} ${styles.textarea}`}
                value={body}
                onChange={e => setBody(e.target.value)}
                disabled={isSubmitting}
                placeholder="Write the full notice text here..."
              />
            </div>

            <div className={styles.field}>
              <label>Attachment (Optional)</label>
              <div className={styles.fileUpload}>
                <UploadCloud size={24} color="var(--color-text-muted)" />
                <span className={styles.uploadText}>Click to upload or drag and drop</span>
                <span className={styles.uploadHint}>PDF, DOCX, or Image (Max 5MB)</span>
                {/* Mock file input */}
                <input type="file" className={styles.fileInput} disabled={isSubmitting} />
              </div>
            </div>
            </div>
            </StaggerItem>

            <StaggerItem>
            <div className={styles.sidebar}>
            <div className={styles.targetingBox}>
              <h3 className={styles.targetingTitle}>Audience Targeting</h3>
              
              <div className={styles.targetAllWrap}>
                <label className={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={targetAll}
                    onChange={e => setTargetAll(e.target.checked)}
                    disabled={isSubmitting}
                  />
                  Target Entire Institution
                </label>
                <p className={styles.hint}>Broadcast to everyone in the system.</p>
              </div>

              {!targetAll && (
                <div className={styles.targetingFilters}>
                  <div className={styles.filterSection}>
                    <h4 className={styles.filterTitle}>Specific Roles</h4>
                    {roleOptions.map(role => (
                      <label key={role.value} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role.value)}
                          onChange={() => handleRoleToggle(role.value)}
                          disabled={isSubmitting}
                        />
                        {role.label}
                      </label>
                    ))}
                  </div>

                  <div className={styles.filterSection}>
                    <h4 className={styles.filterTitle}>Specific Departments</h4>
                    {isLoadingDepts ? (
                      <p className={styles.hint}>Loading departments...</p>
                    ) : departments.map(dept => (
                      <label key={dept._id} className={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={selectedDepartments.includes(dept._id)}
                          onChange={() => handleDepartmentToggle(dept._id)}
                          disabled={isSubmitting}
                        />
                        {dept.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.actions}>
              <Button type="submit" variant="primary" disabled={isSubmitting || !title || !body}>
                {isSubmitting ? 'Publishing...' : 'Publish Notice'}
              </Button>
            </div>
            </div>
            </StaggerItem>
          </StaggerList>
          </form>
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
