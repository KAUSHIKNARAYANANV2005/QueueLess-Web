import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../firebase/config';
import useAuth from '../../hooks/useAuth';
import {
  User,
  Phone,
  Mail,
  Camera,
  Save,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ShieldCheck,
  CalendarDays,
} from 'lucide-react';

// ─── Skeleton ────────────────────────────────────────────────────────────────
const Skeleton = ({ style = {} }) => (
  <div className="cp-skeleton" style={style} />
);

// ─── CustomerProfile ─────────────────────────────────────────────────────────
const CustomerProfile = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const fileInputRef = useRef(null);

  // ── State
  const [profile, setProfile] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  const [name, setName]     = useState('');
  const [phone, setPhone]   = useState('');
  const [dirty, setDirty]   = useState(false);

  const [saving, setSaving]         = useState(false);
  const [formError, setFormError]   = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [imgError, setImgError]     = useState(false);

  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Real-time listener for users/{uid}
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.uid && currentUser.uid.startsWith('mock-')) {
      const data = {
        id: currentUser.uid,
        name: currentUser.displayName || currentUser.email.split('@')[0],
        email: currentUser.email,
        phone: '1234567890',
        role: currentUser.email.includes('customer') ? 'customer' : 'business',
        profileImage: null,
        walletBalance: 100.0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setProfile(data);
      setName(data.name);
      setPhone(data.phone);
      setError(null);
      setLoading(false);
      return () => {};
    }

    const docRef = doc(db, 'users', currentUser.uid);
    const unsub = onSnapshot(
      docRef,
      (snap) => {
        if (snap.exists()) {
          const data = { id: snap.id, ...snap.data() };
          setProfile(data);
          // Only seed form fields on first load, not on every snapshot
          setName((prev) => (prev === '' ? data.name || '' : prev));
          setPhone((prev) => (prev === '' ? data.phone || '' : prev));
          setError(null);
        } else {
          setError('User profile not found.');
        }
        setLoading(false);
      },
      (err) => {
        console.error('CustomerProfile: listener error', err);
        setError('Failed to load your profile.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [currentUser]);

  // Track form dirtiness
  useEffect(() => {
    if (!profile) return;
    const nameChanged  = name  !== (profile.name  || '');
    const phoneChanged = phone !== (profile.phone || '');
    setDirty(nameChanged || phoneChanged);
  }, [name, phone, profile]);

  useEffect(() => {
    setImgError(false);
  }, [profile?.profileImage, profile?.photoURL]);

  // ── Avatar Upload
  const handleAvatarClick = () => fileInputRef.current?.click();

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Please select a valid image file.', 'error');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Image must be under 3 MB.', 'error');
      return;
    }

    setAvatarUploading(true);
    try {
      const storageRef = ref(storage, `users/${currentUser.uid}/avatar.jpg`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      await updateDoc(doc(db, 'users', currentUser.uid), {
        photoURL: downloadURL,
        profileImage: downloadURL,
        updatedAt: serverTimestamp(),
      });
      showToast('Avatar updated successfully!');
    } catch (err) {
      console.error('CustomerProfile: avatar upload failed', err);
      showToast(`Upload failed: ${err.message || 'Server error'}`, 'error');
    } finally {
      setAvatarUploading(false);
      // Reset input so the same file can be picked again
      e.target.value = '';
    }
  };

  // ── Save Profile
  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    const trimmedName  = name.trim();
    const trimmedPhone = phone.trim().replace(/\s+/g, '');

    if (!trimmedName) {
      setFormError('Name is required.');
      return;
    }
    if (trimmedPhone && !/^\d{10}$/.test(trimmedPhone)) {
      setFormError('Phone must be a valid 10-digit number.');
      return;
    }

    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: trimmedName,
        phone: trimmedPhone || '',
        updatedAt: serverTimestamp(),
      });
      setDirty(false);
      showToast('Profile saved successfully!');
    } catch (err) {
      console.error('CustomerProfile: save failed', err);
      setFormError(err.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  // ── Discard changes
  const handleDiscard = () => {
    if (!profile) return;
    setName(profile.name || '');
    setPhone(profile.phone || '');
    setFormError('');
    setDirty(false);
  };

  // ── Format dates
  const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
  };

  // ─── Loading
  if (loading) {
    return (
      <div className="cp-wrapper animate-fade-in">
        <div className="cp-header">
          <Skeleton style={{ width: 80, height: 14, borderRadius: 4 }} />
          <Skeleton style={{ width: 220, height: 34, marginTop: 10 }} />
        </div>
        <div className="cp-layout">
          <div className="glass-panel cp-card cp-avatar-card">
            <Skeleton style={{ width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px' }} />
            <Skeleton style={{ width: '60%', height: 18, margin: '0 auto 8px' }} />
            <Skeleton style={{ width: '40%', height: 14, margin: '0 auto' }} />
          </div>
          <div className="glass-panel cp-card cp-form-card">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} style={{ height: 46, marginBottom: 16, borderRadius: 6 }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Error
  if (error) {
    return (
      <div className="cp-state-center glass-panel animate-fade-in">
        <AlertTriangle size={44} className="cp-icon-warn" />
        <h2>Profile Error</h2>
        <p>{error}</p>
        <button className="btn-primary cp-state-btn" onClick={() => window.location.reload()}>
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  const avatarSrc = profile?.profileImage || profile?.photoURL || null;
  const initials = (profile?.name || currentUser?.email || 'U')[0].toUpperCase();

  return (
    <>
      {/* Toast */}
      {toast && (
        <div className={`cp-toast ${toast.type} animate-fade-in`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="cp-wrapper animate-fade-in">
        {/* Header */}
        <header className="cp-header">
          <button className="cp-back-btn" onClick={() => navigate('/home')}>
            <ArrowLeft size={15} /> Home
          </button>
          <span className="cp-eyebrow">
            <User size={13} /> Account
          </span>
          <h1 className="cp-title">My Profile</h1>
        </header>

        <div className="cp-layout">
          {/* Left: Avatar card */}
          <div className="cp-left-col">
            <section className="glass-panel cp-card cp-avatar-card">
              {/* Avatar + upload */}
              <div className="cp-avatar-wrap">
                <div
                  className="cp-avatar-circle"
                  onClick={handleAvatarClick}
                  title="Change profile photo"
                >
                  {avatarSrc && !imgError ? (
                    <img
                      src={avatarSrc}
                      alt="Profile avatar"
                      className="cp-avatar-img"
                      onError={() => setImgError(true)}
                    />
                  ) : (
                    <span className="cp-avatar-initials">{initials}</span>
                  )}

                  {/* Overlay */}
                  <div className="cp-avatar-overlay">
                    {avatarUploading
                      ? <Loader2 size={22} className="cp-spinner" />
                      : <Camera size={22} />}
                  </div>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleAvatarChange}
                  disabled={avatarUploading}
                />

                <p className="cp-avatar-hint">
                  {avatarUploading ? 'Uploading…' : 'Tap photo to change'}
                </p>
              </div>

              {/* Profile meta */}
              <div className="cp-profile-meta">
                <h2 className="cp-profile-name">{profile?.name || '—'}</h2>
                <p className="cp-profile-email">{currentUser?.email}</p>
              </div>

              {/* Role badge */}
              <div className="cp-role-badge">
                <ShieldCheck size={13} />
                <span>{profile?.role || 'customer'}</span>
              </div>

              {/* Account info */}
              <div className="cp-meta-list">
                <div className="cp-meta-item">
                  <span className="cp-meta-label">Member Since</span>
                  <span className="cp-meta-value">
                    <CalendarDays size={12} />
                    {formatDate(profile?.createdAt)}
                  </span>
                </div>
                <div className="cp-meta-item">
                  <span className="cp-meta-label">Last Updated</span>
                  <span className="cp-meta-value">
                    <CalendarDays size={12} />
                    {formatDate(profile?.updatedAt)}
                  </span>
                </div>
              </div>
            </section>

            {/* Quick links */}
            <section className="glass-panel cp-card cp-links-card">
              <h3 className="cp-links-title">Quick Links</h3>
              <button
                className="cp-quick-link"
                onClick={() => navigate('/appointments')}
              >
                <CalendarDays size={15} />
                <span>My Appointments</span>
                <span className="cp-link-arrow">→</span>
              </button>
              <button
                className="cp-quick-link"
                onClick={() => navigate('/queue')}
              >
                <User size={15} />
                <span>Active Queue</span>
                <span className="cp-link-arrow">→</span>
              </button>
            </section>
          </div>

          {/* Right: Edit form */}
          <div className="cp-right-col">
            <section className="glass-panel cp-card cp-form-card">
              <div className="cp-form-header">
                <User size={16} />
                <h2>Personal Information</h2>
              </div>

              {formError && (
                <div className="cp-form-error">
                  <AlertTriangle size={14} />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="cp-form">
                {/* Name */}
                <div className="cp-field">
                  <label htmlFor="cp-name">Full Name *</label>
                  <div className="cp-input-wrap">
                    <User size={14} className="cp-field-icon" />
                    <input
                      id="cp-name"
                      type="text"
                      placeholder="Your full name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Phone */}
                <div className="cp-field">
                  <label htmlFor="cp-phone">Phone Number</label>
                  <div className="cp-input-wrap">
                    <Phone size={14} className="cp-field-icon" />
                    <input
                      id="cp-phone"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <p className="cp-field-hint">Optional — used for booking notifications</p>
                </div>

                {/* Email (read-only) */}
                <div className="cp-field">
                  <label>Email Address</label>
                  <div className="cp-input-wrap cp-input-readonly">
                    <Mail size={14} className="cp-field-icon" />
                    <input
                      type="email"
                      value={currentUser?.email || ''}
                      readOnly
                      tabIndex={-1}
                    />
                    <span className="cp-readonly-badge">Read Only</span>
                  </div>
                  <p className="cp-field-hint">Email cannot be changed from this page.</p>
                </div>

                {/* Actions */}
                <div className="cp-form-actions">
                  <button
                    type="button"
                    className="cp-btn-discard"
                    onClick={handleDiscard}
                    disabled={!dirty || saving}
                  >
                    Discard
                  </button>
                  <button
                    type="submit"
                    className="btn-primary cp-btn-save"
                    disabled={!dirty || saving}
                  >
                    {saving ? <Loader2 size={14} className="cp-spinner" /> : <Save size={14} />}
                    <span>{saving ? 'Saving…' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </section>

            {/* Security card */}
            <section className="glass-panel cp-card cp-security-card">
              <div className="cp-form-header">
                <ShieldCheck size={16} />
                <h2>Account Security</h2>
              </div>
              <div className="cp-security-row">
                <div>
                  <p className="cp-security-label">Authentication Provider</p>
                  <p className="cp-security-value">
                    {currentUser?.providerData?.[0]?.providerId === 'google.com'
                      ? 'Google Sign-In'
                      : 'Email & Password'}
                  </p>
                </div>
                <div className="cp-security-badge">
                  <CheckCircle2 size={14} />
                  Verified
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/* ─── Scoped Styles ─────────────────────────────────────────────────── */}
      <style>{`
        /* Wrapper */
        .cp-wrapper {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 1000px;
          margin: 0 auto;
          padding-bottom: 60px;
        }

        /* Header */
        .cp-header {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .cp-back-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          color: var(--text-secondary);
          font-size: 0.82rem;
          font-weight: 600;
          cursor: pointer;
          padding: 0;
          align-self: flex-start;
          transition: color 0.2s;
        }
        .cp-back-btn:hover { color: var(--primary); }

        .cp-eyebrow {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--primary);
        }

        .cp-title {
          font-size: 1.9rem;
          font-weight: 800;
          color: var(--text-primary);
          margin: 0;
        }

        /* Layout */
        .cp-layout {
          display: grid;
          grid-template-columns: 300px 1fr;
          gap: 24px;
          align-items: start;
        }
        @media (max-width: 860px) {
          .cp-layout { grid-template-columns: 1fr; }
        }

        .cp-left-col, .cp-right-col {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .cp-card {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* Avatar card */
        .cp-avatar-card {
          align-items: center;
          text-align: center;
        }

        .cp-avatar-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
        }

        .cp-avatar-circle {
          width: 100px;
          height: 100px;
          border-radius: 50%;
          position: relative;
          cursor: pointer;
          overflow: hidden;
          background: rgba(108,99,255,0.12);
          border: 3px solid rgba(108,99,255,0.35);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: border-color 0.2s;
        }
        .cp-avatar-circle:hover { border-color: var(--primary); }

        .cp-avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .cp-avatar-initials {
          font-size: 2.8rem;
          font-weight: 800;
          color: var(--primary);
          line-height: 1;
        }

        .cp-avatar-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #fff;
          opacity: 0;
          transition: opacity 0.2s;
          backdrop-filter: blur(2px);
        }
        .cp-avatar-circle:hover .cp-avatar-overlay { opacity: 1; }

        .cp-avatar-hint {
          font-size: 0.74rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .cp-profile-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
        }
        .cp-profile-name {
          font-size: 1.15rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }
        .cp-profile-email {
          font-size: 0.82rem;
          color: var(--text-secondary);
          margin: 0;
        }

        .cp-role-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 12px;
          border-radius: 50px;
          background: rgba(108,99,255,0.1);
          border: 1px solid rgba(108,99,255,0.3);
          color: var(--primary);
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .cp-meta-list {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 8px;
          border-top: 1px solid var(--glass-border);
          padding-top: 14px;
        }
        .cp-meta-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          font-size: 0.78rem;
        }
        .cp-meta-label { color: var(--text-secondary); }
        .cp-meta-value {
          display: flex;
          align-items: center;
          gap: 4px;
          color: var(--text-primary);
          font-weight: 600;
        }

        /* Quick Links */
        .cp-links-card {}
        .cp-links-title {
          font-size: 0.85rem;
          font-weight: 700;
          color: var(--text-secondary);
          margin: 0;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .cp-quick-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          color: var(--text-primary);
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          width: 100%;
          text-align: left;
        }
        .cp-quick-link:hover {
          background: rgba(108,99,255,0.08);
          border-color: rgba(108,99,255,0.3);
          color: var(--primary);
        }
        .cp-link-arrow {
          margin-left: auto;
          color: var(--text-secondary);
          font-size: 0.9rem;
        }

        /* Form card */
        .cp-form-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--glass-border);
          color: var(--primary);
        }
        .cp-form-header h2 {
          font-size: 1.05rem;
          font-weight: 700;
          color: var(--text-primary);
          margin: 0;
        }

        .cp-form-error {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(239,83,80,0.08);
          border: 1px solid rgba(239,83,80,0.25);
          color: #EF5350;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 0.82rem;
          font-weight: 600;
        }

        .cp-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .cp-field {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }
        .cp-field label {
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--text-secondary);
        }

        .cp-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .cp-field-icon {
          position: absolute;
          left: 12px;
          color: var(--text-secondary);
          opacity: 0.7;
          pointer-events: none;
        }
        .cp-input-wrap input {
          width: 100%;
          padding: 10px 12px 10px 36px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--glass-border);
          border-radius: 6px;
          font-size: 0.88rem;
          color: var(--text-primary);
          outline: none;
          transition: border-color 0.2s;
        }
        .cp-input-wrap input:focus { border-color: rgba(108,99,255,0.45); }

        .cp-input-readonly input {
          color: var(--text-secondary);
          cursor: default;
          padding-right: 90px;
        }
        .cp-readonly-badge {
          position: absolute;
          right: 10px;
          font-size: 0.64rem;
          font-weight: 700;
          background: rgba(255,255,255,0.05);
          border: 1px solid var(--glass-border);
          border-radius: 4px;
          padding: 2px 7px;
          color: var(--text-secondary);
          pointer-events: none;
          text-transform: uppercase;
        }

        .cp-field-hint {
          font-size: 0.72rem;
          color: var(--text-secondary);
          margin: 0;
          line-height: 1.3;
          opacity: 0.8;
        }

        .cp-form-actions {
          display: flex;
          gap: 10px;
          padding-top: 4px;
        }
        .cp-btn-discard {
          flex: 1;
          padding: 10px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--glass-border);
          color: var(--text-secondary);
          cursor: pointer;
          transition: all 0.2s;
        }
        .cp-btn-discard:hover:not(:disabled) {
          background: rgba(255,255,255,0.08);
          color: var(--text-primary);
        }
        .cp-btn-discard:disabled { opacity: 0.4; cursor: not-allowed; }

        .cp-btn-save {
          flex: 1.2;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          padding: 10px;
          border-radius: 50px;
          font-size: 0.85rem;
          font-weight: 700;
        }
        .cp-btn-save:disabled { opacity: 0.45; cursor: not-allowed; }

        /* Security card */
        .cp-security-card {}
        .cp-security-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
        }
        .cp-security-label {
          font-size: 0.75rem;
          color: var(--text-secondary);
          margin: 0 0 4px;
        }
        .cp-security-value {
          font-size: 0.9rem;
          color: var(--text-primary);
          font-weight: 600;
          margin: 0;
        }
        .cp-security-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.74rem;
          font-weight: 700;
          padding: 4px 10px;
          border-radius: 50px;
          background: rgba(76,175,80,0.1);
          border: 1px solid rgba(76,175,80,0.3);
          color: #4CAF50;
          white-space: nowrap;
        }

        /* Toast */
        .cp-toast {
          position: fixed;
          top: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 18px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 600;
          z-index: 1100;
          box-shadow: 0 10px 25px rgba(0,0,0,0.3);
          animation: cp-slide-in 0.3s ease;
        }
        @keyframes cp-slide-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cp-toast.success {
          background: rgba(76,175,80,0.1);
          border: 1px solid rgba(76,175,80,0.35);
          color: #4CAF50;
          backdrop-filter: blur(8px);
        }
        .cp-toast.error {
          background: rgba(239,83,80,0.1);
          border: 1px solid rgba(239,83,80,0.35);
          color: #EF5350;
          backdrop-filter: blur(8px);
        }

        /* Error state */
        .cp-state-center {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 60px 32px;
          text-align: center;
          max-width: 460px;
          margin: 60px auto;
        }
        .cp-state-center h2 { font-size: 1.3rem; color: var(--text-primary); margin: 0; }
        .cp-state-center p  { color: var(--text-secondary); font-size: 0.88rem; margin: 0; }
        .cp-icon-warn { color: #FFC107; }
        .cp-state-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          border-radius: 50px;
          font-size: 0.9rem;
          margin-top: 8px;
        }

        /* Skeleton */
        .cp-skeleton {
          background: linear-gradient(
            90deg,
            rgba(255,255,255,0.04) 25%,
            rgba(255,255,255,0.09) 50%,
            rgba(255,255,255,0.04) 75%
          );
          background-size: 200% 100%;
          animation: cp-shimmer 1.4s ease-in-out infinite;
          border-radius: 4px;
          width: 100%;
          height: 14px;
        }
        @keyframes cp-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        .cp-spinner {
          animation: cp-spin 1s linear infinite;
        }
        @keyframes cp-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default CustomerProfile;
