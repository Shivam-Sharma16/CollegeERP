import { useState, useRef } from 'react';
import { useAuth } from '../hooks/useAuth';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { FadeIn } from '../components/ui/FadeIn';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { useToast } from '../components/ui/ToastContext';
import { useUploadNoteMutation, useListMyNotesQuery } from '../api/noticeApi';
import { useGetFacultyLoadQuery } from '../api/teachingApi';
import { UploadCloud, FileText, Download, Trash2, AlertCircle, RefreshCw } from 'lucide-react';
import styles from './FacultyNotesPage.module.css';

export default function FacultyNotesPage() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const { data: loadData, isLoading: isLoadingLoad } = useGetFacultyLoadQuery(user?._id, { skip: !user?._id });
  const facultyLoad = loadData?.data || { subjects: [], sections: [] };

  const { data: notesData, isLoading: isLoadingNotes } = useListMyNotesQuery();
  const notes = notesData?.data || [];

  const [uploadNote] = useUploadNoteMutation();

  // Form State
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [sectionId, setSectionId] = useState('');
  
  // File State
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  
  // Upload Progress State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      setUploadError(null);
      setUploadProgress(0);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
      setUploadProgress(0);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setUploadProgress(0);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const simulateUploadAndSubmit = async () => {
    if (!title || !subjectId || !selectedFile) {
      showToast('Please provide a title, select a subject, and choose a file.', 'error');
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(0);

    try {
      // 1. Simulate File Upload Progress (Mocking cloud storage upload)
      await new Promise((resolve, reject) => {
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.floor(Math.random() * 20) + 10;
          if (progress > 90) progress = 90;
          setUploadProgress(progress);
          
          // Random 5% chance of failure for demonstration
          if (Math.random() < 0.05) {
            clearInterval(interval);
            reject(new Error('Network error during file transfer'));
          }
        }, 500);

        setTimeout(() => {
          clearInterval(interval);
          setUploadProgress(100);
          resolve('https://storage.college.edu/notes/mock-file.pdf');
        }, 3000);
      });

      // 2. Submit to our API
      const fakeFileUrl = `https://storage.college.edu/notes/${selectedFile.name.replace(/\s+/g, '-')}`;
      
      const payload = {
        title,
        fileUrl: fakeFileUrl,
        subjectId,
        targeting: {
          sections: sectionId ? [sectionId] : []
        }
      };

      await uploadNote(payload).unwrap();
      showToast('Note uploaded successfully!', 'success');
      
      // Reset form
      setTitle('');
      setSubjectId('');
      setSectionId('');
      clearFile();

    } catch (err) {
      setUploadError(err.message || 'Failed to upload note');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <DashboardShell title="Notes Management" subtitle="Share study materials" icon="📚">
      <div className={styles.container}>
        
        {/* Upload Section */}
        <section className={styles.uploadSection}>
          <div className={styles.formPanel}>
            <h3>Upload New Note</h3>
            
            <div className={styles.field}>
              <label>Title</label>
              <input 
                type="text" 
                placeholder="e.g. Chapter 1: Introduction to Data Structures"
                value={title}
                onChange={e => setTitle(e.target.value)}
                disabled={isUploading}
              />
            </div>

            <div className={styles.row}>
              <div className={styles.field}>
                <label>Subject</label>
                <select 
                  value={subjectId} 
                  onChange={e => setSubjectId(e.target.value)}
                  disabled={isUploading || isLoadingLoad}
                >
                  <option value="">-- Select Subject --</option>
                  {facultyLoad.subjects.map(s => (
                    <option key={s._id || s} value={s._id || s}>
                      {s.name || s.code || `Subject ${s}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>Target Section (Optional)</label>
                <select 
                  value={sectionId} 
                  onChange={e => setSectionId(e.target.value)}
                  disabled={isUploading || isLoadingLoad}
                >
                  <option value="">All My Sections</option>
                  {facultyLoad.sections.map(s => (
                    <option key={s._id || s} value={s._id || s}>
                      {s.name || `Section ${s}`}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Drag & Drop Area */}
            <div 
              className={`${styles.dropZone} ${isDragging ? styles.dragging : ''} ${selectedFile ? styles.hasFile : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !selectedFile && fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={handleFileChange}
                disabled={isUploading}
              />
              
              {!selectedFile ? (
                <>
                  <UploadCloud size={32} className={styles.uploadIcon} />
                  <p>Drag and drop your file here, or click to browse</p>
                  <span className={styles.fileHint}>Supports PDF, PPTX, DOCX up to 50MB</span>
                </>
              ) : (
                <div className={styles.fileInfo}>
                  <FileText size={24} className={styles.fileIcon} />
                  <div className={styles.fileDetails}>
                    <span className={styles.fileName}>{selectedFile.name}</span>
                    <span className={styles.fileSize}>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  {!isUploading && (
                    <button type="button" className={styles.removeBtn} onClick={(e) => { e.stopPropagation(); clearFile(); }}>
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Progress / Error State */}
            {isUploading && (
              <div className={styles.progressContainer}>
                <div className={styles.progressHeader}>
                  <span>Uploading {selectedFile?.name}...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }}></div>
                </div>
              </div>
            )}

            {uploadError && (
              <div className={styles.errorState}>
                <AlertCircle size={20} />
                <span>{uploadError}</span>
                <Button 
                  variant="outline" 
                  size="small" 
                  onClick={simulateUploadAndSubmit}
                >
                  <RefreshCw size={14} style={{ marginRight: '6px' }}/> Retry
                </Button>
              </div>
            )}

            <div className={styles.actions}>
              <Button 
                variant="primary" 
                onClick={simulateUploadAndSubmit}
                disabled={isUploading || !selectedFile || !title || !subjectId}
              >
                {isUploading ? 'Uploading...' : 'Publish Note'}
              </Button>
            </div>
          </div>
        </section>

        {/* Uploaded Notes List */}
        <section className={styles.listSection}>
          <h3>My Uploaded Notes</h3>
          
          <FadeIn
            show={!isLoadingNotes}
            skeleton={<><Skeleton height="100px" style={{ marginBottom: '8px', borderRadius: '12px' }} /><Skeleton height="100px" style={{ borderRadius: '12px' }} /></>}
          >
            {notes.length === 0 ? (
              <EmptyState
                icon="document"
                title="No notes uploaded yet"
                description="Upload your first note above to share materials with students."
              />
            ) : (
              <StaggerList className={styles.notesGrid}>
                {notes.map(note => (
                  <StaggerItem key={note._id}>
                    <div className={styles.noteCard}>
                      <div className={styles.noteHeader}>
                        <FileText size={20} className={styles.noteIcon} />
                        <h4 title={note.title}>{note.title}</h4>
                      </div>
                      <div className={styles.noteMeta}>
                        <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.noteActions}>
                        <Button variant="ghost" size="small" onClick={() => showToast('Download started', 'info')}>
                          <Download size={16} /> Download
                        </Button>
                        <Button variant="ghost" size="small" className={styles.deleteBtn} onClick={() => showToast('Delete not implemented', 'warning')}>
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </StaggerItem>
                ))}
              </StaggerList>
            )}
          </FadeIn>
        </section>
        
      </div>
    </DashboardShell>
  );
}
