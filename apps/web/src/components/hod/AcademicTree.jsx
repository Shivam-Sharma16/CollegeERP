import { useState } from 'react';
import { ChevronRight, ChevronDown, Plus, Folder, FolderOpen, Layers, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { CreateSectionModal } from './CreateSectionModal';
import { ManageBatchesModal } from './ManageBatchesModal';
import styles from './AcademicTree.module.css';

function TreeItem({ label, icon, isOpen, onToggle, children, actions }) {
  return (
    <div className={styles.treeItem}>
      <div className={styles.itemHeader} onClick={onToggle}>
        <div className={styles.toggleIcon}>
          {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className={styles.labelIcon}>
          {icon}
        </div>
        <span className={styles.labelText}>{label}</span>
        {actions && <div className={styles.actions} onClick={e => e.stopPropagation()}>{actions}</div>}
      </div>
      {isOpen && (
        <div className={styles.children}>
          {children}
        </div>
      )}
    </div>
  );
}

export function AcademicTree({ department }) {
  const [openNodes, setOpenNodes] = useState({});
  const [activeSemester, setActiveSemester] = useState(null);
  const [isSectionModalOpen, setIsSectionModalOpen] = useState(false);
  const [activeSectionForBatches, setActiveSectionForBatches] = useState(null);

  const toggleNode = (nodeId) => {
    setOpenNodes(prev => ({ ...prev, [nodeId]: !prev[nodeId] }));
  };

  const handleAddSection = (semester) => {
    setActiveSemester(semester);
    setIsSectionModalOpen(true);
  };

  if (!department || !department.years) {
    return <div className={styles.empty}>No academic structure defined.</div>;
  }

  return (
    <div className={styles.tree}>
      {department.years.map(year => {
        const yearId = `year-${year._id || year.year}`;
        const isYearOpen = !!openNodes[yearId];

        return (
          <TreeItem
            key={yearId}
            label={`Year ${year.year}`}
            icon={isYearOpen ? <FolderOpen size={18} color="var(--color-primary)" /> : <Folder size={18} color="var(--color-text-muted)" />}
            isOpen={isYearOpen}
            onToggle={() => toggleNode(yearId)}
          >
            {year.semesters?.map(sem => {
              const semId = `sem-${sem._id || sem.semester}`;
              const isSemOpen = !!openNodes[semId];

              return (
                <TreeItem
                  key={semId}
                  label={`Semester ${sem.semester}`}
                  icon={isSemOpen ? <FolderOpen size={18} color="var(--color-secondary)" /> : <Folder size={18} color="var(--color-text-muted)" />}
                  isOpen={isSemOpen}
                  onToggle={() => toggleNode(semId)}
                  actions={
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className={styles.addBtn}
                      onClick={() => handleAddSection(sem)}
                      title="Add Section"
                    >
                      <Plus size={14} /> Add Section
                    </Button>
                  }
                >
                  {sem.sections?.length > 0 ? (
                    sem.sections.map(sec => (
                      <div key={sec._id} className={styles.leafNode}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                          <Layers size={16} color="var(--color-text-muted)" />
                          <span>Section {sec.name}</span>
                          <span className={styles.capacity}>(Cap: {sec.capacity})</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveSectionForBatches(sec);
                          }}
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem', height: 'auto' }}
                          title="Manage Lab Batches"
                        >
                          <Users size={12} /> Batches
                        </Button>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyLeaf}>No sections defined.</div>
                  )}
                </TreeItem>
              );
            })}
          </TreeItem>
        );
      })}

      {activeSemester && (
        <CreateSectionModal
          isOpen={isSectionModalOpen}
          onClose={() => {
            setIsSectionModalOpen(false);
            setActiveSemester(null);
          }}
          semester={activeSemester}
          departmentId={department._id}
        />
      )}

      {activeSectionForBatches && (
        <ManageBatchesModal
          isOpen={Boolean(activeSectionForBatches)}
          onClose={() => setActiveSectionForBatches(null)}
          section={activeSectionForBatches}
          departmentId={department._id}
        />
      )}
    </div>
  );
}
