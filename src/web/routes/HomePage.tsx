import { hc } from "hono/client";
import { useEffect, useState } from "react";
import { formatCurrency } from "../../shared/lib/currency";
import type { AppType } from "../../worker";

const api = hc<AppType>(window.location.origin);

const goals = [
  {
    name: "安全垫",
    detail: "覆盖 12 个月生活支出",
    current: 186000,
    target: 240000,
    progress: 78,
    tone: "clay",
  },
  {
    name: "长期增长",
    detail: "2035 年阶段目标",
    current: 746000,
    target: 1200000,
    progress: 62,
    tone: "sage",
  },
  {
    name: "自由选择",
    detail: "给未来留一份主动权",
    current: 354400,
    target: 800000,
    progress: 44,
    tone: "gold",
  },
] as const;

const yearlyPath = [
  { year: "现在", value: 42 },
  { year: "2028", value: 50 },
  { year: "2030", value: 62 },
  { year: "2032", value: 73 },
  { year: "2035", value: 88 },
] as const;

type ConnectionState = {
  label: string;
  environment: string;
  connected: boolean;
};

export function HomePage() {
  const [connection, setConnection] = useState<ConnectionState>({
    label: "正在连接本地 Worker",
    environment: "local",
    connected: false,
  });

  useEffect(() => {
    let active = true;

    async function checkConnection() {
      try {
        const response = await api.api.v1.health.$get({
          query: {},
        });
        const result = await response.json();

        if (active && "ok" in result && result.ok && "environment" in result) {
          setConnection({
            label: "本地环境已就绪",
            environment: result.environment,
            connected: true,
          });
        }
      } catch {
        if (active) {
          setConnection({
            label: "等待本地 Worker",
            environment: "offline",
            connected: false,
          });
        }
      }
    }

    void checkConnection();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="page-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="WealthPlans 首页">
          <span className="brand-mark" aria-hidden="true">
            W
          </span>
          <span>WealthPlans</span>
        </a>

        <nav className="primary-nav" aria-label="主要导航">
          <a href="#overview">全景</a>
          <a href="#plan">目标</a>
          <a href="#next-step">行动</a>
        </nav>

        <a className="header-action" href="#plan">
          进入规划
          <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main id="top">
        <section className="hero-section" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span aria-hidden="true" />
              财富规划，不是行情追逐
            </p>
            <h1 id="hero-title">
              看清今天，
              <br />
              <em>也看见未来。</em>
            </h1>
            <p className="hero-description">
              把散落的资产、目标与选择放进一张清晰的路线图。WealthPlans
              帮你知道自己在哪里，也知道下一步为什么出发。
            </p>

            <div className="hero-actions">
              <a className="primary-button" href="#plan">
                创建第一份计划
                <span aria-hidden="true">→</span>
              </a>
              <a className="text-link" href="#overview">
                先看看示例
              </a>
            </div>

            <div className="trust-note">
              <span className="trust-icon" aria-hidden="true">
                ✓
              </span>
              <p>
                你的计划属于你
                <small>当前页面仅使用本地演示数据</small>
              </p>
            </div>
          </div>

          <div className="hero-visual" role="img" aria-label="财富计划示例概览">
            <div className="visual-orbit orbit-one" aria-hidden="true" />
            <div className="visual-orbit orbit-two" aria-hidden="true" />

            <article className="plan-card">
              <div className="plan-card-header">
                <div>
                  <p>我的长期计划</p>
                  <span>示例视图 · 2026—2035</span>
                </div>
                <span className="sample-badge">演示</span>
              </div>

              <div className="net-worth">
                <span>当前可规划资产</span>
                <strong>{formatCurrency(1286400)}</strong>
                <p>
                  <span aria-hidden="true">↗</span>
                  按当前节奏，2035 年目标可达成 86%
                </p>
              </div>

              <div className="path-chart" role="img" aria-label="长期目标趋势示例">
                {yearlyPath.map((item) => (
                  <div className="path-column" key={item.year}>
                    <div className="path-track">
                      <span style={{ height: `${item.value}%` }} />
                    </div>
                    <small>{item.year}</small>
                  </div>
                ))}
              </div>

              <div className="plan-card-footer">
                <div>
                  <span>本月可投入</span>
                  <strong>{formatCurrency(16800)}</strong>
                </div>
                <div>
                  <span>目标缓冲</span>
                  <strong>14.2%</strong>
                </div>
              </div>
            </article>

            <div className="floating-note note-top">
              <span aria-hidden="true">◎</span>
              <p>
                安全垫
                <strong>已覆盖 9.3 个月</strong>
              </p>
            </div>

            <div className="floating-note note-bottom">
              <span aria-hidden="true">↗</span>
              <p>
                下一步
                <strong>完善年度现金流</strong>
              </p>
            </div>
          </div>
        </section>

        <section className="overview-section" id="overview" aria-labelledby="overview-title">
          <div className="section-heading">
            <p className="section-kicker">一眼看清</p>
            <h2 id="overview-title">不是更多数字，而是更少疑问。</h2>
            <p>用同一套口径回答三个问题：我拥有什么、我想去哪里、现在该做什么。</p>
          </div>

          <div className="overview-grid">
            <article className="overview-card overview-card-featured">
              <div className="card-number">01</div>
              <div className="card-symbol" aria-hidden="true">
                ◒
              </div>
              <h3>资产全景</h3>
              <p>把分散的资产与负债放到同一个视图，建立稳定、可比较的财富基线。</p>
              <div className="mini-breakdown" role="img" aria-label="演示资产分布">
                <span style={{ width: "48%" }} />
                <span style={{ width: "30%" }} />
                <span style={{ width: "22%" }} />
              </div>
            </article>

            <article className="overview-card">
              <div className="card-number">02</div>
              <div className="card-symbol" aria-hidden="true">
                ◌
              </div>
              <h3>目标路线</h3>
              <p>把抽象的未来拆成时间、金额和缓冲，让每个目标都有可以行动的路径。</p>
              <div className="milestone-row" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
              </div>
            </article>

            <article className="overview-card">
              <div className="card-number">03</div>
              <div className="card-symbol" aria-hidden="true">
                ↗
              </div>
              <h3>行动节奏</h3>
              <p>优先处理真正影响长期结果的选择，不被每一天的市场噪声带走注意力。</p>
              <div className="action-preview">
                <span>本月优先级</span>
                <strong>补齐现金流数据</strong>
              </div>
            </article>
          </div>
        </section>

        <section className="goals-section" id="plan" aria-labelledby="goals-title">
          <div className="goals-intro">
            <p className="section-kicker">让目标有刻度</p>
            <h2 id="goals-title">每一步，都知道离未来还有多远。</h2>
            <p>
              长期规划不是一次算完，而是一套会随着生活变化持续更新的系统。下面的数据仅用于展示页面结构。
            </p>
          </div>

          <div className="goals-list">
            {goals.map((goal) => (
              <article className="goal-row" key={goal.name}>
                <div className={`goal-dot goal-dot-${goal.tone}`} aria-hidden="true" />
                <div className="goal-main">
                  <div className="goal-title">
                    <div>
                      <h3>{goal.name}</h3>
                      <p>{goal.detail}</p>
                    </div>
                    <strong>{goal.progress}%</strong>
                  </div>
                  <div
                    className="goal-progress"
                    role="progressbar"
                    aria-label={`${goal.name}进度`}
                    aria-valuenow={goal.progress}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${goal.progress}%` }} />
                  </div>
                  <div className="goal-values">
                    <span>当前 {formatCurrency(goal.current)}</span>
                    <span>目标 {formatCurrency(goal.target)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="next-step-section" id="next-step" aria-labelledby="next-step-title">
          <div className="next-step-copy">
            <p className="section-kicker">从一个清楚的问题开始</p>
            <h2 id="next-step-title">财富计划的第一步，不是预测未来。</h2>
            <p>是先让今天的资产、现金流和目标使用同一套语言。功能开发将在产品范围确认后继续。</p>
          </div>
          <div className="readiness-card">
            <div className="readiness-status">
              <span className={connection.connected ? "status-dot is-ready" : "status-dot"} />
              <div>
                <strong>{connection.label}</strong>
                <small>环境：{connection.environment}</small>
              </div>
            </div>
            <div className="readiness-details">
              <div>
                <span>前端</span>
                <strong>React + Vite</strong>
              </div>
              <div>
                <span>服务端</span>
                <strong>Hono + Workers</strong>
              </div>
              <div>
                <span>本地数据</span>
                <strong>D1 + R2</strong>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <a className="brand brand-footer" href="#top">
          <span className="brand-mark" aria-hidden="true">
            W
          </span>
          <span>WealthPlans</span>
        </a>
        <p>让每个长期选择，都有清晰的依据。</p>
        <span>初始技术预览 · 非财务建议</span>
      </footer>
    </div>
  );
}
