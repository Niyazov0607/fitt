const fs = require('node:fs');
const path = require('node:path');
const files=['index.html','nutrition.html','style.css','landing.css','modern.css','app-modern.css','nutrition.css','app.js','landing.js','library.js','modern.js','nutrition.js','recipes.js','data-validation.js','tracker-nutrition.js','tracker-nutrition.css','tracker-effects.js','tracker-effects.css'];
fs.mkdirSync(path.join(__dirname,'dist'),{recursive:true});
for(const file of files) fs.copyFileSync(path.join(__dirname,file),path.join(__dirname,'dist',file));
fs.cpSync(path.join(__dirname,'assets'),path.join(__dirname,'dist','assets'),{recursive:true});
console.log('Built FitPulse in dist/');
