# Elitaco Integration Service

WooCommerce 与 Odoo 之间的中间层服务，处理事件同步、队列、幂等。

## 功能

- WooCommerce Webhook 接收与验签
- 事件队列处理 (Redis + RQ)
- Odoo API 调用
- 幂等处理
- 死信队列

## 快速开始

```bash
# 安装依赖
pip install -r requirements.txt

# 本地运行
cp .env.example .env
# 编辑 .env 配置

# 启动服务
python src/main.py

# 或使用 Docker
docker-compose up -d
```

## 环境变量

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/integration

# Redis
REDIS_URL=redis://localhost:6379/0

# Odoo
ODOO_URL=http://odoo:7069
ODOO_DB=odoo
ODOO_USERNAME=admin@elitaco.my
ODOO_PASSWORD=admin
ODOO_API_KEY=your_api_key

# WooCommerce
WOO_WEBHOOK_SECRET=your_woo_secret
WOO_STORE_URL=https://your-store.com
WOO_CONSUMER_KEY=ck_xxx
WOO_CONSUMER_SECRET=cs_xxx

# App
APP_SECRET=your_app_secret
LOG_LEVEL=INFO
```

## 事件列表

详见 [docs/events.md](docs/events.md)

## API

| 端点 | 方法 | 说明 |
|------|------|------|
| /health | GET | 健康检查 |
| /webhook/woo | POST | Woo Webhook 入口 |
| /api/orders/:id/timeline | GET | 订单时间线 |

## 事件契约

```json
{
  "event_id": "uuid",
  "event_type": "woo.order.created",
  "source": "woo",
  "occurred_at": "2026-02-20T10:00:00Z",
  "idempotency_key": "woo:123:order.created:456",
  "trace_id": "uuid",
  "data": { ... }
}
```

## 幂等策略

- 每次事件处理前检查 `idempotency_key`
- 已处理的事件直接返回成功
- 死信: 3次重试后进入死信队列

## 测试

```bash
# 单元测试
pytest tests/unit/

# 合同测试
pytest tests/contract/

# 本地运行
docker-compose run --rm api pytest
```

## 目录结构

```
integration-service/
├── src/
│   ├── main.py              # FastAPI 入口
│   ├── config.py            # 配置
│   ├── models/              # 数据模型
│   │   ├── event.py         # 事件模型
│   │   └── mapping.py      # 映射表
│   ├── handlers/            # 事件处理器
│   │   ├── woo_handler.py   # Woo 事件
│   │   └── odoo_handler.py # Odoo 事件
│   ├── queue/               # RQ 队列
│   │   └── worker.py        # 队列 worker
│   └── db/                  # 数据库迁移
│       └── migrations/
├── docs/
│   ├── events.md            # 事件说明
│   └── schemas/             # JSON Schema
├── tests/
│   ├── unit/                # 单元测试
│   └── contract/            # 合同测试
├── docker-compose.yml
├── Dockerfile
├── requirements.txt
└── README.md
```

## 部署

### Docker

```bash
# 开发
docker-compose up -d

# 生产
docker-compose -f docker-compose.prod.yml up -d
```

### Kubernetes (可选)

详见 `k8s/` 目录
