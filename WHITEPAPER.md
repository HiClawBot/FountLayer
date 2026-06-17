# FountLayer 白皮书

**开源 LLM 最后一公里分发层**  
版本：v0.1 Draft  
日期：2026-06-17  
中文名建议：**智泉层**  
英文标语：**The open LLM last-mile distribution layer for apps.**

> FountLayer 不是另一个聊天机器人，也不是简单的 API 中转站。它是一层面向应用开发者、垂直软件、终端用户和模型供应商的 AI 能力分发基础设施：让任何软件都能安全接入托管模型、开发者自有模型线路、用户 BYOK 和本地模型，并通过 credits、水龙头、token 计量、渠道归因和分润账本形成商业闭环。

---

## 1. 执行摘要

大模型 API 已经成为基础能力，但它仍然没有真正进入大量垂直软件的“最后一公里”。大量普通用户不知道什么是 API key，不知道如何购买、配置、限额和换模型；大量软件开发者也不想从零开始实现模型路由、用量计费、Key 安全、免费额度、账本、渠道结算和本地模型接入。

FountLayer 的目标是把这些复杂能力做成一个可开源、可自托管、可托管商业化的模块体系。任何软件集成 FountLayer SDK 后，都可以为终端用户提供四种 AI 使用模式：

1. **Managed**：用户不填 API key，通过平台托管网关无感使用 LLM。
2. **Developer Key**：软件开发者配置自己的模型 API key 和二次定价策略。
3. **BYOK**：终端用户填写自己的 API key，可选择本地保存或加密托管。
4. **Local / LAN**：终端用户接入本机或局域网模型服务。

FountLayer 的商业核心不是“转卖 API key”，而是“应用内 AI 能力运营层”：它提供 app/channel/use-case 归因、水龙头 credits、价格策略、用量事件、双分录账本、渠道分润和预算风控，让每一款垂直软件都能成为 AI token 流动的最后一公里渠道。

---

## 2. 为什么需要 FountLayer

今天的大模型生态有三个断层。

**第一，终端用户体验断层。** 普通用户愿意在 PDF 阅读器、写作软件、CRM、IDE、表格工具、学习软件中直接使用 AI，但不愿意理解 API key、base URL、模型价格、token、上下文长度和限额。

**第二，开发者商业化断层。** 应用开发者想给软件加 AI，但 AI 调用不是一个纯技术功能。它涉及成本预估、余额扣减、免费额度、账本、渠道分润、退款、风控、供应商 key 安全和合规文案。许多团队可以调用一次 LLM，却很难把它变成可运营的应用内服务。

**第三，模型分发断层。** 模型供应商拥有推理能力，但很难触达每一个垂直场景。通用模型市场解决了“哪里买模型”的问题，却没有解决“模型如何进入每个软件的具体功能”的问题。

FountLayer 试图解决这三个断层：让用户无感使用，让开发者低成本接入，让软件渠道获得 token 流动利润，让模型供应商拥有更细粒度的场景分发渠道。

---

## 3. 产品定义

FountLayer 是一组开源协议、SDK、网关服务、账本模块和开发者控制台。

它的第一性原理是：

> **token 流是可计量的，模型能力是可路由的，软件渠道是可归因的，免费额度是可控的，利润分配必须可审计。**

FountLayer 不应该把真实模型供应商 API key 写进 SDK、前端或开源仓库。所有供应商 key 必须只存在于服务端网关或用户本地安全环境中。SDK 拿到的是 FountLayer 签发的 app token、session token 或本地 BYOK 配置。

### 3.1 适用对象

- 垂直软件：PDF 阅读器、笔记软件、写作工具、财务软件、教育软件、医疗文书、法律检索、企业知识库、CRM、设计工具、IDE 插件。
- AI 应用开发者：希望快速集成多模型、计费、额度、BYOK 和本地模型。
- 模型供应商：希望以 campaign、credits 或特定 use-case 的方式分发模型能力。
- 开源社区：希望自托管一个安全、透明、可改造的 LLM 接入层。

### 3.2 不适合做什么

- 不做裸 API key 倒卖。
- 不做无风控无限免费 token。
- 不把供应商 key 暴露给终端用户或客户端。
- 不把所有模型一刀切默认 2 倍加价。
- 不以聊天界面作为产品核心，而是以 SDK、网关和账本为核心。

---

## 4. 项目命名

推荐项目名：**FountLayer**。

含义：

- **Fount**：源泉、泉眼，呼应“水龙头 credits”和 AI 能力源头。
- **Layer**：基础设施层，不是单一应用，而是可嵌入任何软件的分发层。
- 中文名：**智泉层**，可用于中文白皮书、官网和社区传播。

对外一句话：

> FountLayer is an open-source LLM last-mile distribution layer that turns any app into a safe, metered, revenue-sharing AI channel.

中文一句话：

> FountLayer 是面向应用的开源 LLM 最后一公里分发层，让任何软件都能安全接入 AI，并通过 credits、水龙头、token 计量和渠道分润完成商业闭环。

