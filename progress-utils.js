export function getTrackProgress(modules, completedLessonIds, trackId = 'core') {
  const routeModules = modules.filter(module => module.track === trackId);
  const lessons = routeModules.flatMap(module => module.lessons);
  const completed = lessons.filter(lesson => completedLessonIds.has(lesson.id)).length;
  const total = lessons.length;
  return { completed, total, percent: total ? Math.round(completed / total * 100) : 0 };
}

export function findNextLesson(modules, completedLessonIds, trackOrder = ['core', 'postgresql']) {
  for (const trackId of trackOrder) {
    for (const module of modules) {
      if (module.track !== trackId) continue;
      const index = module.lessons.findIndex(lesson => !completedLessonIds.has(lesson.id));
      if (index >= 0) return { module, lesson: module.lessons[index], index };
    }
  }
  return null;
}

export function migrateProgress(saved, modules) {
  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const source = isRecord(saved) ? saved : {};
  const stableIds = new Set();
  const legacyIds = new Map();

  for (const module of modules) {
    module.lessons.forEach((lesson, index) => {
      if (typeof lesson.id === 'string' && lesson.id) {
        stableIds.add(lesson.id);
        legacyIds.set(module.id + ':' + index, lesson.id);
      }
    });
  }

  const migrateLessonId = value => {
    if (typeof value !== 'string') return null;
    if (stableIds.has(value)) return value;
    return legacyIds.get(value) || null;
  };
  const lessons = [...new Set((Array.isArray(source.lessons) ? source.lessons : []).map(migrateLessonId).filter(Boolean))];
  const exercises = [...new Set((Array.isArray(source.exercises) ? source.exercises : []).filter(value => typeof value === 'string' && value))];
  const savedQuizAnswers = isRecord(source.quizAnswers) ? source.quizAnswers : {};
  const quizAnswers = {};

  for (const [key, value] of Object.entries(savedQuizAnswers)) {
    const parts = key.split(':');
    if (parts.length === 3) {
      const stableId = legacyIds.get(parts[0] + ':' + parts[1]);
      quizAnswers[stableId ? stableId + ':' + parts[2] : key] = value;
    } else {
      quizAnswers[key] = value;
    }
  }

  const progress = {
    lessons,
    exercises,
    quizAnswers,
    exerciseQuizAnswers: isRecord(source.exerciseQuizAnswers) ? source.exerciseQuizAnswers : {},
    assessmentResults: isRecord(source.assessmentResults) ? source.assessmentResults : {}
  };
  const original = {
    lessons: Array.isArray(source.lessons) ? source.lessons : [],
    exercises: Array.isArray(source.exercises) ? source.exercises : [],
    quizAnswers: savedQuizAnswers,
    exerciseQuizAnswers: isRecord(source.exerciseQuizAnswers) ? source.exerciseQuizAnswers : {},
    assessmentResults: isRecord(source.assessmentResults) ? source.assessmentResults : {}
  };

  return { progress, changed: JSON.stringify(original) !== JSON.stringify(progress) };
}
