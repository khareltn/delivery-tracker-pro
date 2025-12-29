// components/DashboardStats.jsx
import React from 'react';

const DashboardStats = ({ stats, company }) => {
  const statCards = [
    { 
      title: 'Total Drivers', 
      value: stats.totalDrivers, 
      icon: 'bi-person-badge', 
      color: 'primary',
      bgColor: 'border-primary',
      textColor: 'text-primary'
    },
    { 
      title: 'Active Deliveries', 
      value: stats.activeDeliveries, 
      icon: 'bi-truck', 
      color: 'success',
      bgColor: 'border-success',
      textColor: 'text-success'
    },
    { 
      title: 'Pending Deliveries', 
      value: stats.pendingDeliveries, 
      icon: 'bi-clock', 
      color: 'warning',
      bgColor: 'border-warning',
      textColor: 'text-warning'
    },
    { 
      title: 'Low Stock Products', 
      value: stats.lowStockProducts, 
      icon: 'bi-exclamation-triangle', 
      color: 'danger',
      bgColor: 'border-danger',
      textColor: 'text-danger'
    },
    { 
      title: 'Total Customers', 
      value: stats.totalCustomers, 
      icon: 'bi-people', 
      color: 'info',
      bgColor: 'border-info',
      textColor: 'text-info'
    },
    { 
      title: 'Today\'s Deliveries', 
      value: stats.completedToday, 
      icon: 'bi-check-circle', 
      color: 'success',
      bgColor: 'border-success',
      textColor: 'text-success'
    },
  ];

  return (
    <div className="row">
      {statCards.map((stat, index) => (
        <div key={index} className="col-md-4 col-lg-2 col-sm-6 mb-3">
          <div className={`card ${stat.bgColor}`}>
            <div className="card-body">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h6 className="card-subtitle text-muted">{stat.title}</h6>
                  <h3 className="card-title">{stat.value}</h3>
                </div>
                <div className={`${stat.textColor} fs-1`}>
                  <i className={`bi ${stat.icon}`}></i>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default DashboardStats;