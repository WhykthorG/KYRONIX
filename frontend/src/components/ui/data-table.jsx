import React from 'react';

const DataTable = ({ columns, data, striped = false, hover = false }) => {
  return (
    <div className="data-table-wrapper">
      <table className={`data-table ${striped ? 'striped' : ''} ${hover ? 'hover' : ''}`}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr key={idx}>
              {columns.map((col) => (
                <td key={col.key}>{row[col.key]}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
