// components/UserManagement.jsx
import React from 'react';

const UserManagement = ({ 
  users, 
  title = 'User Management', 
  onDeleteUser, 
  onToggleStatus, 
  formatDate 
}) => {
  const getStatusColor = (status) => {
    const colors = {
      'active': 'success',
      'inactive': 'secondary',
      'pending': 'warning',
      'suspended': 'danger'
    };
    return colors[status] || 'secondary';
  };

  const getRoleColor = (role) => {
    const colors = {
      'driver': 'primary',
      'customer': 'success',
      'supplier': 'info',
      'admin': 'danger',
      'operator': 'warning'
    };
    return colors[role] || 'secondary';
  };

  return (
    <div className="card">
      <div className="card-header">
        <h5 className="card-title mb-0">{title} ({users.length})</h5>
      </div>
      <div className="card-body">
        <div className="table-responsive">
          <table className="table table-hover">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Contact</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id}>
                  <td>{user.name || 'N/A'}</td>
                  <td>
                    <span className={`badge bg-${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </td>
                  <td>{user.mobileNumber || user.landlineNumber || 'N/A'}</td>
                  <td>
                    <span className={`badge bg-${getStatusColor(user.status)}`}>
                      {user.status || 'active'}
                    </span>
                  </td>
                  <td>
                    <small>{formatDate(user.updatedAt || user.createdAt)}</small>
                  </td>
                  <td>
                    <div className="btn-group btn-group-sm">
                      <button 
                        className="btn btn-outline-primary"
                        onClick={() => {/* Edit functionality */}}
                      >
                        <i className="bi bi-pencil"></i>
                      </button>
                      <button 
                        className="btn btn-outline-warning"
                        onClick={() => onToggleStatus(user)}
                      >
                        <i className="bi bi-power"></i>
                      </button>
                      <button 
                        className="btn btn-outline-danger"
                        onClick={() => onDeleteUser(user)}
                      >
                        <i className="bi bi-trash"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {users.length === 0 && (
          <div className="text-center text-muted py-4">
            <i className="bi bi-people display-6"></i>
            <p className="mt-2">No users found</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement;