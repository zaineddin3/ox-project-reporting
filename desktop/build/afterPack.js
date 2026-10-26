// Puts the Oxford icon and name into the Windows .exe without needing Windows build tools.
const path = require('path'), fs = require('fs');
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== 'win32') return;
  const ResEdit = require('resedit'); const pngToIco = require('png-to-ico'); 
  const exe = path.join(ctx.appOutDir, `${ctx.packager.appInfo.productFilename}.exe`);
  const ico = await pngToIco(path.join(__dirname, 'icon-256.png'));
  const exeObj = ResEdit.NtExecutable.from(fs.readFileSync(exe));
  const r = ResEdit.NtExecutableResource.from(exeObj);
  const iconFile = ResEdit.Data.IconFile.from(ico);
  ResEdit.Resource.IconGroupEntry.replaceIconsForResource(r.entries, 1, 1033, iconFile.icons.map(i => i.data));
  const vi = ResEdit.Resource.VersionInfo.fromEntries(r.entries)[0];
  if (vi) { vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: 'OX Project Reporting', ProductName: 'OX Project Reporting', CompanyName: 'Oxford Electrical Group Pty Ltd' }); vi.outputToResourceEntries(r.entries); }
  r.outputResource(exeObj); fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
};
