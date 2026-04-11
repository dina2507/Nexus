import React from 'react';

const ActionFeed = ({ actions = [] }) => {
  const getStakeholderColor = (stakeholder) => {
    switch (stakeholder?.toLowerCase()) {
      case 'security': return '#E24B4A';
      case 'fans': return '#378ADD';
      case 'concessions': return '#EF9F27';
      case 'medical': return '#E24B4A';
      case 'transport': return '#639922';
      default: return '#cccccc';
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'dispatched': return '#639922';
      case 'pending': return '#EF9F27';
      case 'approved': return '#639922';
      case 'rejected': return '#E24B4A';
      default: return 'gray';
    }
  };

  if (!actions || actions.length === 0) {
    return (
      <div style={{ color: 'gray', textAlign: 'center', padding: '20px' }}>
        No AI decisions yet — waiting for crowd data...
      </div>
    );
  }

  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {actions.map((act, i) => {
        const bdColor = getStakeholderColor(act.stakeholder);
        return (
          <div key={i} style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            padding: '12px', 
            borderBottom: '1px solid #333', 
            borderLeft: `4px solid ${bdColor}`,
            marginBottom: '8px',
            backgroundColor: '#1E1E1E'
          }}>
            <div style={{ width: '80px' }}>
              <span style={{ 
                backgroundColor: bdColor, 
                color: 'white', 
                padding: '2px 6px', 
                borderRadius: '4px', 
                fontSize: '11px' 
              }}>
                {act.stakeholder}
              </span>
            </div>
            
            <div style={{ flex: 1, padding: '0 12px' }}>
              <div style={{ color: '#fff', fontSize: '12px' }}>{act.action}</div>
              <div style={{ color: 'gray', fontSize: '11px', fontStyle: 'italic', marginTop: '4px' }}>
                {act.risk_assessment}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', width: '80px' }}>
              <div style={{ backgroundColor: '#333', color: 'white', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', marginBottom: '4px' }}>
                {act.priority}
              </div>
              <div style={{ color: 'gray', fontSize: '11px', marginBottom: '4px' }}>
                {act.timestamp ? new Date(act.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
              </div>
              <div style={{ fontSize: '10px', color: getStatusColor(act.status) }}>
                {act.status?.toLowerCase()}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ActionFeed;
