const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'DH Servis Arsiv',
  script: 'C:\\Dh_Servis_Backend\\index.js'
});

// Listen for the "uninstall" event, which indicates the
// process is uninstalled.
svc.on('uninstall', function() {
  console.log('Servis basariyla sistemden kaldirildi.');
});

svc.uninstall();
