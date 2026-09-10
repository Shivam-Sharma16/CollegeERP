import { useState, useRef } from 'react';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { useUpdateOwnProfileMutation } from '../api/usersApi';
import { setCredentials } from '../features/ui/authSlice';
import { useToast } from '../components/ui/ToastContext';
import { Camera, Save, User as UserIcon } from 'lucide-react';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, token } = useAuth();
  const dispatch = useDispatch();
  const toast = useToast();
  
  const [updateProfile, { isLoading }] = useUpdateOwnProfileMutation();
  
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null);
  
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Create a local object URL for preview
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      const payload = { name, email };
      // In a real app, we would upload the image to S3/Cloudinary first
      // Here we just use the preview URL or a placeholder if a file was selected.
      if (avatarPreview && avatarPreview.startsWith('blob:')) {
        // mock a hosted url
        payload.avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${name}`;
      }
      
      const res = await updateProfile(payload).unwrap();
      
      // Update local Redux state so the UI reflects the new name instantly
      if (res.data) {
        dispatch(setCredentials({
          user: { ...user, name: res.data.name, email: res.data.email, avatarUrl: res.data.avatarUrl || avatarPreview },
          token
        }));
      }
      
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.data?.message || 'Failed to update profile');
    }
  };

  return (
    <DashboardShell title="My Profile" subtitle="Manage your personal details" icon="👤">
      <PageTransition>
      <div className={styles.container}>
        <div className={styles.profileCard}>
          <div className={styles.avatarSection}>
            <div className={styles.avatarWrapper}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className={styles.avatarImage} />
              ) : (
                <div className={styles.avatarPlaceholder}>
                  {user?.name?.[0]?.toUpperCase() || <UserIcon size={40} />}
                </div>
              )}
              <button 
                className={styles.uploadBtn} 
                onClick={() => fileInputRef.current?.click()}
                title="Change Avatar"
              >
                <Camera size={16} />
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className={styles.hiddenInput} 
                accept="image/*"
                onChange={handleFileChange}
              />
            </div>
            <div className={styles.roleBadges}>
              {user?.roles?.map(role => (
                <span key={role} className={styles.badge}>{role}</span>
              ))}
            </div>
            <p className={styles.unmodifiableText}>
              Roles and department assignments are managed by administrators.
            </p>
          </div>

          <form className={styles.formSection} onSubmit={handleSave}>
            <StaggerList>
              <StaggerItem>
                <div className={styles.formGroup}>
                  <label>Full Name</label>
                  <input 
                    type="text" 
                    value={name} 
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={styles.input}
                  />
                </div>
              </StaggerItem>
              
              <StaggerItem>
                <div className={styles.formGroup}>
                  <label>Email Address</label>
                  <input 
                    type="email" 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={styles.input}
                  />
                </div>
              </StaggerItem>

              <StaggerItem>
                <div className={styles.formActions}>
                  <button type="submit" className={styles.saveBtn} disabled={isLoading}>
                    <Save size={18} />
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </StaggerItem>
            </StaggerList>
          </form>
        </div>
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
