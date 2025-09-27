import fs from 'fs';
import path from 'path';

function isFac(p: string): boolean {
  try { return /\.fac$/i.test(path.basename(p || '')); } catch { return false; }
}
function isAllowedContingencyPath(p: string): boolean {
  try {
    const norm = String(p || '').toLowerCase().replace(/\\/g, '/');
    // Permitir operaciones de contingencia bajo userData/fac/*
    return /\/fac\/(staging|processing|done|error)\//.test(norm);
  } catch { return false; }
}
function isIncomingPath(p: string): boolean {
  try {
    const norm = String(p || '').toLowerCase().replace(/\\/g, '/');
    return /^(.:)?\/tmp\//.test(norm) || /\/c:\/tmp\//.test(norm);
  } catch { return false; }
}

export function installLegacyFsGuard() {
  const disabled = String(process.env.LEGACY_DELETE_DISABLED || 'true').toLowerCase() === 'true';
  if (!disabled) return;
  try { console.warn('[legacy-fs-guard] LEGACY_DELETE_DISABLED=true → proteger *.fac de unlink/rename/rm'); } catch {}

  const origUnlink = fs.unlink; const origUnlinkSync = fs.unlinkSync;
  const origRename = fs.rename; const origRenameSync = fs.renameSync;
  const origRm = (fs as any).rm as typeof fs.rm | undefined; const origRmSync = (fs as any).rmSync as typeof fs.rmSync | undefined;

  fs.unlink = function(p: any, cb: any) {
    try {
      if (typeof p === 'string' && isFac(p) && !(isAllowedContingencyPath(p) || isIncomingPath(p))) {
        try { console.warn('[legacy-fs-guard] blocked unlink', p); } catch {}
        return cb && cb(null);
      }
      if (typeof p === 'string' && isFac(p) && (isAllowedContingencyPath(p) || isIncomingPath(p))) {
        try { console.warn('[legacy-fs-guard] allow unlink (contingency)', p); } catch {}
      }
    } catch {}
    // @ts-ignore
    return origUnlink.apply(fs, arguments as any);
  } as any;
  fs.unlinkSync = function(p: any) {
    if (typeof p === 'string' && isFac(p) && !(isAllowedContingencyPath(p) || isIncomingPath(p))) { try { console.warn('[legacy-fs-guard] blocked unlinkSync', p); } catch {} return; }
    if (typeof p === 'string' && isFac(p) && (isAllowedContingencyPath(p) || isIncomingPath(p))) { try { console.warn('[legacy-fs-guard] allow unlinkSync (contingency)', p); } catch {} }
    // @ts-ignore
    return origUnlinkSync.apply(fs, arguments as any);
  } as any;
  fs.rename = function(oldP: any, newP: any, cb: any) {
    const allowSideA = (typeof oldP === 'string' && isFac(oldP) && (isAllowedContingencyPath(oldP) || isIncomingPath(oldP)));
    const allowSideB = (typeof newP === 'string' && isFac(newP) && (isAllowedContingencyPath(newP) || isIncomingPath(newP)));
    const block = !(allowSideA || allowSideB);
    if (block) { try { console.warn('[legacy-fs-guard] blocked rename', oldP, '->', newP); } catch {} return cb && cb(null); }
    const allow = (allowSideA || allowSideB);
    if (allow) { try { console.warn('[legacy-fs-guard] allow rename (contingency)', oldP, '->', newP); } catch {} }
    // @ts-ignore
    return origRename.apply(fs, arguments as any);
  } as any;
  fs.renameSync = function(oldP: any, newP: any) {
    const allowSideA2 = (typeof oldP === 'string' && isFac(oldP) && (isAllowedContingencyPath(oldP) || isIncomingPath(oldP)));
    const allowSideB2 = (typeof newP === 'string' && isFac(newP) && (isAllowedContingencyPath(newP) || isIncomingPath(newP)));
    const block2 = !(allowSideA2 || allowSideB2);
    if (block2) { try { console.warn('[legacy-fs-guard] blocked renameSync', oldP, '->', newP); } catch {} return; }
    const allow2 = (allowSideA2 || allowSideB2);
    if (allow2) { try { console.warn('[legacy-fs-guard] allow renameSync (contingency)', oldP, '->', newP); } catch {} }
    // @ts-ignore
    return origRenameSync.apply(fs, arguments as any);
  } as any;
  if (origRm) {
    (fs as any).rm = function(p: any, opt: any, cb: any) {
      if (typeof p === 'string' && isFac(p) && !(isAllowedContingencyPath(p) || isIncomingPath(p))) { try { console.warn('[legacy-fs-guard] blocked rm', p); } catch {} return cb && cb(null); }
      if (typeof p === 'string' && isFac(p) && (isAllowedContingencyPath(p) || isIncomingPath(p))) { try { console.warn('[legacy-fs-guard] allow rm (contingency)', p); } catch {} }
      // @ts-ignore
      return origRm.apply(fs, arguments as any);
    };
  }
  if (origRmSync) {
    (fs as any).rmSync = function(p: any, opt?: any) {
      if (typeof p === 'string' && isFac(p) && !(isAllowedContingencyPath(p) || isIncomingPath(p))) { try { console.warn('[legacy-fs-guard] blocked rmSync', p); } catch {} return; }
      if (typeof p === 'string' && isFac(p) && (isAllowedContingencyPath(p) || isIncomingPath(p))) { try { console.warn('[legacy-fs-guard] allow rmSync (contingency)', p); } catch {} }
      // @ts-ignore
      return origRmSync.apply(fs, arguments as any);
    };
  }
}


