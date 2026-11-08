const hash32 = value => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

export const quizOptionKey = (question, track) =>
  `${track}:\u001f${question.question}:\u001f${question.options.join('\u001f')}`;

export function buildQuizOptionOrders(modules) {
  const tracks = new Map();
  for (const module of modules) {
    const entries = [
      ...module.lessons.flatMap(lesson => (lesson.quiz || []).map((question, index) => ({
        question,
        seed: `${lesson.id}:lesson:${index}:${quizOptionKey(question, module.track)}`
      }))),
      ...(module.quiz || []).map((question, index) => ({
        question,
        seed: `${module.id}:assessment:${index}:${quizOptionKey(question, module.track)}`
      }))
    ];
    if (!tracks.has(module.track)) tracks.set(module.track, new Map());
    const questions = tracks.get(module.track);
    for (const entry of entries) {
      const key = quizOptionKey(entry.question, module.track);
      if (!questions.has(key)) questions.set(key, entry);
    }
  }

  const orders = new Map();
  for (const [track, questionMap] of tracks) {
    const questions = [...questionMap.entries()].sort((left, right) => {
      const leftHash = hash32(left[1].seed);
      const rightHash = hash32(right[1].seed);
      return leftHash - rightHash || left[1].seed.localeCompare(right[1].seed);
    });
    questions.forEach(([key, entry], index) => {
      const { question, seed } = entry;
      const correctIndex = question.answer;
      const distractors = question.options
        .map((_, optionIndex) => optionIndex)
        .filter(optionIndex => optionIndex !== correctIndex)
        .sort((left, right) => {
          const leftHash = hash32(`${seed}:option:${left}`);
          const rightHash = hash32(`${seed}:option:${right}`);
          return leftHash - rightHash || left - right;
        });
      const order = [...distractors];
      order.splice(index % question.options.length, 0, correctIndex);
      orders.set(key, order);
    });
  }
  return orders;
}
