import { useState } from 'react';
import { useCreateNoticeMutation, useListMyNoticesQuery } from '../../api/noticeApi';
import { Button } from '../ui/Button';
import { useToast } from '../ui/ToastContext';
import styles from './CcNoticesTab.module.css';

export function CcNoticesTab() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const { showToast } = useToast();

  const [createNotice, { isLoading: isSubmitting }] = useCreateNoticeMutation();
  const { data: noticesData, isLoading: isLoadingNotices } = useListMyNoticesQuery();
  const notices = noticesData?.data || [];

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      // Targeting is clamped server-side for CC roles
      await createNotice({ title, body }).unwrap();
      showToast('Section notice published successfully', 'success');
      setTitle('');
      setBody('');
    } catch (err) {
      showToast(err?.data?.message || 'Failed to publish notice', 'error');
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.composer} onSubmit={handleSubmit}>
        <div className={styles.header}>
          <h3>Post New Section Notice</h3>
          <p>This notice will be visible only to students in your assigned section.</p>
        </div>

        <div className={styles.field}>
          <label htmlFor="title">Notice Title</label>
          <input
            id="title"
            required
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isSubmitting}
            placeholder="e.g. Guest Lecture Tommorow at 10 AM"
          />
        </div>

        <div className={styles.field}>
          <label htmlFor="body">Notice Content</label>
          <textarea
            id="body"
            required
            className={styles.textarea}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isSubmitting}
            placeholder="Provide all details here..."
            rows={5}
          />
        </div>

        <div className={styles.actions}>
          <Button type="submit" variant="primary" disabled={isSubmitting || !title || !body}>
            {isSubmitting ? 'Publishing...' : 'Publish Notice'}
          </Button>
        </div>
      </form>

      <div className={styles.recentNotices}>
        <h4>Recent Notices</h4>
        {isLoadingNotices ? (
          <p className={styles.mutedText}>Loading notices...</p>
        ) : notices.length === 0 ? (
          <p className={styles.mutedText}>No notices published yet.</p>
        ) : (
          <div className={styles.noticesList}>
            {notices.map((notice) => (
              <div key={notice._id} className={styles.noticeCard}>
                <div className={styles.noticeHeader}>
                  <h5>{notice.title}</h5>
                  <span className={styles.noticeDate}>
                    {new Date(notice.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className={styles.noticeBody}>{notice.body}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
