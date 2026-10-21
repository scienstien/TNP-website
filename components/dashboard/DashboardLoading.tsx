const loadingStyles = `
  .dashboard-loading{--loading-paper:#f5f3ee;--loading-ink:#171717;position:relative;display:flex;min-height:100dvh;overflow:hidden;background:var(--loading-paper)}
  .dashboard-loading__shell{display:flex;width:100%;filter:blur(3px);opacity:.72}.dashboard-loading__sidebar{display:flex;flex:0 0 238px;flex-direction:column;gap:32px;padding:28px 20px;background:var(--loading-ink)}
  .dashboard-loading__brand{width:136px;height:42px}.dashboard-loading__nav{display:grid;gap:10px}.dashboard-loading__nav i{width:100%;height:42px}.dashboard-loading__profile{width:100%;height:42px;margin-top:auto}.dashboard-loading__content{flex:1;padding:48px}.dashboard-loading__heading{display:grid;gap:12px;width:min(420px,80%)}.dashboard-loading__heading i{width:92px;height:12px}.dashboard-loading__heading b{width:100%;height:52px}.dashboard-loading__heading i:last-child{width:74%;height:16px}.dashboard-loading__hero{height:clamp(220px,42vh,390px);margin-top:36px}.dashboard-loading__cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;margin-top:16px}.dashboard-loading__cards i{height:160px}
  .loading-shimmer{display:block;border-radius:8px;background:linear-gradient(100deg,#dfdcd5 25%,#f4f2ed 40%,#dfdcd5 55%);background-size:220% 100%;animation:dashboard-loading-shimmer 1.3s ease-in-out infinite}.dashboard-loading__sidebar .loading-shimmer{background:linear-gradient(100deg,#302f2d 25%,#4a4843 40%,#302f2d 55%);background-size:220% 100%}.dashboard-loading__veil{position:absolute;inset:0;background:rgb(245 243 238 / .26);backdrop-filter:blur(2px)}.dashboard-loading__status{position:absolute;top:50%;left:50%;display:inline-flex;align-items:center;gap:10px;padding:12px 16px;border:1px solid rgb(23 23 23 / .12);border-radius:999px;background:rgb(255 255 255 / .88);box-shadow:0 12px 36px rgb(23 23 23 / .14);color:var(--loading-ink);font:500 13px system-ui,sans-serif;transform:translate(-50%,-50%)}.dashboard-loading__spinner{width:15px;height:15px;border:2px solid #d5d1c9;border-top-color:#ff755f;border-radius:50%;animation:dashboard-loading-spin .75s linear infinite}@keyframes dashboard-loading-shimmer{to{background-position:-120% 0}}@keyframes dashboard-loading-spin{to{transform:rotate(360deg)}}
  @media (prefers-reduced-motion:reduce){.loading-shimmer,.dashboard-loading__spinner{animation:none}}@media (max-width:800px){.dashboard-loading__sidebar{flex-basis:64px;padding:12px}.dashboard-loading__brand{height:40px}.dashboard-loading__nav,.dashboard-loading__profile{display:none}.dashboard-loading__content{padding:28px 20px}.dashboard-loading__cards{grid-template-columns:1fr}}
`;

export default function DashboardLoading() {
  return (
    <main className="dashboard-loading" aria-busy="true" aria-live="polite">
      <style>{loadingStyles}</style>
      <div className="dashboard-loading__shell" aria-hidden="true">
        <aside className="dashboard-loading__sidebar">
          <div className="dashboard-loading__brand loading-shimmer" />
          <div className="dashboard-loading__nav">
            <i className="loading-shimmer" />
            <i className="loading-shimmer" />
            <i className="loading-shimmer" />
            <i className="loading-shimmer" />
          </div>
          <div className="dashboard-loading__profile loading-shimmer" />
        </aside>
        <section className="dashboard-loading__content">
          <div className="dashboard-loading__heading">
            <i className="loading-shimmer" />
            <b className="loading-shimmer" />
            <i className="loading-shimmer" />
          </div>
          <div className="dashboard-loading__hero loading-shimmer" />
          <div className="dashboard-loading__cards">
            <i className="loading-shimmer" />
            <i className="loading-shimmer" />
          </div>
        </section>
      </div>
      <div className="dashboard-loading__veil" />
      <div className="dashboard-loading__status" role="status">
        <span className="dashboard-loading__spinner" aria-hidden="true" />
        Loading dashboard…
      </div>
    </main>
  );
}