---

## 5. 核心能力

### 5.1 多模式模型接入

FountLayer 把四类模型线路统一成 `Credential + Route + Pricing Policy`。

| 模式          | 谁提供能力                  | 用户体验                     | 计费方式                     | 关键风险                    |
| ------------- | --------------------------- | ---------------------------- | ---------------------------- | --------------------------- |
| Managed       | FountLayer 平台或自托管网关 | 用户不填 key，直接使用       | credits/钱包/套餐            | 平台承担 key 安全和滥用风险 |
| Developer Key | 应用开发者                  | 用户使用开发者配置的 AI 能力 | 开发者定价                   | 开发者成本控制和 key 安全   |
| BYOK          | 终端用户                    | 用户填自己的 key             | 用户自付上游费用，可收网关费 | key 托管信任问题            |
| Local / LAN   | 用户本地或企业内网          | 本地模型、隐私优先           | 不按 token 收模型成本        | 性能和兼容性不稳定          |

### 5.2 水龙头 Faucet Grants

水龙头不是无限免费 token，而是受控的 credits grant。每个 grant 都有 sponsor、额度、模型白名单、use-case 白名单、日上限、有效期和渠道归因。

典型类型：

- 平台新用户 grant：用于体验转化。
- 开发者赞助 grant：软件开发者充值，让自己的用户免费试用。
- 渠道活动 grant：特定分销渠道带来的用户获得试用额度。
- 模型供应商 grant：模型厂商赞助特定模型或场景的试用池。

### 5.3 Token 级账本

每一次请求都会生成 `usage_event`，每一次费用变化都会生成 `ledger_entry`。账本要能还原：

- input/output/cached tokens；
- 上游模型成本；
- 批发价；
- 用户零售价；
- 平台服务费；
- 开发者加价；
- 渠道佣金；
- 水龙头补贴；
- 退款或失败扣减。

只有 token 流和钱流都可追踪，FountLayer 才能支撑长期可信的渠道分润。

### 5.4 渠道归因

任何应用、插件、SaaS、桌面软件、浏览器扩展都可以注册 `app_id` 和 `channel_id`。每次调用都携带：

```http
x-fl-app-id: app_pdf_reader
x-fl-channel-id: channel_desktop
x-fl-end-user-id: user_hash_123
x-fl-use-case: paper_summary
x-fl-mode: managed
```

这些字段是 token 分润的基础，也是风控、统计、预算和模型路由的依据。

---

## 6. 系统架构

第一版建议采用：

```txt
自研核心业务层 + LiteLLM 网关适配 + OpenMeter/Lago 可插拔计量账单层
```

LiteLLM 适合作为 LLM provider adapter 和 gateway sidecar，FountLayer 则保留自己的 app/channel/faucet/ledger/pricing 核心。OpenMeter 和 Lago 不作为强依赖，而作为后续可选集成：OpenMeter 处理更复杂的实时用量限制和 entitlement，Lago 处理更复杂的发票、订阅、预付费和企业账单。

```txt
App / Plugin / SaaS
  ↓
FountLayer SDK / Widget
  ↓
Gateway API
  ↓
Auth + Attribution
  ↓
Faucet Engine
  ↓
Pricing + Budget Guard
  ↓
Route Engine
  ↓
LLM Adapter: LiteLLM / BYOK / Local
  ↓
Usage Events
  ↓
Ledger Entries
  ↓
Console / Settlement / Billing
```

---

## 7. 价格与分润模型

FountLayer 不建议默认所有模型 2 倍加价。合理模型应该拆分成本和利润：

```txt
upstream_cost = input_tokens × input_price + output_tokens × output_price

wholesale_price = upstream_cost
                + platform_fee
                + payment_fee_reserve
                + risk_reserve

retail_price = wholesale_price
             + developer_markup
             + channel_markup

channel_commission = gross_margin × commission_rate
```

建议默认策略：

- Managed 批发价：上游成本 + 20% 到 35% 平台服务费。
- 开发者加价：默认 0%，可配置 0% 到 100%。
- BYOK 本地直连：不收 token 差价，可收高级功能订阅费。
- BYOK 云端托管：可收 0% 到 5% 网关/观测费。
- Local / LAN：不收模型 token 费，可收 SDK、控制台或企业支持费用。

用户侧要展示预计费用和余额，开发者后台要展示成本、收入、毛利和分润。

---

## 8. MVP 范围

第一版只做“完整闭环”，不做所有高级能力。

### 必须完成

1. TypeScript SDK。
2. Gateway API。
3. LiteLLM adapter。
4. OpenAI-compatible local endpoint adapter。
5. Managed、Developer Key、BYOK、Local 四种模式的接口骨架。
6. Faucet grants。
7. Usage events。
8. Ledger entries。
9. 开发者控制台最小版。
10. PDF Reader AI demo。
11. Docker Compose 自托管启动。
12. GitHub README、白皮书、施工文档、安全文档。

### 暂不完成

