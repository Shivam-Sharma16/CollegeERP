import { useState, useRef, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { useUpdateOwnProfileMutation, useGetOwnProfileQuery } from '../api/usersApi';
import { setCredentials } from '../features/ui/authSlice';
import { useToast } from '../components/ui/ToastContext';
import { PageTransition } from '../components/ui/PageTransition';
import { uploadToImageKit } from '../utils/imagekit';
import {
  Camera,
  Save,
  User as UserIcon,
  Mail,
  Shield,
  ShieldCheck,
  Lock,
  Building,
  Sparkles,
  Loader2,
  Layers,
  Settings,
  ArrowRight,
  LayoutDashboard,
  CheckCircle2,
  Users,
} from 'lucide-react';
import styles from './ProfilePage.module.css';

export default function ProfilePage() {
  const { user, token } = useAuth();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [updateProfile, { isLoading: isUpdating }] = useUpdateOwnProfileMutation();
  const { data: profileRes } = useGetOwnProfileQuery(undefined, { skip: !user });
  const profileData = profileRes?.data || profileRes;

  const userRoles = useMemo(() => {
    if (Array.isArray(user?.roles) && user.roles.length > 0) return user.roles;
    if (user?.role) return [user.role];
    return ['USER'];
  }, [user]);

  const isSuperAdmin = useMemo(() => {
    return userRoles.includes('SUPERADMIN') || userRoles.includes('superadmin');
  }, [userRoles]);

  const isAdmin = useMemo(() => {
    return userRoles.includes('ADMIN') || userRoles.includes('admin');
  }, [userRoles]);

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatarUrl || null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const fileInputRef = useRef(null);

  // Sync state if profileData or user changes and user has not typed in form
  useEffect(() => {
    const freshName = profileData?.name || user?.name;
    const freshEmail = profileData?.email || user?.email;
    const freshAvatar = profileData?.avatarUrl || user?.avatarUrl;

    if (freshName && !selectedFile && !name) setName(freshName);
    if (freshEmail && !selectedFile && !email) setEmail(freshEmail);
    if (freshAvatar && !selectedFile) setAvatarPreview(freshAvatar);
  }, [profileData, user, selectedFile]);

  // Compute if form has modified fields
  const isDirty = useMemo(() => {
    if (selectedFile) return true;
    if (isSuperAdmin) {
      return (
        name.trim() !== (user?.name || '').trim() ||
        email.trim().toLowerCase() !== (user?.email || '').trim().toLowerCase()
      );
    }
    return false;
  }, [selectedFile, isSuperAdmin, name, email, user]);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setAvatarPreview(url);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();

    if (isSuperAdmin) {
      if (!name.trim()) {
        showToast('Name cannot be empty.', 'error');
        return;
      }
      if (!email.trim() || !email.includes('@')) {
        showToast('Please enter a valid email address.', 'error');
        return;
      }
    }

    try {
      setIsUploadingAvatar(true);
      const payload = {};

      if (isSuperAdmin) {
        payload.name = name.trim();
        payload.email = email.trim().toLowerCase();
      }

      // Upload avatar to ImageKit if a new file was chosen
      if (selectedFile) {
        try {
          const uploadRes = await uploadToImageKit(selectedFile, '/avatars');
          payload.avatarUrl = uploadRes.url;
        } catch (uploadErr) {
          console.warn('ImageKit direct upload failed, fallback to dicebear:', uploadErr);
          payload.avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(
            name || user?.name || 'User'
          )}`;
        }
      }

      const res = await updateProfile(payload).unwrap();

      const updatedUser = res?.data || res;
      if (updatedUser) {
        const freshAvatar = updatedUser.avatarUrl || payload.avatarUrl || avatarPreview;
        dispatch(
          setCredentials({
            user: {
              ...user,
              name: updatedUser.name || user?.name,
              email: updatedUser.email || user?.email,
              avatarUrl: freshAvatar,
            },
            token,
          })
        );
        setAvatarPreview(freshAvatar);
      }

      setSelectedFile(null);
      showToast('Profile updated successfully.', 'success');
    } catch (err) {
      showToast(err?.data?.error || err?.data?.message || 'Failed to update profile.', 'error');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Role-based quick shortcuts
  const shortcuts = useMemo(() => {
    if (isSuperAdmin) {
      return [
        {
          title: 'Fleet Telemetry',
          desc: 'Monitor multi-tenant campus statistics and global fleet health',
          path: '/superadmin/dashboard',
          icon: <LayoutDashboard size={18} />,
        },
        {
          title: 'Fleet Management',
          desc: 'Manage college institutions, admins, and department structures',
          path: '/superadmin/institutions',
          icon: <Layers size={18} />,
        },
        {
          title: 'Whitelabel Settings',
          desc: 'Configure brand colors, logos, and portal theme preferences',
          path: '/superadmin/settings',
          icon: <Settings size={18} />,
        },
      ];
    }
    if (isAdmin) {
      return [
        {
          title: 'Campus Dashboard',
          desc: 'View institutional attendance, department roster, and notifications',
          path: '/admin/dashboard',
          icon: <LayoutDashboard size={18} />,
        },
        {
          title: 'Department Heads (HODs)',
          desc: 'Manage HOD assignments and department oversight',
          path: '/admin/hods',
          icon: <Users size={18} />,
        },
        {
          title: 'Institutional Settings',
          desc: 'Manage campus whitelabel branding and theme palettes',
          path: '/admin/settings',
          icon: <Settings size={18} />,
        },
      ];
    }
    return [
      {
        title: 'Workspace Dashboard',
        desc: 'Return to your active workspace and academic dashboard',
        path: '/',
        icon: <LayoutDashboard size={18} />,
      },
    ];
  }, [isSuperAdmin, isAdmin]);

  const primaryInitial = (name || user?.name || 'U')[0].toUpperCase();

  return (
    <DashboardShell
      title="User Profile"
      subtitle="Identity credentials, authority tier, and workspace shortcuts"
      icon="👤"
    >
      <PageTransition>
        <div className={styles.pageContainer}>
          {/* ── Profile Hero Header ────────────────────────────────────────── */}
          <div className={styles.heroCard}>
            <div className={styles.heroCover}>
              <div className={styles.heroCoverPattern} />
            </div>

            <div className={styles.heroBody}>
              {/* Avatar Circle with Upload Trigger */}
              <div className={styles.avatarContainer}>
                <div className={styles.avatarRing}>
                  {avatarPreview ? (
                    <img src={avatarPreview} alt={name || 'Avatar'} className={styles.avatarImg} />
                  ) : (
                    <div className={styles.avatarFallback}>{primaryInitial}</div>
                  )}

                  <div
                    className={`${styles.avatarUploadOverlay} ${
                      isUploadingAvatar ? styles.isUploading : ''
                    }`}
                    onClick={() => fileInputRef.current?.click()}
                    title="Click to change profile avatar"
                  >
                    {isUploadingAvatar ? (
                      <Loader2 size={22} className="animate-spin" />
                    ) : (
                      <>
                        <Camera size={18} />
                        <span style={{ fontSize: '0.65rem', marginTop: '2px' }}>Change</span>
                      </>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className={styles.avatarUploadBtn}
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload profile picture"
                  aria-label="Upload profile picture"
                >
                  <Camera size={15} />
                </button>

                <input
                  type="file"
                  ref={fileInputRef}
                  className={styles.hiddenInput}
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {/* Profile Details & Roles */}
              <div className={styles.heroProfileInfo}>
                <div className={styles.profileTitleRow}>
                  <h1 className={styles.profileName}>{name || user?.name || 'System User'}</h1>
                  <span className={styles.statusPill}>
                    <span className={styles.statusDot} /> Active Account
                  </span>
                </div>

                <div className={styles.profileEmail}>
                  <Mail size={14} />
                  <span>{email || user?.email || 'N/A'}</span>
                </div>

                <div className={styles.roleBadgeList}>
                  {userRoles.map((role) => (
                    <span key={role} className={styles.rolePill}>
                      <Shield size={12} /> {role}
                    </span>
                  ))}
                  {isSuperAdmin && (
                    <span
                      className={styles.rolePill}
                      style={{
                        background: 'color-mix(in srgb, #7c3aed 15%, transparent)',
                        color: '#a78bfa',
                        borderColor: 'color-mix(in srgb, #7c3aed 30%, transparent)',
                      }}
                    >
                      <Sparkles size={12} /> Root Platform Authority
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Institutional Scope Overview ───────────────────────────────── */}
          <div className={styles.scopeGrid}>
            <div className={styles.scopeItem}>
              <span className={styles.scopeItemTitle}>
                <ShieldCheck size={14} /> Authority Level
              </span>
              <span className={styles.scopeItemVal}>
                {isSuperAdmin ? 'Global Infrastructure SuperAdmin' : userRoles.join(', ')}
              </span>
            </div>

            <div className={styles.scopeItem}>
              <span className={styles.scopeItemTitle}>
                <Building size={14} /> Institutional Scope
              </span>
              <span className={styles.scopeItemVal}>
                {isSuperAdmin ? 'Multi-Tenant Platform Fleet' : 'Designated College Campus'}
              </span>
            </div>

            <div className={styles.scopeItem}>
              <span className={styles.scopeItemTitle}>
                <CheckCircle2 size={14} /> Verification Status
              </span>
              <span className={styles.scopeItemVal} style={{ color: 'var(--color-success)' }}>
                Active & Verified Session
              </span>
            </div>
          </div>

          {/* ── Identity Form Card ─────────────────────────────────────────── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleWrap}>
                <UserIcon size={18} className={styles.cardIcon} />
                <div>
                  <h2 className={styles.cardTitle}>Identity & Contact Details</h2>
                  <p className={styles.cardSubtitle}>
                    {isSuperAdmin
                      ? 'SuperAdmin credentials can be modified directly'
                      : 'Official credentials managed by your institution administration'}
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSave}>
              <div className={styles.formGrid}>
                {/* Full Name */}
                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="profile-name-input">
                      Full Legal Name
                    </label>
                    {!isSuperAdmin && (
                      <span className={styles.lockedTag}>
                        <Lock size={11} /> Locked by hierarchy
                      </span>
                    )}
                  </div>
                  <div className={styles.inputWrapper}>
                    <UserIcon size={16} className={styles.inputIcon} />
                    <input
                      id="profile-name-input"
                      type="text"
                      className={styles.inputField}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={!isSuperAdmin}
                      required
                    />
                  </div>
                  <span className={styles.fieldCaption}>
                    {!isSuperAdmin ? (
                      <>
                        <Lock size={11} /> Maintained in official records by administration
                      </>
                    ) : (
                      <>
                        <Sparkles size={11} /> Platform SuperAdmin legal display name
                      </>
                    )}
                  </span>
                </div>

                {/* Email Address */}
                <div className={styles.formGroup}>
                  <div className={styles.labelRow}>
                    <label className={styles.label} htmlFor="profile-email-input">
                      Official Institutional Email
                    </label>
                    {!isSuperAdmin && (
                      <span className={styles.lockedTag}>
                        <Lock size={11} /> Locked by hierarchy
                      </span>
                    )}
                  </div>
                  <div className={styles.inputWrapper}>
                    <Mail size={16} className={styles.inputIcon} />
                    <input
                      id="profile-email-input"
                      type="email"
                      className={styles.inputField}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={!isSuperAdmin}
                      required
                    />
                  </div>
                  <span className={styles.fieldCaption}>
                    {!isSuperAdmin ? (
                      <>
                        <Lock size={11} /> Single sign-on & official communication account
                      </>
                    ) : (
                      <>
                        <Sparkles size={11} /> Root platform administrator login email
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Save Changes Button */}
              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.saveBtn}
                  disabled={!isDirty || isUpdating || isUploadingAvatar}
                >
                  {isUpdating || isUploadingAvatar ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* ── Quick Workspace Shortcuts ─────────────────────────────────── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardTitleWrap}>
                <Layers size={18} className={styles.cardIcon} />
                <div>
                  <h2 className={styles.cardTitle}>Authorized Workspace Shortcuts</h2>
                  <p className={styles.cardSubtitle}>
                    Direct access to your authorized consoles and management workflows
                  </p>
                </div>
              </div>
            </div>

            <div className={styles.shortcutsGrid}>
              {shortcuts.map((shortcut) => (
                <div
                  key={shortcut.path}
                  className={styles.shortcutCard}
                  onClick={() => navigate(shortcut.path)}
                >
                  <div className={styles.shortcutLeft}>
                    <div className={styles.shortcutIconWrap}>{shortcut.icon}</div>
                    <div className={styles.shortcutInfo}>
                      <h3 className={styles.shortcutTitle}>{shortcut.title}</h3>
                      <p className={styles.shortcutDesc}>{shortcut.desc}</p>
                    </div>
                  </div>
                  <ArrowRight size={16} className={styles.shortcutArrow} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </PageTransition>
    </DashboardShell>
  );
}
