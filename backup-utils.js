export const BACKUP_FORMAT = 'sql-academy-backup';
export const BACKUP_VERSION = 1;
export const BACKUP_STORAGE_KEYS = Object.freeze([
  'sql-academy-progress-v1',
  'sql-academy-editor-v1',
  'sql-academy-project-progress-v1',
  'sql-academy-project-drafts-v1',
  'sql-academy-project-notes-v1',
  'sql-academy-project-reviews-v1',
  'sql-academy-theme'
]);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isStringRecord = value => isRecord(value) && Object.values(value).every(item => typeof item === 'string');
const parseJson = (raw, fallback, label) => {
  if (raw === null) return fallback;
  try { return JSON.parse(raw); }
  catch { throw new TypeError('Повреждённые данные резервной копии: ' + label); }
};
function validateStorage(storage) {
  const unknown = Object.keys(storage).filter(key => !BACKUP_STORAGE_KEYS.includes(key));
  if (unknown.length) throw new TypeError('Резервная копия содержит неизвестные разделы: ' + unknown.join(', '));
  for (const key of BACKUP_STORAGE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(storage, key)) throw new TypeError('В резервной копии отсутствует обязательный раздел: ' + key);
    const value = storage[key];
    if (value !== null && typeof value !== 'string') throw new TypeError('Некорректный формат данных: ' + key);
  }
  const progress = parseJson(storage['sql-academy-progress-v1'], {}, 'прогресс курсов');
  if (!isRecord(progress)) throw new TypeError('Прогресс курсов должен быть объектом.');
  for (const field of ['lessons', 'exercises']) {
    if (progress[field] !== undefined && (!Array.isArray(progress[field]) || !progress[field].every(item => typeof item === 'string'))) {
      throw new TypeError('Некорректный список ' + field + ' в прогрессе курсов.');
    }
  }
  for (const field of ['quizAnswers', 'exerciseQuizAnswers', 'assessmentResults']) {
    if (progress[field] !== undefined && !isRecord(progress[field])) throw new TypeError('Некорректный раздел ' + field + ' в прогрессе курсов.');
  }
  const projectProgress = parseJson(storage['sql-academy-project-progress-v1'], [], 'прогресс проектов');
  if (!Array.isArray(projectProgress) || !projectProgress.every(item => typeof item === 'string')) throw new TypeError('Прогресс проектов должен быть списком идентификаторов.');
  const drafts = parseJson(storage['sql-academy-project-drafts-v1'], {}, 'SQL-черновики проектов');
  if (!isStringRecord(drafts)) throw new TypeError('SQL-черновики проектов должны быть объектом строк.');
  const notes = parseJson(storage['sql-academy-project-notes-v1'], {}, 'аналитические записки');
  if (!isStringRecord(notes)) throw new TypeError('Аналитические записки должны быть объектом строк.');
  const reviews = parseJson(storage['sql-academy-project-reviews-v1'], {}, 'ответы по проектам');
  if (!isRecord(reviews) || !Object.values(reviews).every(item => Number.isInteger(item) && item >= 0)) {
    throw new TypeError('Ответы по проектам должны содержать целые неотрицательные номера вариантов.');
  }
  const theme = storage['sql-academy-theme'];
  if (theme !== null && !['dark', 'light'].includes(theme)) throw new TypeError('Неизвестная тема оформления в резервной копии.');
}
export function createBackup(storage, createdAt = new Date().toISOString()) {
  const snapshot = {};
  for (const key of BACKUP_STORAGE_KEYS) {
    const value = storage.getItem(key);
    snapshot[key] = value === null ? null : value;
  }
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, createdAt, storage: snapshot };
}
export function parseBackup(input) {
  let backup;
  try { backup = typeof input === 'string' ? JSON.parse(input) : input; }
  catch { throw new TypeError('Файл не содержит корректный JSON.'); }
  if (!isRecord(backup) || backup.format !== BACKUP_FORMAT) throw new TypeError('Это не резервная копия SQL Academy.');
  if (backup.version !== BACKUP_VERSION) throw new TypeError('Версия резервной копии не поддерживается этой версией SQL Academy.');
  if (typeof backup.createdAt !== 'string' || !Number.isFinite(Date.parse(backup.createdAt))) throw new TypeError('В резервной копии отсутствует корректная дата создания.');
  if (!isRecord(backup.storage)) throw new TypeError('В резервной копии отсутствуют сохранённые данные.');
  validateStorage(backup.storage);
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: backup.createdAt,
    storage: Object.fromEntries(BACKUP_STORAGE_KEYS.map(key => [key, backup.storage[key]]))
  };
}
export function restoreBackup(target, input) {
  const backup = parseBackup(input);
  const previous = Object.fromEntries(BACKUP_STORAGE_KEYS.map(key => [key, target.getItem(key)]));
  try {
    for (const key of BACKUP_STORAGE_KEYS) target.removeItem(key);
    for (const key of BACKUP_STORAGE_KEYS) {
      const value = backup.storage[key];
      if (value !== null) target.setItem(key, value);
    }
  } catch (error) {
    try {
      for (const key of BACKUP_STORAGE_KEYS) target.removeItem(key);
      for (const key of BACKUP_STORAGE_KEYS) {
        const value = previous[key];
        if (value !== null) target.setItem(key, value);
      }
    } catch (rollbackError) {
      throw new AggregateError([error, rollbackError], 'Не удалось восстановить резервную копию и откатить частичную запись.');
    }
    throw new Error('Восстановление отменено. Прежние данные сохранены: ' + (error?.message || error));
  }
  return backup;
}