- 提现和税务结算。
- 模型供应商 marketplace。
- 企业 SSO/RBAC。
- 移动端 SDK。
- 高级风控模型。
- 全量 provider 深度适配。

---

## 9. 开源策略

建议采用 Open Core。

### 开源部分

- SDK。
- 协议 schema。
- 基础 Gateway。
- 本地模型 adapter。
- BYOK 本地模式。
- 基础 Faucet Engine。
- 基础 Ledger Engine。
- Docker Compose。
- Demo 应用。

许可证建议：

- SDK：MIT 或 Apache-2.0。
- 基础 Gateway：Apache-2.0。
- 协议 schema：Apache-2.0。
- Demo：MIT。

### 云服务增强

- 托管 key 池。
- 高级风控。
- 支付、发票和提现。
- 渠道分润结算。
- 模型供应商 campaign 市场。
- 企业审计和 SLA。

---

## 10. 安全与合规原则

FountLayer 的安全底线是：**Provider API key 永远不进入客户端和开源仓库。**

必须从第一版实现：

- 真实 provider key 只存服务端或用户本地安全环境。
- 服务端 key 使用 KMS/Vault 或等价机制加密。
- 每个 app、channel、end user、grant 都有预算上限。
- 高价模型默认关闭，需要显式启用。
- 流式输出也要支持预算中断。
- 所有财务变动写入 ledger。
- 不记录敏感 prompt，或默认只记录 usage metadata。
- BYOK 默认本地保存，云端托管必须明确告知。

产品叙事也必须清晰：FountLayer 提供应用能力网关、计量、credits、风控和分润，而不是出售或出租上游 API key。

---

## 11. 第一个演示场景：PDF Reader AI

推荐第一个 demo 是 PDF Reader AI 插件，而不是通用聊天。

原因：PDF 是典型垂直场景，用户需求明确，AI 能力和当前软件功能高度匹配。

Demo 功能：

- 上传或打开 PDF。
- 总结全文。
- 提取大纲。
- 基于文档问答。
- 生成学习卡片。
- 显示预计费用。
- 新用户获得水龙头 credits。
- credits 用完后引导充值、BYOK 或 Local。
- 开发者后台看到该 app/channel/use-case 的 token 流量、成本、收入和毛利。

这个 demo 要证明一句话：

> 任何垂直软件都可以成为 AI token 的最后一公里分销渠道。

---

## 12. 路线图

### 阶段 A：文档和协议冻结

- README、白皮书、施工文档完成。
- 数据模型和核心 API 冻结。
- SDK 最小接口冻结。
- 安全底线冻结。

### 阶段 B：最小可运行闭环

- SDK 发起请求。
- Gateway 鉴权和归因。
- LiteLLM sidecar 调用模型。
- Usage event 落库。
- Faucet grant 扣减。
- Ledger entry 生成。
- Demo app 完成一次调用。

### 阶段 C：开发者可运营

- 控制台可创建 app/channel/faucet/pricing。
- 可看用量、成本、收入、毛利。
- 可配置 BYOK 和 Local。
- Docker Compose 一键自托管。

### 阶段 D：生态化

- Provider campaign。
- 渠道分润结算。
- OpenMeter/Lago adapter。
- 更多 SDK：Python、Swift、Kotlin、Flutter。
- 企业版能力。

---

## 13. 成功标准

FountLayer 第一版成功，不看接了多少模型，而看是否跑通以下闭环：

1. 一个第三方应用能在半小时内接入 SDK。
2. 终端用户无需 API key 即可使用 AI。
3. 终端用户可以切换 BYOK 或本地模型。
4. 每次调用都有 app/channel/use-case 归因。
5. 每次调用都有 usage event 和 ledger entry。
6. 水龙头 credits 能安全发放、限制和扣减。
7. 开发者能看到成本、收入和渠道分润。
8. 任何 provider key 都不会出现在客户端、前端包、移动端包、日志和仓库中。

---

## 14. 参考项目

FountLayer 可以借鉴但不完全等同于以下项目：

- LiteLLM：多模型网关、OpenAI-compatible proxy、virtual keys、spend tracking、routing。
- OpenMeter：usage metering、usage limits、entitlements。
- Lago：usage-based billing、subscription、hybrid pricing、prepaid credits。
- One API / New API：API 分发、额度、倍率、充值和渠道管理参考。
- Open WebUI / Dify：BYOK、本地模型和 provider 配置体验参考。

FountLayer 的核心差异在于：**面向任意软件的 SDK + 水龙头 credits + app/channel 归因 + token 级分润账本。**

---

## 15. 结语

AI 的下一波普及不会只发生在独立聊天产品中，而会发生在每一个垂直软件的具体功能里。FountLayer 要做的是把模型能力、用户体验、开发者收入和渠道分发连接起来。

它不是一个“模型入口”，而是一层“模型进入应用的分发协议”。

如果 FountLayer 成立，任何软件都可以安全、透明、可计量、可分润地成为 AI 能力的最后一公里。
