import React from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { useGetUserQuery } from '../../api/usersApi';
import {
  UserCheck,
  Building2,
  Mail,
  Phone,
  Calendar,
  Layers,
  Edit2,
  Users,
  Shield,
  ExternalLink,
} from 'lucide-react';
import styles from './HodDetailModal.module.css';

export function HodDetailModal({ isOpen, onClose, hod, onEdit }) {
  const { data: userDetails, isLoading } = useGetUserQuery(hod?._id, {
    skip: !isOpen || !hod?._id,
  });

  if (!isOpen || !hod) return null;

  const currentHod = userDetails || hod;
  const dept = currentHod.departmentId;
  const createdDate = currentHod.createdAt
    ? new Date(currentHod.createdAt).toLocaleDateString()
    : '—';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Head of Department Profile">
      <div className={styles.container}>
        {/* Header Card with Profile Overview */}
        <div className={styles.headerCard}>
          <div className={styles.userProfileGroup}>
            <div className={styles.avatar}>
              {currentHod.name?.charAt(0).toUpperCase() || 'H'}
            </div>
            <div className={styles.nameGroup}>
              <h2 className={styles.userName}>{currentHod.name}</h2>
              <div className={styles.badges}>
                <span className={styles.roleBadge}>HOD</span>
                <span
                  className={`${styles.statusBadge} ${
                    currentHod.isActive !== false
                      ? styles.statusActive
                      : styles.statusInactive
                  }`}
                >
                  {currentHod.isActive !== false ? '● Active' : '○ Inactive'}
                </span>
              </div>
            </div>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(currentHod);
            }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Edit2 size={14} />
            Edit Profile
          </Button>
        </div>

        {/* Quick Metrics */}
        <div className={styles.statsStrip}>
          <div className={styles.statBox}>
            <span className={styles.statVal}>
              {currentHod.facultyCount ?? (hod.facultyCount || 0)}
            </span>
            <span className={styles.statLabel}>Department Faculty</span>
          </div>

          <div className={styles.statBox}>
            <span className={styles.statVal} style={{ color: 'var(--color-success)' }}>
              {dept?.code || 'N/A'}
            </span>
            <span className={styles.statLabel}>Department Code</span>
          </div>

          <div className={styles.statBox}>
            <span className={styles.statVal} style={{ fontSize: '1rem', color: 'var(--color-text)' }}>
              {createdDate}
            </span>
            <span className={styles.statLabel}>Appointed Date</span>
          </div>
        </div>

        {/* Info Grid */}
        <div className={styles.infoGrid}>
          {/* Department Information */}
          <div className={styles.infoCard}>
            <h3 className={styles.cardTitle}>Academic Department</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>
                <Building2 size={15} />
                Department
              </span>
              <span className={styles.detailValue}>
                {dept ? (
                  <span className={styles.deptBadge}>
                    <span className={styles.deptCodeTag}>{dept.code}</span>
                    {dept.name}
                  </span>
                ) : (
                  <span style={{ color: 'var(--color-danger)' }}>Unassigned</span>
                )}
              </span>
            </div>
            {dept?.code && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>
                  <Layers size={15} />
                  Identifier
                </span>
                <span className={styles.detailValue}>Code: {dept.code}</span>
              </div>
            )}
          </div>

          {/* Contact Details */}
          <div className={styles.infoCard}>
            <h3 className={styles.cardTitle}>Contact Details</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>
                <Mail size={15} />
                Email Address
              </span>
              <span className={styles.detailValue}>
                <a
                  href={`mailto:${currentHod.email}`}
                  className={styles.detailLink}
                >
                  {currentHod.email}
                  <ExternalLink size={12} />
                </a>
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>
                <Phone size={15} />
                Contact Phone
              </span>
              <span className={styles.detailValue}>
                {currentHod.phone ? (
                  <span>{currentHod.phone}</span>
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>Not configured</span>
                )}
              </span>
            </div>

            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>
                <Calendar size={15} />
                Registered Since
              </span>
              <span className={styles.detailValue}>{createdDate}</span>
            </div>
          </div>
        </div>

        <div className={styles.actions}>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              onClose();
              if (onEdit) onEdit(currentHod);
            }}
          >
            Edit HOD Details
          </Button>
        </div>
      </div>
    </Modal>
  );
}
