export const mermaidRenderFailureFixtures = [
  {
    name: "期权创建时序图使用 Mermaid 保留字 Opt 作为参与者别名",
    source: `sequenceDiagram
    participant Opt as 期权
    participant API as 对接API
    participant DB as 合约库

    Opt->>API: create(tradeDate,windCode,notional,relatedOption)
    API->>DB: 事务内簿记 2 笔 DRAFT
    alt 两笔都成功
        API-->>Opt: internalTradeIds[2]
    else 任一失败
        API->>DB: 回滚
        API-->>Opt: 失败
    end`
  },
  {
    name: "终止态重生成时序图使用 Mermaid 保留字 Opt 作为参与者别名",
    source: `sequenceDiagram
    participant Opt as 期权
    participant API as 对接API
    participant DB as 合约库
    participant K as Kafka
    participant C as 异步消费者
    participant RB as 资金回退
    participant Alert as 业务提醒

    Opt->>API: regenerate(..., relatedOption)
    API->>DB: 查关联为已终止
    API->>DB: 事务簿记新 2 笔草稿
    API-->>Opt: 同步返回新 internalTradeIds
    API->>K: 发 FUND_ROLLBACK(旧终止合约)
    Note over Opt,API: 接口已返回，不等待回退结果

    C->>K: 消费 FUND_ROLLBACK
    C->>RB: rollback(旧合约)
    alt 回退成功
        C->>C: 标记回退成功
    else 回退失败
        C->>C: 不重试下一步（无下一步）
        C->>C: 任务 MANUAL
        C->>Alert: 提醒业务人员手工介入
    end`
  }
] as const
