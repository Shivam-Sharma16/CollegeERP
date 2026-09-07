import React from 'react';
import styles from './FilterBar.module.css';

export function FilterBar({ filters, onFilterChange, departments = [], isLoadingDepartments = false }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFilterChange({ ...filters, [name]: value });
  };

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterGroup}>
        <label htmlFor="departmentId">Department</label>
        <select
          id="departmentId"
          name="departmentId"
          value={filters.departmentId || ''}
          onChange={handleChange}
          disabled={isLoadingDepartments}
          className={styles.input}
        >
          <option value="all">All Departments</option>
          {departments.map((dept) => (
            <option key={dept._id} value={dept._id}>
              {dept.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.filterGroup}>
        <label htmlFor="startDate">Start Date</label>
        <input
          type="date"
          id="startDate"
          name="startDate"
          value={filters.startDate || ''}
          onChange={handleChange}
          className={styles.input}
        />
      </div>

      <div className={styles.filterGroup}>
        <label htmlFor="endDate">End Date</label>
        <input
          type="date"
          id="endDate"
          name="endDate"
          value={filters.endDate || ''}
          onChange={handleChange}
          className={styles.input}
        />
      </div>
    </div>
  );
}
