import { useState, useMemo } from 'react';
import { DashboardShell } from '../components/DashboardShell';
import { Button } from '../components/ui/Button';
import { PageTransition } from '../components/ui/PageTransition';
import { StaggerList, StaggerItem } from '../components/ui/StaggerList';
import { useToast } from '../components/ui/ToastContext';
import { useCreateFeeStructureMutation } from '../api/feesApi';
import { useListDepartmentsQuery } from '../api/departmentsApi';
import { Plus, Trash2 } from 'lucide-react';
import styles from './AdminFeePolicy.module.css';

export default function AdminFeePolicy() {
  const { data: deptData, isLoading: isLoadingDepts } = useListDepartmentsQuery();
  const [createFeeStructure, { isLoading: isSubmitting }] = useCreateFeeStructureMutation();
  const { showToast } = useToast();

  const departments = deptData?.data || [];

  const [departmentId, setDepartmentId] = useState('');
  const [year, setYear] = useState('1');
  const [totalAmount, setTotalAmount] = useState('');
  
  const [installments, setInstallments] = useState([
    { amount: '', dueDate: '', isLateFeeApplicable: false }
  ]);

  const parsedTotal = parseFloat(totalAmount) || 0;

  const runningTotal = useMemo(() => {
    return installments.reduce((sum, inst) => sum + (parseFloat(inst.amount) || 0), 0);
  }, [installments]);

  const isMismatch = parsedTotal > 0 && runningTotal !== parsedTotal;
  const isOver = runningTotal > parsedTotal;
  const remaining = Math.max(0, parsedTotal - runningTotal);

  const handleAddInstallment = () => {
    setInstallments([...installments, { amount: remaining > 0 ? remaining : '', dueDate: '', isLateFeeApplicable: false }]);
  };

  const handleRemoveInstallment = (index) => {
    if (installments.length === 1) return;
    setInstallments(installments.filter((_, i) => i !== index));
  };

  const handleInstallmentChange = (index, field, value) => {
    const newInstallments = [...installments];
    newInstallments[index][field] = value;
    setInstallments(newInstallments);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isMismatch) return;

    try {
      const payload = {
        departmentId,
        year: parseInt(year, 10),
        totalAmount: parsedTotal,
        installments: installments.map(inst => ({
          amount: parseFloat(inst.amount),
          dueDate: inst.dueDate,
          isLateFeeApplicable: inst.isLateFeeApplicable
        }))
      };

      await createFeeStructure(payload).unwrap();
      showToast('Fee structure created successfully', 'success');
      
      // Reset form
      setDepartmentId('');
      setTotalAmount('');
      setInstallments([{ amount: '', dueDate: '', isLateFeeApplicable: false }]);
    } catch (err) {
      showToast(err?.data?.message || 'Failed to create fee structure', 'error');
    }
  };

  return (
    <DashboardShell title="Fee Policy" subtitle="Manage fee structures per department" icon="💳">
      <PageTransition>
      <div className={styles.container}>
        <form className={styles.card} onSubmit={handleSubmit}>
          <div className={styles.header}>
            <h2 className={styles.title}>Create Fee Structure</h2>
            <p className={styles.subtitle}>Define the total annual fee and installment breakdown.</p>
          </div>

          <div className={styles.grid2}>
            <div className={styles.field}>
              <label htmlFor="departmentId">Department</label>
              <select
                id="departmentId"
                required
                className={styles.input}
                value={departmentId}
                onChange={e => setDepartmentId(e.target.value)}
                disabled={isLoadingDepts || isSubmitting}
              >
                <option value="" disabled>Select Department</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>

            <div className={styles.field}>
              <label htmlFor="year">Academic Year</label>
              <select
                id="year"
                required
                className={styles.input}
                value={year}
                onChange={e => setYear(e.target.value)}
                disabled={isSubmitting}
              >
                {[1, 2, 3, 4, 5].map(y => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </div>
          </div>

          <div className={styles.field}>
            <label htmlFor="totalAmount">Total Annual Amount ($)</label>
            <input
              id="totalAmount"
              type="number"
              min="1"
              required
              className={styles.input}
              value={totalAmount}
              onChange={e => setTotalAmount(e.target.value)}
              disabled={isSubmitting}
              placeholder="e.g. 10000"
            />
          </div>

          <div className={styles.divider} />

          <div className={styles.installmentsSection}>
            <div className={styles.installmentsHeader}>
              <h3 className={styles.sectionTitle}>Installment Builder</h3>
              <Button type="button" variant="secondary" onClick={handleAddInstallment} disabled={isSubmitting}>
                <Plus size={16} /> Add Row
              </Button>
            </div>

            {parsedTotal > 0 && (
              <div className={`${styles.validationBar} ${isMismatch ? styles.invalidBar : styles.validBar}`}>
                <div className={styles.validationText}>
                  <strong>Target Total:</strong> ${parsedTotal.toLocaleString()}
                  <span className={styles.spacer}>|</span>
                  <strong>Allocated:</strong> ${runningTotal.toLocaleString()}
                  <span className={styles.spacer}>|</span>
                  <strong>Remaining:</strong> ${Math.abs(parsedTotal - runningTotal).toLocaleString()} {isOver ? '(Over)' : ''}
                </div>
                {isMismatch && (
                  <div className={styles.validationError}>
                    Sum of installments must exactly match the Total Annual Amount.
                  </div>
                )}
              </div>
            )}

            <StaggerList className={styles.installmentList}>
              {installments.map((inst, index) => (
                <StaggerItem key={index}>
                <div className={styles.installmentRow}>
                  <div className={styles.instField}>
                    <label>Amount ($)</label>
                    <input
                      type="number" min="1" required
                      className={styles.input}
                      value={inst.amount}
                      onChange={e => handleInstallmentChange(index, 'amount', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={styles.instField}>
                    <label>Due Date</label>
                    <input
                      type="date" required
                      className={styles.input}
                      value={inst.dueDate}
                      onChange={e => handleInstallmentChange(index, 'dueDate', e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className={`${styles.instField} ${styles.checkboxField}`}>
                    <label>
                      <input
                        type="checkbox"
                        checked={inst.isLateFeeApplicable}
                        onChange={e => handleInstallmentChange(index, 'isLateFeeApplicable', e.target.checked)}
                        disabled={isSubmitting}
                      />
                      Apply Late Fee
                    </label>
                  </div>
                  <div className={styles.instAction}>
                    <button
                      type="button" className={styles.removeBtn}
                      onClick={() => handleRemoveInstallment(index)}
                      disabled={installments.length === 1 || isSubmitting}
                      title="Remove Installment"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                </StaggerItem>
              ))}
            </StaggerList>
          </div>

          <div className={styles.actions}>
            <Button 
              type="submit" 
              variant="primary" 
              disabled={isSubmitting || isMismatch || !totalAmount || !departmentId}
            >
              {isSubmitting ? 'Saving...' : 'Save Fee Structure'}
            </Button>
          </div>
        </form>
      </div>
      </PageTransition>
    </DashboardShell>
  );
}
