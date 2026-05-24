import React from 'react';

const PermissionPanel = ({ permissions, onChange }) => {
  return (
    <div className="permission-panel">
      <h3>Permissões</h3>
      <div className="permissions-list">
        {Object.entries(permissions).map(([key, value]) => (
          <div key={key} className="permission-item">
            <label>
              <input 
                type="checkbox"
                checked={value}
                onChange={(e) => onChange?.(key, e.target.checked)}
              />
              <span>{key.replace(/_/g, ' ')}</span>
            </label>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PermissionPanel;
