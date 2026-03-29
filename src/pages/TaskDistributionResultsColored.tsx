import React from 'react';

export default function TaskDistributionResultsColored() {
  const tasks = [
    { id: '1', name: 'Math Test', type: 'Math' },
    { id: '2', name: 'Science Test', type: 'Science' },
    { id: '3', name: 'English Test', type: 'English' },
  ];

  const colorMap: Record<string, string> = {
    Math: '#4A90E2',
    Science: '#7ED321',
    English: '#F8E71C'
  };

  return (
    <div>
      <h2>Task Distribution Colored Demo</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>ID</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Name</th>
            <th style={{ border: '1px solid #ccc', padding: '0.5rem' }}>Type</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map(task => (
            <tr key={task.id} style={{ backgroundColor: colorMap[task.type] }}>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{task.id}</td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{task.name}</td>
              <td style={{ border: '1px solid #ccc', padding: '0.5rem' }}>{task.type}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
