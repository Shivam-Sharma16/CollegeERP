import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useGetDepartmentQuery } from '../../api/departmentsApi';
import { Skeleton } from '../ui/Skeleton';
import { 
  Building2, 
  UserCheck, 
  Users, 
  GraduationCap, 
  Mail, 
  Phone, 
  FileText, 
  Edit3, 
  Layers,
  AlertCircle
} from 'lucide-react';
import styles from './DepartmentDetailModal.module.css';

export function DepartmentDetailModal({ isOpen, onClose, departmentId, onEdit }) {
  const { data: deptRes, isLoading } = useGetDepartmentQuery(departmentId, {
    skip: !isOpen || !departmentId,
  });

  const department = deptRes?.data || deptRes;

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Department Details">
      {isLoading || !department ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-3)' }}>
          <Skeleton height="80px" />
          <Skeleton height="60px" />
          <Skeleton height="120px" />
        </div>
      ) : (
        <div className={styles.container}>
          {/* Header Card */}
          <div className={styles.headerCard}>
            <div className={styles.deptTitleGroup}>
              <h2 className={styles.deptName}>{department.name}</h2>
              <div className={styles.badges}>
                <span className={styles.codeBadge}>{department.code}</span>
                <span
                  className={`${styles.statusBadge} ${
                    department.isActive !== false ? styles.statusActive : styles.statusInactive
                  }`}
                >
                  {department.isActive !== false ? '● Active' : '○ Inactive'}
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => {
                onClose();
                if (onEdit) onEdit(department);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Edit3 size={14} />
              Edit
            </Button>
          </div>

          {/* Quick Metrics */}
          <div className={styles.statsStrip}>
            <div className={styles.statBox}>
              <span className={styles.statVal} style={{ color: 'var(--color-primary-light)' }}>
                {department.facultyCount || 0}
              </span>
              <span className={styles.statLabel}>Faculty Members</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statVal} style={{ color: 'var(--color-success)' }}>
                {department.studentCount || 0}
              </span>
              <span className={styles.statLabel}>Enrolled Students</span>
            </div>
            <div className={styles.statBox}>
              <span className={styles.statVal} style={{ color: 'var(--color-accent, #eab308)' }}>
                {department.yearsCount || 0}
              </span>
              <span className={styles.statLabel}>Academic Batches</span>
            </div>
          </div>

          {/* Overview / Description */}
          {department.description ? (
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                <FileText size={16} /> Overview
              </h3>
              <p className={styles.sectionText}>{department.description}</p>
            </div>
          ) : null}

          {/* Head of Department (HOD) Card */}
          <div className={styles.sectionCard}>
            <h3 className={styles.sectionTitle}>
              <UserCheck size={16} /> Head of Department
            </h3>
            {department.hod ? (
              <div className={styles.hodProfile}>
                <div className={styles.hodAvatar}>
                  {department.hod.name?.charAt(0).toUpperCase()}
                </div>
                <div className={styles.hodInfo}>
                  <p className={styles.hodName}>{department.hod.name}</p>
                  <p className={styles.hodContact}>
                    <span>{department.hod.email}</span>
                    {department.hod.phone && <span>• {department.hod.phone}</span>}
                  </p>
                </div>
              </div>
            ) : (
              <div className={styles.noHod}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>No Head of Department is currently appointed.</span>
                </div>
                <Button
                  variant="ghost"
                  onClick={() => {
                    onClose();
                    if (onEdit) onEdit(department);
                  }}
                  style={{ textDecoration: 'underline', padding: '0 4px' }}
                >
                  Assign HOD
                </Button>
              </div>
            )}
          </div>

          {/* Contact Details */}
          {(department.contactEmail || department.contactPhone) && (
            <div className={styles.sectionCard}>
              <h3 className={styles.sectionTitle}>
                <Building2 size={16} /> Contact Details
              </h3>
              <div className={styles.contactGrid}>
                {department.contactEmail && (
                  <div className={styles.contactItem}>
                    <Mail size={14} color="var(--color-text-muted)" />
                    <span>{department.contactEmail}</span>
                  </div>
                )}
                {department.contactPhone && (
                  <div className={styles.contactItem}>
                    <Phone size={14} color="var(--color-text-muted)" />
                    <span>{department.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className={styles.actions}>
            <Button variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
