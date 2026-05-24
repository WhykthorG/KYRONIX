// ßâ×ßâáßâØßâößâÑßâóßâÿ ßâößâÑßâíßâÖßâÜßâúßâûßâÿßâúßâáßâÉßâô Whykthor GSV-ßâÿßâí ßâøßâÿßâößâá ßâ¿ßâößâÿßâÑßâøßâ£ßâÉ.
import React from 'react';

const UserRoleDialog = ({ isOpen, onClose, onSaveRole, currentRole }) => {
  const [selectedRole, setSelectedRole] = React.useState(currentRole || '');

  React.useEffect(() => {
    if (isOpen) {
      setSelectedRole(currentRole || '');
    }
  }, [currentRole, isOpen]);

  ];

  const handleSave = () => {
    onSaveRole?.(selectedRole);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="dialog-overlay">
      <div className="user-role-dialog">
        <h2>Atribuir Função</h2>
        <div className="role-options">
          {roles.map((role) => (
            <label key={role.value} className="role-option">
              <input
                type="radio"
                name="role"
                value={role.value}
                checked={selectedRole === role.value}
                onChange={(e) => setSelectedRole(e.target.value)}
              />
              <span>{role.label}</span>
            </label>
          ))}
        </div>
        <div className="dialog-actions">
          <button onClick={onClose} className="btn-cancel">Cancelar</button>
          <button onClick={handleSave} className="btn-save">Salvar</button>
        </div>
      </div>
    </div>
  );
};

export default UserRoleDialog;
