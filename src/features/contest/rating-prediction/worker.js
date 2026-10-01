import { calculateSnapshot, analyzeTarget, refinePerformance, targetBounds } from './analysis.js';

// 纯计算任务与 DOM、存储隔离，终止 Worker 即可取消尚未完成的昂贵计算。
self.onmessage = ({ data }) => {
  try {
    const result =
      data.type === 'predict'
        ? calculateSnapshot(data.rows)
        : data.type === 'refine'
          ? refinePerformance(data.rows, data.handle)
          : data.type === 'bounds'
            ? targetBounds(data.rows, data.handle)
            : analyzeTarget(data.rows, data.handle, data.mode, data.value);
    self.postMessage({ id: data.id, result });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
