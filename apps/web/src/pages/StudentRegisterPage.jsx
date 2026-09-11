import { useState, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useStudentSelfRegisterMutation } from '../api/authApi';
import { useResolveDeptTreeQuery } from '../api/departmentsApi';
import { useAppSelector } from '../store';
import { selectInstitutionName, selectInstitutionLogo } from '../features/ui/themeSlice';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import usePageMeta from '../hooks/usePageMeta';
import styles from './StudentRegisterPage.module.css';

export default function StudentRegisterPage() {
  usePageMeta({
    title: 'Student Registration',
    description: 'Register as a student in the College ERP system.',
    isPublic: true
  });

  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [enrollmentNumber, setEnrollmentNumber] = useState('');

  const [departmentId, setDepartmentId] = useState('');
  const [yearId, setYearId] = useState('');
  const [semesterId, setSemesterId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const institutionName = useAppSelector(selectInstitutionName);
  const institutionLogo = useAppSelector(selectInstitutionLogo);

  const [register, { isLoading: isRegistering, error }] = useStudentSelfRegisterMutation();
  const { data: treeData, isLoading: isTreeLoading } = useResolveDeptTreeQuery();

  const errorMessage = error?.data?.message ?? error?.data?.error ?? error?.error ?? '';

  // Cascading logic
  const departments = treeData?.departments || [];
  
  const selectedDept = useMemo(() => {
    return departments.find(d => d._id === departmentId);
  }, [departments, departmentId]);

  const years = selectedDept?.years || [];
  const selectedYear = useMemo(() => {
    return years.find(y => y._id === yearId);
  }, [years, yearId]);

  const semesters = selectedYear?.semesters || [];
  const selectedSemester = useMemo(() => {
    return semesters.find(s => s._id === semesterId);
  }, [semesters, semesterId]);

  const sections = selectedSemester?.sections || [];

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      await register({
        name,
        email,
        password,
        enrollmentNumber,
        departmentId: departmentId,
        year: yearId,
        semester: semesterId,
        sectionId: sectionId,
      }).unwrap();
      navigate('/login', { replace: true });
    } catch { /* error handled by UI */ }
  }

  return (
    <PageTransition>
      <div className={styles.page}>
      <div className={styles.card} style={{ maxWidth: '500px' }}>
        <div className={styles.logoWrap}>
          {institutionLogo ? (
            <img src={institutionLogo} alt={institutionName} className={styles.institutionLogo} />
          ) : (
            <div className={styles.logo}>🎓</div>
          )}
          <h1 className={styles.appName}>Student Registration</h1>
          <p className={styles.tagline}>Create your account for {institutionName}</p>
        </div>

        <form className={`${styles.form} ${errorMessage ? styles.shake : ''}`} onSubmit={handleSubmit}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.floatingLabel}>
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder=" "
              />
              <label htmlFor="name">Full Name</label>
            </div>

            <div className={styles.floatingLabel}>
              <input
                id="enrollmentNumber"
                type="text"
                value={enrollmentNumber}
                onChange={(e) => setEnrollmentNumber(e.target.value)}
                placeholder=" "
              />
              <label htmlFor="enrollmentNumber">Enrollment No. (Opt)</label>
            </div>
          </div>

          <div className={styles.floatingLabel}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="email">Email address</label>
          </div>

          <div className={styles.floatingLabel}>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder=" "
            />
            <label htmlFor="password">Password</label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.floatingLabel}>
              <select
                id="department"
                required
                className={departmentId ? styles.hasValue : ''}
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  setYearId('');
                  setSemesterId('');
                  setSectionId('');
                }}
                disabled={isTreeLoading}
              >
                <option value="" disabled></option>
                {departments.map(d => (
                  <option key={d._id} value={d._id}>{d.name || d.code}</option>
                ))}
              </select>
              <label htmlFor="department">Department</label>
            </div>

            <div className={styles.floatingLabel}>
              <select
                id="year"
                required
                className={yearId ? styles.hasValue : ''}
                value={yearId}
                onChange={(e) => {
                  setYearId(e.target.value);
                  setSemesterId('');
                  setSectionId('');
                }}
                disabled={!departmentId}
              >
                <option value="" disabled></option>
                {years.map(y => (
                  <option key={y._id} value={y._id}>{y.name}</option>
                ))}
              </select>
              <label htmlFor="year">Year</label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className={styles.floatingLabel}>
              <select
                id="semester"
                required
                className={semesterId ? styles.hasValue : ''}
                value={semesterId}
                onChange={(e) => {
                  setSemesterId(e.target.value);
                  setSectionId('');
                }}
                disabled={!yearId}
              >
                <option value="" disabled></option>
                {semesters.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              <label htmlFor="semester">Semester</label>
            </div>

            <div className={styles.floatingLabel}>
              <select
                id="section"
                required
                className={sectionId ? styles.hasValue : ''}
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={!semesterId}
              >
                <option value="" disabled></option>
                {sections.map(s => (
                  <option key={s._id} value={s._id}>{s.name}</option>
                ))}
              </select>
              <label htmlFor="section">Section</label>
            </div>
          </div>

          {errorMessage && (
            <p className={styles.error} role="alert">{errorMessage}</p>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={isRegistering}
          >
            {isRegistering ? 'Registering…' : 'Register Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: '24px', fontSize: 'var(--text-sm)' }}>
          <Link to="/login" style={{ color: 'var(--color-primary)' }}>Already have an account? Sign in</Link>
        </p>
      </div>
      </div>
    </PageTransition>
  );
}
