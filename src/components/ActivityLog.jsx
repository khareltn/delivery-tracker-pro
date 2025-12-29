// components/ActivityLog.jsx
import React from 'react';

const ActivityLog = ({ activities, formatDate, getActivityLabel }) => {
  return (
    <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
      {activities.length > 0 ? (
        activities.map(activity => (
          <div key={activity.id} className="border-bottom pb-2 mb-2">
            <div className="d-flex justify-content-between align-items-start">
              <div>
                <strong>{getActivityLabel(activity.action)}</strong>
                <p className="mb-1">{activity.details?.description || 'No description'}</p>
                <small className="text-muted">
                  By: {activity.performedBy || 'Unknown'} • 
                  {formatDate(activity.timestamp)}
                </small>
              </div>
            </div>
          </div>
        ))
      ) : (
        <div className="text-center text-muted py-4">
          <i className="bi bi-activity display-6"></i>
          <p className="mt-2">No activities recorded yet</p>
        </div>
      )}
    </div>
  );
};

export default ActivityLog;