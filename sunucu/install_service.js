const Service = require('node-windows').Service;

// Create a new service object
const svc = new Service({
  name: 'DH Servis Arsiv',
  description: 'DH Servis Rapor ve Sayim PDF Arsivleme Servisi',
  script: 'C:\\Dh_Servis_Backend\\index.js',
  env: [{
    name: 'NODE_ENV',
    value: 'production'
  }]
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function() {
  console.log('Servis basariyla kuruldu! Baslatiliyor...');
  svc.start();
});

svc.on('alreadyinstalled', function() {
  console.log('Servis zaten kurulmus!');
});

svc.on('start', function() {
  console.log('Servis basariyla baslatildi ve arka planda calisiyor.');
});

svc.install();
