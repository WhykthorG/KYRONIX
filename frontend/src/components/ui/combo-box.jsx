import React, { useState } from 'react';

const ComboBox = ({ options, value, onChange, placeholder = 'Selecione...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="combo-box">
      <div className="combo-input-wrapper">
        <input
          type="text"
          placeholder={placeholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="combo-input"
        />
        <button 
          className="combo-toggle"
          onClick={() => setIsOpen(!isOpen)}
        >
          ▼
        </button>
      </div>
      {isOpen && (
        <ul className="combo-list">
          {filteredOptions.map((option) => (
            <li 
              key={option.value}
              onClick={() => {
                onChange?.(option.value);
                setIsOpen(false);
                setSearch('');
              }}
              className={value === option.value ? 'selected' : ''}
            >
              {option.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ComboBox;
