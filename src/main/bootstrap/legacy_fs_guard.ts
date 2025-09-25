import fs from 'fs';
import path from 'path';

function isFac(p: string): boolean {
  try { return /\.fac$/i.test(path.basename(p || '')); } catch { return false; }
}

export function installLegacyFsGuard() {
  const disabled = String(process.env.LEGACY_DELETE_DISABLED || 'true').toLowerCase() === 'true';
  if (!disabled) return;
  try { console.warn('[legacy-fs-guard] LEGACY_DELETE_DISABLED=true → proteger *.fac de unlink/rename/rm'); } catch {}

  const origUnlink = fs.unlink; const origUnlinkSync = fs.unlinkSync;
  const origRename = fs.rename; const origRenameSync = fs.renameSync;
  const origRm = (fs as any).rm as typeof fs.rm | undefined; const origRmSync = (fs as any).rmSync as typeof fs.rmSync | undefined;

  fs.unlink = function(p: any, cb: any) {
    try { if (typeof p === 'string' && isFac(p)) { try { console.warn('[legacy-fs-guard] blocked unlink', p); } catch {} return cb && cb(null); } } catch {}
    // @ts-ignore
    return origUnlink.apply(fs, arguments as any);
  } as any;
  fs.unlinkSync = function(p: any) {
    if (typeof p === 'string' && isFac(p)) { try { console.warn('[legacy-fs-guard] blocked unlinkSync', p); } catch {} return; }
    // @ts-ignore
    return origUnlinkSync.apply(fs, arguments as any);
  } as any;
  fs.rename = function(oldP: any, newP: any, cb: any) {
    if ((typeof oldP === 'string' && isFac(oldP)) || (typeof newP === 'string' && isFac(newP))) { try { console.warn('[legacy-fs-guard] blocked rename', oldP, '->', newP); } catch {} return cb && cb(null); }
    // @ts-ignore
    return origRename.apply(fs, arguments as any);
  } as any;
  fs.renameSync = function(oldP: any, newP: any) {
    if ((typeof oldP === 'string' && isFac(oldP)) || (typeof newP === 'string' && isFac(newP))) { try { console.warn('[legacy-fs-guard] blocked renameSync', oldP, '->', newP); } catch {} return; }
    // @ts-ignore
    return origRenameSync.apply(fs, arguments as any);
  } as any;
  if (origRm) {
    (fs as any).rm = function(p: any, opt: any, cb: any) {
      if (typeof p === 'string' && isFac(p)) { try { console.warn('[legacy-fs-guard] blocked rm', p); } catch {} return cb && cb(null); }
      // @ts-ignore
      return origRm.apply(fs, arguments as any);
    };
  }
  if (origRmSync) {
    (fs as any).rmSync = function(p: any, opt?: any) {
      if (typeof p === 'string' && isFac(p)) { try { console.warn('[legacy-fs-guard] blocked rmSync', p); } catch {} return; }
      // @ts-ignore
      return origRmSync.apply(fs, arguments as any);
    };
  }
}


