const fs = require('fs');
const cp = require('child_process');

function readJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

function changedFiles() {
  try {
    return cp.execSync('git diff --name-only HEAD^ HEAD', { encoding: 'utf8' })
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean);
  } catch (error) {
    console.log('Scope Guard: no parent commit available; skipping diff check.');
    return [];
  }
}

const locks = readJson('approved-section-locks.json');
const scope = readJson('change-scope.json');
const changed = changedFiles();
const shared = new Set(locks.shared_core || []);
const locked = new Set(locks.shared_core || []);
Object.values(locks.locked_surfaces || {}).forEach(paths => {
  (paths || []).forEach(path => locked.add(path));
});
const allowed = new Set(scope.allowed_locked_paths || []);

const violations = [];
for (const file of changed) {
  if (!locked.has(file)) continue;
  if (!allowed.has(file)) {
    violations.push(`${file}: locked but not explicitly listed in change-scope.json`);
    continue;
  }
  if (shared.has(file) && scope.user_approved_shared_change !== true) {
    violations.push(`${file}: shared core requires explicit user approval before modification`);
  }
}

console.log('Scope Guard task:', scope.task || '(unnamed)');
console.log('Changed files:', changed.length ? changed.join(', ') : '(none)');

if (violations.length) {
  console.error('\nAPPROVED SECTION LOCK VIOLATION');
  violations.forEach(v => console.error('- ' + v));
  console.error('\nStop the change. If a shared file is truly required, explain the affected sections and obtain explicit user approval first.');
  process.exit(1);
}

console.log('Scope Guard: PASS. No unapproved locked surface was changed.');
