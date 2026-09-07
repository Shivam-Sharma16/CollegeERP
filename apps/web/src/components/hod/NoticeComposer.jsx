import { useState, useMemo } from 'react';
import { useResolveDeptTreeQuery } from '../../api/departmentsApi';
import { useCreateNoticeMutation } from '../../api/noticeApi';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import styles from './NoticeComposer.module.css';

export function NoticeComposer() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [targetYear, setTargetYear] = useState('');
  const [targetSection, setTargetSection] = useState('');

  const { showToast } = useToast();

  const { data: deptData, isLoading: isLoadingTree } = useResolveDeptTreeQuery();
  const [createNotice, { isLoading: isCreating }] = useCreateNoticeMutation();

  const departmentTree = deptData?.data?.departments?.[0];

  const years = useMemo(() => {
    return departmentTree?.years || [];
  }, [departmentTree]);

  const sections = useMemo(() => {
    if (!targetYear || !years.length) return [];
    const yearNode = years.find(y => y._id === targetYear || y.year.toString() === targetYear);
    if (!yearNode) return [];

    const list = [];
    yearNode.semesters?.forEach(sem => {
      sem.sections?.forEach(sec => {
        list.push(sec);
      });
    });
    return list;
  }, [targetYear, years]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const targeting = {};
    if (targetYear) targeting.years = [targetYear];
    if (targetSection) targeting.sections = [targetSection];

    try {
      await createNotice({
        title,
        body,
        targeting
      }).unwrap();

      showToast('Notice posted successfully', 'success');
      setTitle('');
      setBody('');
      setTargetYear('');
      setTargetSection('');
    } catch (err) {
      showToast(err?.data?.message || 'Failed to post notice', 'error');
    }
  };

  return (
    <form className={styles.composer} onSubmit={handleSubmit}>
      <h4 className={styles.header}>Create Notice</h4>

      <div className={styles.field}>
        <label htmlFor="title">Notice Title</label>
        <input
          id="title"
          className={styles.input}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          placeholder="e.g., Mid-Term Exam Schedule"
          disabled={isCreating}
        />
      </div>

      <div className={styles.field}>
        <label htmlFor="body">Notice Content</label>
        <textarea
          id="body"
          className={styles.textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
          placeholder="Type your notice here..."
          rows={4}
          disabled={isCreating}
        />
      </div>

      <div className={styles.targetingGrid}>
        <div className={styles.field}>
          <label>Target Department</label>
          <input
            className={styles.input}
            type="text"
            disabled
            value="Your Department"
            title="Department is automatically scoped by the server."
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="targetYear">Target Year (Optional)</label>
          <select
            id="targetYear"
            className={styles.input}
            value={targetYear}
            onChange={(e) => {
              setTargetYear(e.target.value);
              setTargetSection('');
            }}
            disabled={isCreating || isLoadingTree}
          >
            <option value="">All Years</option>
            {years.map(y => (
              <option key={y._id || y.year} value={y._id || y.year}>Year {y.year}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="targetSection">Target Section (Optional)</label>
          <select
            id="targetSection"
            className={styles.input}
            value={targetSection}
            onChange={(e) => setTargetSection(e.target.value)}
            disabled={isCreating || isLoadingTree || !targetYear || sections.length === 0}
          >
            <option value="">All Sections</option>
            {sections.map(sec => (
              <option key={sec._id} value={sec._id}>Section {sec.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        <Button type="submit" variant="primary" disabled={isCreating || !title || !body}>
          {isCreating ? 'Posting...' : 'Post Notice'}
        </Button>
      </div>
    </form>
  );
}
