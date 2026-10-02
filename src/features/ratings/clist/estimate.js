// 综合请求耗时与固定等待估算剩余时间；时钟可注入，避免依赖界面定时器。
export function createClistSyncEstimate({
  intervalSeconds = 8,
  now = () => performance.now(),
} = {}) {
  let averageRequestSeconds = null;
  let phase = 'request';
  let phaseStarted = now();
  let waitingUntil = 0;
  let remainingPages = 1;
  let displayed = null;
  let lastTick = now();

  return {
    // 每次请求开始只更新阶段，不重新生成一套倒计时。
    request(pages) {
      phase = 'request';
      phaseStarted = now();
      remainingPages = Math.max(1, pages);
    },
    // 用平滑均值吸收真实网络耗时，避免某次慢请求主导后续估计。
    response(milliseconds) {
      const sample = Math.max(0.1, milliseconds / 1000);
      averageRequestSeconds =
        averageRequestSeconds === null ? sample : averageRequestSeconds * 0.7 + sample * 0.3;
    },
    // 限流退避与正常分页间隔都计入同一总剩余时间。
    wait(seconds, pages) {
      // 服务器新增的退避必须立即计入，不能为了平滑显示不可能的完成时间。
      if (seconds > intervalSeconds && displayed !== null) displayed += seconds;
      phase = 'waiting';
      waitingUntil = now() + seconds * 1000;
      remainingPages = Math.max(1, pages);
    },
    // 正常按秒递减，预测变化只逐步校正；完成之前不提前显示零秒。
    seconds() {
      const time = now();
      if (averageRequestSeconds === null) {
        lastTick = time;
        return null;
      }
      const elapsed = (time - phaseStarted) / 1000;
      const waiting = phase === 'waiting' ? Math.max(0, (waitingUntil - time) / 1000) : 0;
      const future = (remainingPages - 1) * (averageRequestSeconds + intervalSeconds);
      const remaining =
        phase === 'waiting'
          ? waiting + averageRequestSeconds + future
          : Math.max(1, averageRequestSeconds - elapsed) + future;
      if (displayed === null) displayed = remaining;
      else {
        const delta = Math.max(0, (time - lastTick) / 1000);
        const countdown = Math.max(1, displayed - delta);
        const correction = (remaining - countdown) * (1 - Math.exp(-delta / 4));
        displayed = countdown + Math.max(-delta, Math.min(3 * delta, correction));
      }
      displayed = Math.max(displayed, waiting + (remainingPages - 1) * intervalSeconds);
      lastTick = time;
      return Math.max(1, Math.ceil(displayed));
    },
    // 失败重试时保留耗时样本，但不沿用中断期间的倒计时。
    restart() {
      displayed = null;
      lastTick = now();
    },
  };
}
