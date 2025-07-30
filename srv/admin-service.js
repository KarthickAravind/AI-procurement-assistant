const cds = require('@sap/cds')

module.exports = class AdminService extends cds.ApplicationService { init() {

  // Basic admin service without draft functionality for now
  // This can be enhanced later when needed

  return super.init()
}}
