import {
  Activity,
  ArrowRight,
  BookOpen,
  CircuitBoard,
  Code,
  Database,
  FileText,
  GitBranch,
  KeyRound,
  Play,
  RefreshCcw,
  Route,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import logoLockupUrl from "./assets/fountlayer-lockup.svg";
import logoMarkUrl from "./assets/fountlayer-mark.svg";
import systemMapUrl from "./assets/fountlayer-system-map.png";

type Language = "en" | "zh";

type ScenarioStep = {
  detail: string;
  label: string;
  metric: string;
};

type LedgerRow = {
  amount: string;
  direction: "credit" | "debit";
  directionLabel: string;
  reason: string;
  wallet: string;
};

type Scenario = {
  channel: string;
  description: string;
  event: {
    appId: string;
    mode: string;
    retail: string;
    useCase: string;
  };
  ledger: LedgerRow[];
  name: string;
  outcome: string;
  steps: ScenarioStep[];
};

type SiteCopy = {
  brand: {
    logoAlt: string;
    visualBody: string;
    visualKicker: string;
    visualTitle: string;
  };
  capabilities: {
    eyebrow: string;
    items: {
      label: string;
      text: string;
    }[];
    title: string;
  };
  deploy: {
    copy: string;
    eyebrow: string;
    steps: {
      label: string;
      value: string;
    }[];
    title: string;
  };
  event: {
    label: string;
    retailLabel: string;
  };
  footer: {
    link: string;
    text: string;
  };
  hero: {
    copy: string;
    eyebrow: string;
    metrics: {
      label: string;
      value: string;
    }[];
    primaryCta: string;
    secondaryCta: string;
    title: string;
  };
  intro: {
    body: string;
    eyebrow: string;
    imageAlt: string;
    title: string;
  };
  language: {
    aria: string;
    options: Record<Language, string>;
  };
  ledger: {
    amount: string;
    direction: string;
    rowsAria: string;
    wallet: string;
  };
  loop: {
    aria: string;
    copy: string;
    eyebrow: string;
    processing: string;
    replay: string;
    reset: string;
    runNext: string;
    tabsAria: string;
    title: string;
  };
  metaDescription: string;
  metaTitle: string;
  nav: {
    brand: string;
    deploy: string;
    github: string;
    loop: string;
    scenarios: string;
    security: string;
  };
  scenarios: readonly [Scenario, ...Scenario[]];
  security: {
    eyebrow: string;
    items: string[];
    title: string;
  };
};

const copy = {
  en: {
    brand: {
      logoAlt: "FountLayer logo lockup",
      visualBody:
        "The site uses the transparent SVG mark and lockup directly, so the identity sits on the page without a visible background plate.",
      visualKicker: "Transparent SVG identity",
      visualTitle: "Official mark, wordmark, and lockup on the page surface.",
    },
    capabilities: {
      eyebrow: "What ships first",
      items: [
        {
          label: "Route policies",
          text: "Logical model aliases map to server-side provider models, allowlists, and spend caps.",
        },
        {
          label: "Faucet and wallet",
          text: "Faucet grants pay first; wallets fund billable calls without negative balances.",
        },
        {
          label: "Metadata observability",
          text: "Events, spans, and metrics expose cost and routing shape without prompts or outputs.",
        },
        {
          label: "Settlement exports",
          text: "Ledger-period reports produce deterministic CSV files and reconciliation hashes.",
        },
      ],
      title: "Distribution primitives before chatbot UI.",
    },
    deploy: {
      copy: "The site publishes from GitHub Actions to the repository Pages URL first. When the AiFund DNS record is ready, point a subdomain such as fountlayer.aifund.com at GitHub Pages and switch the site base path to root.",
      eyebrow: "GitHub Pages",
      steps: [
        {
          label: "Build artifact",
          value: "apps/site/dist",
        },
        {
          label: "Pages workflow",
          value: "GitHub Actions",
        },
        {
          label: "Runtime keys",
          value: "none required",
        },
      ],
      title: "Static by default, domain-ready when DNS is ready.",
    },
    event: {
      label: "usage_event",
      retailLabel: "retail",
    },
    footer: {
      link: "View source",
      text: "The open LLM last-mile distribution layer for apps.",
    },
    hero: {
      copy: "The open LLM last-mile distribution layer for apps. Ship AI access with attribution, faucet credits, metering, routing, and ledger records before you expose a single provider key.",
      eyebrow: "Open-source infrastructure",
      metrics: [
        {
          label: "Current milestone",
          value: "v0.5 foundation",
        },
        {
          label: "Verified tests",
          value: "108 passed",
        },
        {
          label: "Provider keys",
          value: "server only",
        },
      ],
      primaryCta: "Run the loop",
      secondaryCta: "Publish on Pages",
      title: "FountLayer",
    },
    intro: {
      body: "FountLayer focuses on the operational layer between application UX and model providers: who made the request, which channel brought it, who funded it, what model route ran, and how the money movement reconciles.",
      eyebrow: "Why it exists",
      imageAlt:
        "FountLayer system map connecting SDK, gateway, adapters, metering, faucet, ledger, and console.",
      title: "Apps need LLM distribution, not another generic chatbot.",
    },
    language: {
      aria: "Language",
      options: {
        en: "EN",
        zh: "CN",
      },
    },
    ledger: {
      amount: "Amount",
      direction: "Direction",
      rowsAria: "Ledger rows",
      wallet: "Wallet",
    },
    loop: {
      aria: "Scenarios",
      copy: "The simulator uses local fixture data to show how a request moves from SDK attribution to usage event and ledger entries.",
      eyebrow: "Interactive model",
      processing: "Processing",
      replay: "Replay loop",
      reset: "Reset",
      runNext: "Run next step",
      tabsAria: "Scenarios",
      title: "Run a last-mile request without touching real keys.",
    },
    metaDescription:
      "FountLayer is the open LLM last-mile distribution layer for apps.",
    metaTitle: "FountLayer | Open LLM Last-Mile Distribution",
    nav: {
      brand: "Brand",
      deploy: "Publish",
      github: "GitHub",
      loop: "Loop",
      scenarios: "Scenarios",
      security: "Boundaries",
    },
    scenarios: [
      {
        channel: "Desktop reader channel",
        description:
          "An app gives new readers sponsored summaries while FountLayer attributes cost, usage, and remaining faucet balance.",
        event: {
          appId: "marginnote_reader",
          mode: "managed",
          retail: "$0.0034",
          useCase: "paper_summary",
        },
        ledger: [
          {
            amount: "$0.0034",
            direction: "debit",
            directionLabel: "debit",
            reason: "retail_charge",
            wallet: "wallet_faucet_new_reader",
          },
          {
            amount: "$0.0034",
            direction: "credit",
            directionLabel: "credit",
            reason: "platform_revenue",
            wallet: "wallet_platform_revenue",
          },
          {
            amount: "$0.0021",
            direction: "debit",
            directionLabel: "debit",
            reason: "provider_cost",
            wallet: "wallet_platform_cost",
          },
          {
            amount: "$0.0021",
            direction: "credit",
            directionLabel: "credit",
            reason: "provider_payable",
            wallet: "wallet_provider_payable",
          },
        ],
        name: "PDF Reader faucet",
        outcome: "1 usage event, 4 ledger entries, remaining grant $0.9966",
        steps: [
          {
            detail: "SDK sends app, channel, end user, use case, and mode.",
            label: "SDK attribution",
            metric: "5 fields",
          },
          {
            detail: "Gateway resolves the paper-summary route and price.",
            label: "Route and estimate",
            metric: "$0.0034",
          },
          {
            detail:
              "Faucet grant passes model allowlist, use-case cap, and expiry.",
            label: "Faucet check",
            metric: "active",
          },
          {
            detail: "Adapter returns usage without exposing provider keys.",
            label: "Adapter call",
            metric: "demo-local",
          },
          {
            detail: "Usage and ledger records are written once.",
            label: "Meter and ledger",
            metric: "1 + 4",
          },
        ],
      },
      {
        channel: "Embedded helpdesk plugin",
        description:
          "A SaaS vendor funds support answers but keeps spend, routing, and attribution outside the customer-facing app.",
        event: {
          appId: "helio_support",
          mode: "developer_key",
          retail: "$0.0187",
          useCase: "support_answer",
        },
        ledger: [
          {
            amount: "$0.0187",
            direction: "debit",
            directionLabel: "debit",
            reason: "retail_charge",
            wallet: "wallet_developer_campaign",
          },
          {
            amount: "$0.0131",
            direction: "credit",
            directionLabel: "credit",
            reason: "developer_margin",
            wallet: "wallet_helio_support",
          },
          {
            amount: "$0.0039",
            direction: "credit",
            directionLabel: "credit",
            reason: "channel_commission",
            wallet: "wallet_helpdesk_partner",
          },
          {
            amount: "$0.0017",
            direction: "credit",
            directionLabel: "credit",
            reason: "platform_revenue",
            wallet: "wallet_platform_revenue",
          },
        ],
        name: "SaaS plugin channel",
        outcome: "Attribution separates app spend from channel commission.",
        steps: [
          {
            detail: "Plugin starts a scoped session for one support workflow.",
            label: "Scoped session",
            metric: "24h",
          },
          {
            detail: "Gateway picks a route policy with a max retail price.",
            label: "Spend guard",
            metric: "$0.025 cap",
          },
          {
            detail: "Developer credential stays server-side encrypted.",
            label: "Credential boundary",
            metric: "server only",
          },
          {
            detail: "A successful answer becomes a usage event.",
            label: "Usage event",
            metric: "success",
          },
          {
            detail:
              "Partner commission and revenue are posted to ledger wallets.",
            label: "Settlement-ready",
            metric: "balanced",
          },
        ],
      },
      {
        channel: "Local workstation",
        description:
          "Power users can point the SDK at a local model endpoint while FountLayer still preserves attribution and UX.",
        event: {
          appId: "private_research_desk",
          mode: "local",
          retail: "$0.0000",
          useCase: "private_notes",
        },
        ledger: [
          {
            amount: "$0.0000",
            direction: "debit",
            directionLabel: "debit",
            reason: "local_execution",
            wallet: "wallet_local_user",
          },
          {
            amount: "$0.0000",
            direction: "credit",
            directionLabel: "credit",
            reason: "local_execution",
            wallet: "wallet_local_model",
          },
        ],
        name: "Local or BYOK",
        outcome:
          "No hosted provider key enters frontend, logs, or Git history.",
        steps: [
          {
            detail: "SDK stores local endpoint settings on the device.",
            label: "Local config",
            metric: "device",
          },
          {
            detail:
              "Gateway rejects hosted end-user BYOK unless explicitly opted in.",
            label: "BYOK boundary",
            metric: "opt-in",
          },
          {
            detail: "Request metadata remains attribution-only.",
            label: "Metadata only",
            metric: "no prompt logs",
          },
          {
            detail:
              "Privacy hooks can tombstone app-owned end-user identifiers.",
            label: "Retention",
            metric: "tombstone",
          },
          {
            detail: "Operators still see usage shape without private content.",
            label: "Console",
            metric: "visible",
          },
        ],
      },
    ],
    security: {
      eyebrow: "Non-negotiable boundaries",
      items: [
        "Provider keys never ship to SDK, frontend, mobile apps, logs, or Git history.",
        "Every LLM request carries app, channel, end user, use case, and mode.",
        "Every successful billable call writes one usage event.",
        "Every money movement writes balanced ledger entries.",
        "Faucet grants include balance, allowlists, daily cap, and expiration.",
      ],
      title: "Security and accounting are product features.",
    },
  },
  zh: {
    brand: {
      logoAlt: "智泉层标识组合",
      visualBody:
        "页面直接使用透明底矢量标识，不放入图片底板，因此标识可以自然落在页面表面，不产生白色或灰色块差。",
      visualKicker: "透明矢量识别",
      visualTitle: "官方图形、字标和组合标识直接进入页面。",
    },
    capabilities: {
      eyebrow: "先交付什么",
      items: [
        {
          label: "路由策略",
          text: "模型别名映射到服务端模型、白名单和花费上限。",
        },
        {
          label: "水龙头和钱包",
          text: "赠送额度优先支付，钱包为可计费调用提供资金且不允许透支。",
        },
        {
          label: "元数据观测",
          text: "事件、轨迹和指标只呈现成本与路由形态，不记录提示词和输出内容。",
        },
        {
          label: "结算导出",
          text: "账期报表生成稳定的表格文件和对账哈希。",
        },
      ],
      title: "先做分发基础件，再做聊天界面。",
    },
    deploy: {
      copy: "站点先通过代码托管自动化发布到仓库页面地址。等 AiFund 域名解析准备好后，可把 fountlayer.aifund.com 指向静态页面服务，并把站点基础路径切到根路径。",
      eyebrow: "静态发布",
      steps: [
        {
          label: "构建产物",
          value: "apps/site/dist",
        },
        {
          label: "发布流程",
          value: "代码托管自动化",
        },
        {
          label: "运行密钥",
          value: "不需要",
        },
      ],
      title: "默认静态发布，域名就绪后再切换。",
    },
    event: {
      label: "用量事件",
      retailLabel: "零售价",
    },
    footer: {
      link: "查看源码",
      text: "开源大模型最后一公里分发层。",
    },
    hero: {
      copy: "开源大模型最后一公里分发层。先把归因、水龙头额度、计量、路由和账本记录接好，再让应用获得模型能力，服务商密钥始终留在服务端。",
      eyebrow: "开源基础设施",
      metrics: [
        {
          label: "当前里程碑",
          value: "0.5 基础版",
        },
        {
          label: "验证测试",
          value: "108 项通过",
        },
        {
          label: "服务商密钥",
          value: "仅服务端",
        },
      ],
      primaryCta: "运行闭环",
      secondaryCta: "查看发布",
      title: "智泉层",
    },
    intro: {
      body: "智泉层专注应用体验和模型服务商之间的运营层：谁发起请求，来自哪个渠道，由谁付费，走了哪条模型路由，以及资金流如何对账。",
      eyebrow: "为什么存在",
      imageAlt:
        "智泉层系统图，连接开发包、网关、适配器、计量、水龙头、账本和控制台。",
      title: "应用需要大模型分发层，而不是又一个通用聊天框。",
    },
    language: {
      aria: "语言",
      options: {
        en: "英文",
        zh: "中文",
      },
    },
    ledger: {
      amount: "金额",
      direction: "方向",
      rowsAria: "账本行",
      wallet: "钱包",
    },
    loop: {
      aria: "场景",
      copy: "这个模拟器使用本地样例数据，展示一次请求如何从归因进入用量事件和账本分录。",
      eyebrow: "交互模型",
      processing: "处理中",
      replay: "重放闭环",
      reset: "重置",
      runNext: "运行下一步",
      tabsAria: "场景",
      title: "不接触真实密钥，也能跑通最后一公里请求。",
    },
    metaDescription: "智泉层是开源大模型最后一公里分发层。",
    metaTitle: "智泉层 | 开源大模型最后一公里分发层",
    nav: {
      brand: "品牌",
      deploy: "发布",
      github: "源码",
      loop: "闭环",
      scenarios: "场景",
      security: "边界",
    },
    scenarios: [
      {
        channel: "桌面阅读器渠道",
        description:
          "应用为新读者提供赞助摘要，智泉层负责归因、成本、用量和水龙头余额。",
        event: {
          appId: "阅读器应用",
          mode: "托管模式",
          retail: "0.0034 美元",
          useCase: "论文摘要",
        },
        ledger: [
          {
            amount: "0.0034 美元",
            direction: "debit",
            directionLabel: "支出",
            reason: "零售扣款",
            wallet: "新读者水龙头钱包",
          },
          {
            amount: "0.0034 美元",
            direction: "credit",
            directionLabel: "收入",
            reason: "平台收入",
            wallet: "平台收入钱包",
          },
          {
            amount: "0.0021 美元",
            direction: "debit",
            directionLabel: "支出",
            reason: "服务商成本",
            wallet: "平台成本钱包",
          },
          {
            amount: "0.0021 美元",
            direction: "credit",
            directionLabel: "收入",
            reason: "服务商应付",
            wallet: "服务商应付钱包",
          },
        ],
        name: "阅读器水龙头",
        outcome: "1 条用量事件，4 条账本分录，赠送余额剩余 0.9966 美元",
        steps: [
          {
            detail: "开发包发送应用、渠道、终端用户、用途和模式。",
            label: "请求归因",
            metric: "5 项字段",
          },
          {
            detail: "网关解析论文摘要路由和价格。",
            label: "路由估算",
            metric: "0.0034 美元",
          },
          {
            detail: "水龙头赠额通过模型白名单、用途上限和到期校验。",
            label: "水龙头检查",
            metric: "有效",
          },
          {
            detail: "适配器返回用量，服务商密钥不进入前端。",
            label: "适配调用",
            metric: "本地演示",
          },
          {
            detail: "用量和账本记录只写入一次。",
            label: "计量入账",
            metric: "1 加 4",
          },
        ],
      },
      {
        channel: "客服插件渠道",
        description:
          "软件服务商为支持问答付费，同时把花费、路由和归因留在客户应用之外。",
        event: {
          appId: "客服应用",
          mode: "开发者密钥模式",
          retail: "0.0187 美元",
          useCase: "支持问答",
        },
        ledger: [
          {
            amount: "0.0187 美元",
            direction: "debit",
            directionLabel: "支出",
            reason: "零售扣款",
            wallet: "开发者活动钱包",
          },
          {
            amount: "0.0131 美元",
            direction: "credit",
            directionLabel: "收入",
            reason: "开发者毛利",
            wallet: "客服应用钱包",
          },
          {
            amount: "0.0039 美元",
            direction: "credit",
            directionLabel: "收入",
            reason: "渠道佣金",
            wallet: "客服伙伴钱包",
          },
          {
            amount: "0.0017 美元",
            direction: "credit",
            directionLabel: "收入",
            reason: "平台收入",
            wallet: "平台收入钱包",
          },
        ],
        name: "软件插件渠道",
        outcome: "归因把应用花费和渠道佣金分开。",
        steps: [
          {
            detail: "插件为一次支持流程开启限定会话。",
            label: "限定会话",
            metric: "24 小时",
          },
          {
            detail: "网关选择带最高零售价的路由策略。",
            label: "花费护栏",
            metric: "0.025 美元上限",
          },
          {
            detail: "开发者凭据留在服务端加密存放。",
            label: "凭据边界",
            metric: "仅服务端",
          },
          {
            detail: "成功回答会形成一条用量事件。",
            label: "用量事件",
            metric: "成功",
          },
          {
            detail: "伙伴佣金和收入写入账本钱包。",
            label: "可结算",
            metric: "平衡",
          },
        ],
      },
      {
        channel: "本地工作站",
        description:
          "高阶用户可以把开发包指向本地模型端点，同时保留归因和产品体验。",
        event: {
          appId: "私有研究桌面",
          mode: "本地模式",
          retail: "0.0000 美元",
          useCase: "私有笔记",
        },
        ledger: [
          {
            amount: "0.0000 美元",
            direction: "debit",
            directionLabel: "支出",
            reason: "本地执行",
            wallet: "本地用户钱包",
          },
          {
            amount: "0.0000 美元",
            direction: "credit",
            directionLabel: "收入",
            reason: "本地执行",
            wallet: "本地模型钱包",
          },
        ],
        name: "本地或自带密钥",
        outcome: "托管服务商密钥不会进入前端、日志或代码历史。",
        steps: [
          {
            detail: "开发包把本地端点设置保存在设备上。",
            label: "本地配置",
            metric: "设备",
          },
          {
            detail: "网关默认拒绝托管终端用户自带密钥，除非明确开启。",
            label: "自带密钥边界",
            metric: "需开启",
          },
          {
            detail: "请求元数据只用于归因。",
            label: "仅元数据",
            metric: "不记内容",
          },
          {
            detail: "隐私钩子可以清除应用侧终端用户标识。",
            label: "保留策略",
            metric: "可清除",
          },
          {
            detail: "运营者仍可看到用量形态，不接触私有内容。",
            label: "控制台",
            metric: "可见",
          },
        ],
      },
    ],
    security: {
      eyebrow: "不可妥协的边界",
      items: [
        "服务商密钥绝不进入开发包、前端、移动应用、日志或代码历史。",
        "每次模型请求都携带应用、渠道、终端用户、用途和模式。",
        "每次成功的可计费调用都写入一条用量事件。",
        "每一笔资金移动都写入平衡的账本分录。",
        "水龙头赠额必须有余额、模型白名单、用途白名单、每日上限和到期时间。",
      ],
      title: "安全和账务本身就是产品能力。",
    },
  },
} satisfies Record<Language, SiteCopy>;

const capabilityIcons = [Route, Wallet, Activity, GitBranch] as const;
const languageOptions = ["en", "zh"] as const;

function getInitialLanguage(): Language {
  if (typeof globalThis.location !== "undefined") {
    const requested = new globalThis.URLSearchParams(
      globalThis.location.search,
    ).get("lang");

    if (requested === "zh" || requested === "en") {
      return requested;
    }
  }

  if (
    typeof globalThis.navigator !== "undefined" &&
    globalThis.navigator.language.toLowerCase().startsWith("zh")
  ) {
    return "zh";
  }

  return "en";
}

function updateMetaTag(selector: string, content: string) {
  const element = globalThis.document?.querySelector(selector);

  if (element && "content" in element) {
    (element as HTMLMetaElement).content = content;
  }
}

export function App() {
  const [language, setLanguage] = useState<Language>(getInitialLanguage);
  const [activeScenario, setActiveScenario] = useState(0);
  const [activeStep, setActiveStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof globalThis.setTimeout> | undefined>(
    undefined,
  );
  const t = copy[language];
  const scenario = t.scenarios[activeScenario] ?? t.scenarios[0];
  const visibleSteps = scenario.steps.slice(0, activeStep + 1);
  const isComplete = activeStep === scenario.steps.length - 1;

  useEffect(() => {
    if (typeof globalThis.document === "undefined") {
      return;
    }

    globalThis.document.documentElement.lang =
      language === "zh" ? "zh-CN" : "en";
    globalThis.document.title = t.metaTitle;
    updateMetaTag('meta[name="description"]', t.metaDescription);
    updateMetaTag('meta[property="og:title"]', t.metaTitle);
    updateMetaTag('meta[property="og:description"]', t.metaDescription);
    updateMetaTag('meta[name="twitter:title"]', t.metaTitle);
    updateMetaTag('meta[name="twitter:description"]', t.metaDescription);

    if (typeof globalThis.location !== "undefined") {
      const params = new globalThis.URLSearchParams(globalThis.location.search);
      params.set("lang", language);
      const query = params.toString();
      const nextUrl = `${globalThis.location.pathname}?${query}${globalThis.location.hash}`;
      globalThis.history.replaceState(null, "", nextUrl);
    }
  }, [language, t.metaDescription, t.metaTitle]);

  useEffect(
    () => () => {
      if (timerRef.current) {
        globalThis.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  function selectLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    setActiveScenario(0);
    setActiveStep(0);
    setIsRunning(false);
  }

  function selectScenario(index: number) {
    setActiveScenario(index);
    setActiveStep(0);
    setIsRunning(false);
  }

  function runNextStep() {
    if (isRunning) {
      return;
    }

    setIsRunning(true);
    timerRef.current = globalThis.setTimeout(() => {
      setActiveStep((current) =>
        current >= scenario.steps.length - 1 ? 0 : current + 1,
      );
      setIsRunning(false);
    }, 420);
  }

  function resetLoop() {
    setActiveStep(0);
    setIsRunning(false);
  }

  return (
    <div className="site-shell">
      <header className="topbar" aria-label="Primary navigation">
        <a className="brand-mark" href="#top" aria-label={t.brand.logoAlt}>
          <img alt={t.brand.logoAlt} src={logoLockupUrl} />
        </a>
        <nav className="nav-links" aria-label="Page sections">
          <a href="#brand">{t.nav.brand}</a>
          <a href="#loop">{t.nav.loop}</a>
          <a href="#scenarios">{t.nav.scenarios}</a>
          <a href="#security">{t.nav.security}</a>
          <a href="#deploy">{t.nav.deploy}</a>
        </nav>
        <div className="topbar-actions">
          <div className="language-switch" aria-label={t.language.aria}>
            {languageOptions.map((option) => (
              <button
                aria-pressed={language === option}
                key={option}
                onClick={() => selectLanguage(option)}
                type="button"
              >
                {t.language.options[option]}
              </button>
            ))}
          </div>
          <a
            className="nav-action"
            href="https://github.com/HiClawBot/FountLayer"
            rel="noreferrer"
            target="_blank"
          >
            <Code size={18} aria-hidden="true" />
            {t.nav.github}
          </a>
        </div>
      </header>

      <main id="top">
        <section className="hero">
          <div className="hero-grid">
            <div className="hero-content">
              <p className="eyebrow">{t.hero.eyebrow}</p>
              <h1>{t.hero.title}</h1>
              <p className="hero-copy">{t.hero.copy}</p>
              <div className="hero-actions">
                <a className="button primary" href="#loop">
                  <Play size={18} aria-hidden="true" />
                  {t.hero.primaryCta}
                </a>
                <a className="button secondary" href="#deploy">
                  <BookOpen size={18} aria-hidden="true" />
                  {t.hero.secondaryCta}
                </a>
              </div>
              <dl className="hero-metrics">
                {t.hero.metrics.map((metric) => (
                  <div key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="identity-stage" id="brand">
              <img
                alt=""
                aria-hidden="true"
                className="identity-mark"
                src={logoMarkUrl}
              />
              <img
                alt={t.brand.logoAlt}
                className="identity-lockup"
                src={logoLockupUrl}
              />
              <div className="identity-note">
                <p className="section-kicker">{t.brand.visualKicker}</p>
                <h2>{t.brand.visualTitle}</h2>
                <p>{t.brand.visualBody}</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section intro-band" aria-label="Positioning">
          <div className="section-kicker">{t.intro.eyebrow}</div>
          <div className="intro-grid">
            <div>
              <h2>{t.intro.title}</h2>
              <p>{t.intro.body}</p>
            </div>
            <figure className="system-map">
              <img alt={t.intro.imageAlt} src={systemMapUrl} />
            </figure>
          </div>
        </section>

        <section className="section loop-section" id="loop">
          <div className="section-header">
            <div>
              <p className="section-kicker">{t.loop.eyebrow}</p>
              <h2>{t.loop.title}</h2>
            </div>
            <p>{t.loop.copy}</p>
          </div>

          <div
            className="scenario-tabs"
            role="tablist"
            aria-label={t.loop.tabsAria}
          >
            {t.scenarios.map((item, index) => (
              <button
                aria-selected={index === activeScenario}
                className="scenario-tab"
                key={item.name}
                onClick={() => selectScenario(index)}
                role="tab"
                type="button"
              >
                {item.name}
              </button>
            ))}
          </div>

          <div className="lab-layout" id="scenarios">
            <article className="lab-panel simulator-panel">
              <div className="panel-topline">
                <div>
                  <span className="status-dot" />
                  <span>{scenario.channel}</span>
                </div>
                <span>{scenario.event.mode}</span>
              </div>
              <h3>{scenario.name}</h3>
              <p>{scenario.description}</p>

              <div className="step-stack">
                {visibleSteps.map((item, index) => (
                  <div
                    className={index === activeStep ? "step active" : "step"}
                    key={item.label}
                    style={{ ["--step-index" as string]: index }}
                  >
                    <span className="step-number">{index + 1}</span>
                    <div>
                      <strong>{item.label}</strong>
                      <p>{item.detail}</p>
                    </div>
                    <span className="step-metric">{item.metric}</span>
                  </div>
                ))}
              </div>

              <div className="lab-actions">
                <button
                  className="button primary"
                  disabled={isRunning}
                  onClick={runNextStep}
                  type="button"
                >
                  <ArrowRight size={18} aria-hidden="true" />
                  {isRunning
                    ? t.loop.processing
                    : isComplete
                      ? t.loop.replay
                      : t.loop.runNext}
                </button>
                <button
                  className="icon-button"
                  onClick={resetLoop}
                  type="button"
                >
                  <RefreshCcw size={18} aria-hidden="true" />
                  <span>{t.loop.reset}</span>
                </button>
              </div>
            </article>

            <aside className="lab-panel ledger-panel" aria-live="polite">
              <div className="event-card">
                <FileText size={20} aria-hidden="true" />
                <div>
                  <span>{t.event.label}</span>
                  <strong>{scenario.event.appId}</strong>
                  <p>
                    {scenario.event.useCase} · {t.event.retailLabel}{" "}
                    {scenario.event.retail}
                  </p>
                </div>
              </div>

              <div
                className="ledger-table"
                role="table"
                aria-label={t.ledger.rowsAria}
              >
                <div className="ledger-row ledger-head" role="row">
                  <span>{t.ledger.direction}</span>
                  <span>{t.ledger.wallet}</span>
                  <span>{t.ledger.amount}</span>
                </div>
                {scenario.ledger.map((row) => (
                  <div
                    className="ledger-row"
                    key={`${row.wallet}-${row.reason}`}
                  >
                    <span className={`pill ${row.direction}`}>
                      {row.directionLabel}
                    </span>
                    <span>
                      <strong>{row.reason}</strong>
                      <small>{row.wallet}</small>
                    </span>
                    <span>{row.amount}</span>
                  </div>
                ))}
              </div>
              <p className="outcome">{scenario.outcome}</p>
            </aside>
          </div>
        </section>

        <section className="section capability-section">
          <div className="section-header compact">
            <div>
              <p className="section-kicker">{t.capabilities.eyebrow}</p>
              <h2>{t.capabilities.title}</h2>
            </div>
          </div>
          <div className="capability-grid">
            {t.capabilities.items.map((item, index) => {
              const Icon = capabilityIcons[index] ?? Route;

              return (
                <article className="capability" key={item.label}>
                  <Icon size={22} strokeWidth={1.8} aria-hidden="true" />
                  <h3>{item.label}</h3>
                  <p>{item.text}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="section security-section" id="security">
          <div>
            <p className="section-kicker">{t.security.eyebrow}</p>
            <h2>{t.security.title}</h2>
          </div>
          <div className="invariant-list">
            {t.security.items.map((item) => (
              <div className="invariant" key={item}>
                <ShieldCheck size={20} strokeWidth={1.8} aria-hidden="true" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="section deploy-section" id="deploy">
          <div className="deploy-copy">
            <p className="section-kicker">{t.deploy.eyebrow}</p>
            <h2>{t.deploy.title}</h2>
            <p>{t.deploy.copy}</p>
          </div>
          <div className="deploy-steps">
            {t.deploy.steps.map((step, index) => {
              const icons = [Database, CircuitBoard, KeyRound] as const;
              const Icon = icons[index] ?? Database;

              return (
                <div key={step.label}>
                  <Icon size={20} aria-hidden="true" />
                  <span>{step.label}</span>
                  <strong>{step.value}</strong>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      <footer className="footer">
        <div>
          <strong>{t.hero.title}</strong>
          <span>{t.footer.text}</span>
        </div>
        <a
          href="https://github.com/HiClawBot/FountLayer"
          rel="noreferrer"
          target="_blank"
        >
          {t.footer.link}
        </a>
      </footer>
    </div>
  );
}
