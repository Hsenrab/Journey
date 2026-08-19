targetScope = 'subscription'

param budgetName string
param amount int = 5
param resourceGroupName string

resource budget 'Microsoft.Consumption/budgets@2023-11-01' = {
  name: budgetName
  properties: {
    amount: amount
    category: 'Cost'
    timeGrain: 'Monthly'
    timePeriod: {
      startDate: '2026-01-01'
      endDate: '2036-12-31'
    }
    filter: {
      dimensions: {
        name: 'ResourceGroupName'
        operator: 'In'
        values: [resourceGroupName]
      }
    }
    notifications: {
      eightyPercent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 80
        contactRoles: ['Owner']
      }
      hundredPercent: {
        enabled: true
        operator: 'GreaterThan'
        threshold: 100
        contactRoles: ['Owner']
      }
    }
  }
}
