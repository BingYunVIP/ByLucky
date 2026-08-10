# ByLucky（冰云抽奖）V1 产品需求与开发规格

**文档用途：** 可直接交给 AI 编程工具或程序员作为 V1 开发基线  
**项目名：** ByLucky  
**中文名：** 冰云抽奖  
**目标环境：** Windows 11 本地开发/调试 → Linux VPS 正式部署  
**文档版本：** V1.0  
**状态：** 开发基线（Baseline）

---

## 0. 开发前必须锁定的核心结论

### 0.1 系统边界

ByLucky 是一个独立抽奖系统，与现有 AI 中转站完全解耦：

- AI 中转站负责生成并实际承兑 1、5、10、20、50、100 元面值兑换码。
- ByLucky 不调用 AI 中转站 API，不修改 AI 中转站兑换码状态，不校验 AI 中转站是否已经兑换。
- 管理员将允许参加某期抽奖的兑换码通过后台批量导入 ByLucky。
- ByLucky 仅依据本地导入的核实兑换码、全局抽奖使用记录和活动规则判断是否允许参与。
- 一张兑换码在 ByLucky 的所有活动中只能成功参与抽奖一次。

### 0.2 同一邮箱允许提交多张兑换码

本规则是 V1 的核心：

- 同一期活动中，同一个邮箱可以多次提交不同兑换码。
- 每一张兑换码仍只能使用一次。
- 同一邮箱提交多张兑换码后，仍只算 **1 个不同邮箱参与者**。
- 满 N 人的 N 永远按本期不同规范化邮箱数量计算，不按兑换码数量计算。

示例：

- `a@qq.com` 提交 1 元 + 50 元 → 本期累计面值 = 51 元，兑换码数量 = 2，参与人数贡献 = 1 人。
- `b@qq.com` 提交 10 张 1 元 → 本期累计面值 = 10 元，兑换码数量 = 10，参与人数贡献 = 1 人。

### 0.3 抽奖方式只有两种

#### A. 面值优先抽奖（默认）

每个邮箱的本期优先值：

`本期累计面值 = 该邮箱本期所有成功提交兑换码面值之和`

开奖时：

1. 排除中奖冷却中的邮箱。
2. 在剩余候选邮箱中找到“累计面值最高”的邮箱组。
3. 如果最高组只有 1 人，则该人获得当前奖品。
4. 如果最高组有多人，则只在这些同分邮箱中使用密码学安全随机数随机选择 1 人。
5. 该邮箱中奖后，从本期后续所有候选池中移除。
6. 继续下一个奖品；如果当前最高面值组已耗尽，则自动进入下一面值总额。

因此该算法不是传统按金额比例增加中奖概率的“权重随机”，而是 **金额优先 + 同金额随机**。

#### B. 每张兑换码等权

- 每一张本期已成功提交的兑换码 = 1 张等权抽奖票。
- 同一邮箱提交 10 张兑换码，就拥有 10 张票。
- 兑换码面值在此模式下不影响单张票权重。
- 每次选中一张票后，该票所属邮箱中奖。
- 该邮箱中奖后，立即移除该邮箱的所有其他票，保证一期最多中奖一次。

### 0.4 开奖条件与抽奖方式完全分离

开奖条件：

- 满 N 个不同邮箱自动开奖。
- 到指定日期时间自动开奖。
- 仅管理员手动开奖。

抽奖方式：

- 面值优先抽奖。
- 每张兑换码等权。

两者可任意组合。

### 0.5 一期最多一个进行中活动

系统允许提前创建多个草稿活动，但任意时刻最多只能存在一个 `ACTIVE`（进行中）活动。

### 0.6 同一期一个邮箱最多获得一个奖

一旦某邮箱在本期获奖，该邮箱必须立即从本期后续奖项候选池中移除。

### 0.7 中奖冷却

默认冷却为最近 3 个已完成抽奖活动：

- 某邮箱在第 20 期中奖。
- 第 21、22、23 个实际完成开奖的活动中可以继续参与，但不得进入中奖候选池。
- 第 24 个实际完成开奖的活动起重新允许中奖。
- 被取消、未开奖的活动不计入“最近 N 期已完成活动”。
- 冷却依据 `canonical_email` 判断。
- 默认值 3，可后台配置；活动开始时把当前值快照到活动规则中，之后修改全局默认不影响已开始活动。

### 0.8 用户前台展示参与进度

用户端允许展示：

- 本期活动名称与期号。
- 奖项公开说明及数量。
- 目标人数。
- 当前不同邮箱参与人数。
- 定时开奖活动的开奖时间。
- 开奖后的脱敏中奖邮箱和奖项。
- 往期获奖记录。

用户端不得展示：

- 面值优先算法细节。
- 每个邮箱累计面值。
- 最低参与面值规则。
- 冷却规则。
- 各面值剩余核实码数量。
- 后台抽奖配置。
- 中奖私密内容。

### 0.9 V1 对几个未明确边界的默认处理

为了可以直接开发，V1 采用以下明确行为：

- 定时开奖到点时，即使未达到“目标人数”，仍按实际参与者开奖；目标人数仅作为用户预期展示。若 0 人参与，则本次开奖失败并进入 `DRAW_FAILED`，等待管理员处理。
- 若可中奖邮箱数量少于奖品名额，系统给所有可中奖邮箱正常开奖，剩余奖品标记为“未发放：候选人不足”，不允许重复中奖补足名额。
- 达到满 N 个不同邮箱的瞬间，活动必须原子锁定；锁定之后所有新兑换码提交都拒绝，包括已经参与过的邮箱继续追加兑换码。
- 活动已经存在参与者后，V1 不允许管理员直接取消进行中活动，以避免“已使用兑换码是否返还抽奖资格”的复杂语义。零参与者的活动可以取消。
- V1 不做手机号、OAuth、实名或“同一真人”识别；身份单位只认规范化邮箱。

---

# 1. 产品目标

## 1.1 业务目标

ByLucky 用于配合 AI 中转站兑换码在闲鱼、淘宝等渠道的销售和引流：

1. 管理员从 AI 中转站生成兑换码。
2. 管理员在 ByLucky 某期活动后台导入允许参与的兑换码。
3. 用户购买兑换码后访问 ByLucky。
4. 用户输入邮箱 + 兑换码。
5. ByLucky 精确核实兑换码是否属于本期、是否未被抽奖使用。
6. 同一个邮箱可以持续追加兑换码并累加本期资格。
7. 达到开奖条件后自动或手动开奖。
8. 中奖结果写入数据库。
9. 私密奖品通过邮件发送给中奖者。
10. 公开页面只展示脱敏中奖信息和公开奖品说明。

## 1.2 V1 设计原则

- 单体应用优先，不做微服务。
- 单 VPS 可独立运行。
- PostgreSQL 作为唯一主数据库。
- 不依赖 Redis、Kafka、RabbitMQ。
- 后台任务使用同一个代码仓库中的独立 Worker 进程。
- 关键唯一性由 PostgreSQL 唯一约束兜底。
- 所有兑换码比较必须精确，不猜长度、不转大小写、不自动裁剪。
- 敏感核实码不明文落库。
- 奖品私密内容和 SMTP 密码应用层加密落库。
- 开奖结果不可因为邮件发送失败而回滚或重新抽奖。

## 1.3 V1 不做

- 用户注册/登录。
- 用户个人中心。
- 手机号验证。
- OAuth 登录。
- 实名认证。
- 支付系统。
- AI 中转站 API 联动。
- 多管理员/角色权限。
- 多活动同时进行。
- 多语言。
- App。
- 可验证区块链抽奖。
- Redis / MQ / Kubernetes。

---

# 2. 名词与数据口径

| 名词 | 定义 |
|---|---|
| 活动 Campaign | 一期抽奖 |
| 期号 issue_no | 系统自动递增的活动编号 |
| 核实兑换码 Campaign Code | 管理员导入、允许参加当前活动的兑换码哈希记录 |
| 已使用兑换码 Used Code | 已经成功用于 ByLucky 抽奖参与的全局兑换码记录 |
| 参与者 Participant | 某一期中的一个不同规范化邮箱 |
| 原始邮箱 original_email | 用户第一次成功提交时的实际邮箱字符串，用于发邮件 |
| 规范化邮箱 canonical_email | 用于判重和冷却的邮箱身份 |
| 本期累计面值 total_face_value | 一个邮箱在本期所有成功兑换码面值之和 |
| 本期码数 code_count | 一个邮箱本期成功提交的兑换码数量 |
| 奖项 Prize Tier | 一等奖、二等奖、三等奖等等级 |
| 奖品项 Prize Item | 获奖内容中的一行；一行 = 一个中奖名额 |
| 面值优先 | 累计面值从高到低优先，同面值随机 |
| 每张兑换码等权 | 每个成功使用的码是一张随机票 |
| 冷却 | 最近 N 个已完成活动中过奖的邮箱，本期可参与但不可中奖 |

所有参与人数统计必须使用：

`COUNT(DISTINCT canonical_email)`

实际实现中应直接统计 `campaign_participants` 行数，因为该表已经保证 `(campaign_id, canonical_email)` 唯一。

---

# 3. 用户角色与权限

## 3.1 普通用户

无需注册、无需登录。

允许：

- 查看当前活动公开信息。
- 查看当前不同邮箱参与人数/目标人数。
- 提交邮箱 + 兑换码。
- 同一邮箱继续提交其他未使用兑换码。
- 查看本期开奖结果。
- 查看往期中奖记录。

禁止：

- 查看完整中奖邮箱。
- 查看获奖私密内容。
- 查看兑换码面值优先规则。
- 查看某邮箱累计面值/码数。
- 查看核实码库存。
- 查看后台设置。

## 3.2 管理员

V1 只有一个管理员账号，由环境变量配置。

允许访问 `/admin`，包含：

- 总览。
- 邮箱配置。
- 抽奖配置。
- 活动列表。
- 获奖记录。
- 运维记录。
- SMTP 和模板。
- 邮件发送队列。
- 系统默认配置。

---

# 4. 活动生命周期

状态枚举：

- `DRAFT`：草稿。
- `ACTIVE`：进行中，可接收参与。
- `LOCKED`：已锁定，停止接收新兑换码，等待开奖任务。
- `DRAWING`：开奖计算中。
- `COMPLETED`：开奖已完成，中奖记录不可重抽。
- `DRAW_FAILED`：开奖失败，可由管理员修复原因后重试。
- `ARCHIVED`：开奖后清理任务完成。
- `CANCELED`：已取消，仅允许草稿或零参与进行中活动进入。

正常路径：

`DRAFT → ACTIVE → LOCKED → DRAWING → COMPLETED → ARCHIVED`

异常路径：

`LOCKED/DRAWING → DRAW_FAILED → LOCKED → DRAWING → COMPLETED`

取消路径：

`DRAFT → CANCELED`

或：

`ACTIVE（参与人数=0）→ CANCELED`

## 4.1 开始活动条件

点击“开始活动”前必须校验：

- 活动名称非空。
- 至少存在一个奖项。
- 至少存在一个非空奖品项。
- 至少存在一张可用核实兑换码。
- 当前不存在其他 `ACTIVE/LOCKED/DRAWING` 活动。
- 定时开奖模式下 `draw_at` 必须是未来时间。
- SMTP 配置存在且启用；测试发送失败只警告，不强制阻止开始。

活动从 `DRAFT` 进入 `ACTIVE` 时，将以下全局默认设置快照到活动：

- 中奖冷却期数。
- 未使用核实码清理延迟。
- 系统时区。
- 目标人数。
- 最低兑换码面值。
- 抽奖方式。

## 4.2 锁定规则

### 满 N 人自动开奖

当一次成功提交造成新的不同邮箱数量达到目标 N：

- 在同一事务/原子更新中尝试把活动 `ACTIVE → LOCKED`。
- 只有第一个成功更新状态的请求创建开奖任务。
- 后续提交看到 `LOCKED` 后全部拒绝。

### 定时开奖

- API 接到请求时，如果当前时间已经达到 `draw_at`，即使 Worker 尚未来得及改状态，也必须拒绝新提交。
- Worker 到点后尝试 `ACTIVE → LOCKED` 并创建开奖任务。

### 手动开奖

- 管理员点击“开始抽奖”。
- 后端原子更新 `ACTIVE → LOCKED`。
- 只有更新成功者可以继续创建开奖任务。

---

# 5. 兑换码规则与导入规范

## 5.1 固定面值

合法面值只有：

- 1
- 5
- 10
- 20
- 50
- 100

数据库必须使用 CHECK 约束兜底。

## 5.2 后台导入格式

示例：

```text
# 1元

xxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxx
xxxxxxxxxxxxxxxxxxxxx

# 5元

ABC
AbCdEf123
1234567890

# 100元

任意长度任意内容
```

解析规则：

1. 支持 Windows CRLF 与 Linux LF 换行。
2. 合法标题匹配：`# 1元`、`# 5元`、`# 10元`、`# 20元`、`# 50元`、`# 100元`。
3. 标题周围允许普通空白，但标题中的面值不可猜测。
4. 空白行忽略。
5. 代码行本身不执行 `trim()`。
6. 代码不转换大小写。
7. 代码不执行 Unicode normalize。
8. 代码不猜长度。
9. 一行就是一个完整兑换码。
10. 兑换码前导/尾随空格如果真实存在，应视为兑换码内容；后台预览必须对这类行显示风险警告。
11. 在出现合法面值标题之前出现非空兑换码行，解析失败。
12. 以 `#` 开头但不是六种合法标题的行，解析失败，不自动猜测。

## 5.3 精确匹配

管理员导入时：

`code_hash = HMAC-SHA256(CODE_HMAC_SECRET, exact_code_utf8_bytes)`

用户提交时执行完全相同的 HMAC。

不得：

- 转小写。
- 转大写。
- 去前后空格。
- 截断。
- 补零。
- 猜测格式。

## 5.4 不明文落库

数据库只保存：

- `code_hash`。
- 面值。
- 所属活动。
- 是否已使用。
- 使用时间/参与者。

明文兑换码只在：

- 管理员导入请求的内存中短暂存在。
- 用户提交请求的内存中短暂存在。

成功哈希后不得写日志。

## 5.5 导入预览

后台必须先“解析/预览”，再“确认导入”。

预览展示：

- 每个面值解析数量。
- 总数量。
- 本次文本内部重复数量。
- 跨面值重复数量。
- 已经在全局 `used_codes` 使用过的数量。
- 正被其他未归档活动占用且尚未使用的数量。
- 含前导/尾随空格的风险行数量。
- 最终可导入数量。

处理策略：

- 本次文本内部相同 code 出现两次：阻止确认，要求管理员处理。
- 同一 code 被放到不同面值：阻止确认。
- 全局已经使用过：自动排除并在预览中显示“已使用，跳过”。这使管理员可以直接再次导入上一期原始列表，系统自动跳过已经用过的码。
- 正在其他未归档活动中作为未使用码存在：阻止导入。

## 5.6 最低面值

“参与兑换码最低面值”作用于 **每一张提交的兑换码本身**。

例如最低面值 = 5：

- 1 元码：不能成功加入本期。
- 5/10/20/50/100 元码：可以。

不允许通过先提交多个 1 元码凑到 5 元绕过最低面值。

前台对失败原因统一提示，不向用户泄露最低面值或代码存在性。

---

# 6. 邮箱规则

## 6.1 默认允许域名

初始化默认：

- `qq.com`
- `gmail.com`
- `163.com`
- `*.edu.cn`

后台允许新增、删除、启用、停用。

## 6.2 域名规则

两类：

- `EXACT`：例如 `qq.com`。
- `WILDCARD_SUFFIX`：例如 `*.edu.cn`，数据库存储 `edu.cn`。

`*.edu.cn` 匹配至少一个子域，例如：

- `mail.example.edu.cn` → 允许。
- `student.pku.edu.cn` → 允许。
- `edu.cn` → 不自动匹配，除非另加 EXACT 规则。

## 6.3 canonical_email

V1 规范化规则：

1. 邮箱整体做基础语法验证。
2. 域名转为小写。
3. 本地部分也转为小写，用于防止通过大小写重复参与。
4. 默认拒绝本地部分包含 `+` 的地址。
5. 对 `gmail.com`：在 canonical_email 中移除本地部分的 `.`。
6. 不做更复杂的跨域别名推断。
7. `original_email` 保存用户第一次成功提交时的原始邮箱字符串，发送中奖邮件时使用该地址。

示例：

- `Test.User@gmail.com` → canonical `testuser@gmail.com`
- `testuser@gmail.com` → canonical `testuser@gmail.com`
- `test.user+abc@gmail.com` → 默认拒绝。

说明：不同邮箱服务商存在无法通用识别的别名机制，V1 不承诺识别“同一真人”的全部邮箱别名。

---

# 7. 用户参与流程

## 7.1 用户输入

前台只有：

- 邮箱输入框。
- 兑换码输入框。
- “参与抽奖”按钮。

用户可以对同一邮箱多次提交不同兑换码。

## 7.2 后端校验顺序

`POST /api/public/participations`

必须按以下顺序：

1. 获取当前活动。
2. 确认状态为 `ACTIVE`。
3. 若定时活动已到 `draw_at`，直接拒绝并触发锁定尝试。
4. 校验邮箱基本格式。
5. 校验邮箱域名允许规则。
6. 校验邮箱别名规则。
7. 根据 exact code 计算 HMAC。
8. 查询本期 `campaign_codes` 是否存在该 hash。
9. 校验该码面值是否达到本期最低面值。
10. 校验全局 `used_codes` 不存在该 hash。
11. 检查限流。
12. 开启数据库事务。
13. 再次锁定/确认 `campaign_codes` 可用，防并发。
14. `UPSERT campaign_participants`：如果是新邮箱则创建；如果已有则复用。
15. 插入 `used_codes`；`code_hash` 为全局唯一。
16. 将 `campaign_codes.used_at` 与 `used_by_participant_id` 写入。
17. 原子更新参与者：`code_count += 1`，`total_face_value += face_value`。
18. 读取本期不同邮箱数。
19. 如达到目标，原子尝试 `ACTIVE → LOCKED` 并插入开奖任务。
20. 提交事务。

若任何一步失败，整笔参与事务回滚，不能出现“兑换码已消耗但参与者没有增加”的半完成状态。

## 7.3 前台成功响应

不要返回累计面值、优先级或中奖概率。

推荐：

`兑换码已成功加入本期抽奖。`

如果活动因本次提交达到目标而锁定，也可以附加：

`本期参与人数已满，系统将进入开奖流程。`

## 7.4 前台失败提示

为了防止把网站变成兑换码探测器，以下情况统一：

- 本期不存在该码。
- 兑换码面值低于要求。
- 兑换码已经在 ByLucky 使用过。
- 兑换码所属活动不正确。

统一返回：

`兑换码无效、已使用或不符合当前活动要求。`

其他可明确提示：

- 邮箱格式错误。
- 邮箱域名暂不允许。
- 邮箱别名不允许。
- 活动已停止接受参与。
- 请求过于频繁。

---

# 8. 抽奖算法

## 8.1 通用开奖前处理

开奖任务开始后：

1. 数据库锁定 campaign 行。
2. 状态必须是 `LOCKED` 或允许的 `DRAW_FAILED` 重试状态。
3. 更新为 `DRAWING`。
4. 创建 `draw_runs` 记录。
5. 读取全部 `campaign_participants`。
6. 查询当前活动之前最近 N 个 `COMPLETED` 活动。
7. 收集这些活动全部中奖者的 `canonical_email`。
8. 从候选池排除冷却邮箱。
9. 按奖项 `sort_order`、奖品项 `sequence_no` 得到全部待分配奖品项。
10. 运行指定算法。
11. 同一个参与者一旦获奖，从候选集合永久移除。
12. 中奖结果和奖品项状态在同一个事务中写入。
13. 同一事务中创建中奖邮件任务。
14. campaign 更新为 `COMPLETED`。
15. 创建“开奖后清理核实码”系统任务，执行时间 = `completed_at + cleanup_delay_minutes`。

## 8.2 密码学安全随机源

生产环境不得使用 `Math.random()`。

Node.js 实现要求通过：

- `crypto.randomInt()`，或
- 其他基于操作系统 CSPRNG 的等价实现。

为便于单元测试，抽奖模块必须依赖抽象 `RandomSource`：

```ts
interface RandomSource {
  int(minInclusive: number, maxExclusive: number): number;
}
```

生产注入 CryptoRandomSource，测试注入固定序列 FakeRandomSource。

## 8.3 面值优先抽奖伪代码

```text
eligible = 所有不在冷却期的参与者
prizeItems = 按 奖项顺序 + 奖品项顺序 排序

for prizeItem in prizeItems:
    if eligible 为空:
        prizeItem = UNAWARDED(CANDIDATE_SHORTAGE)
        continue

    maxValue = max(eligible.total_face_value)
    topGroup = eligible 中 total_face_value == maxValue 的所有人

    if topGroup.size == 1:
        winner = topGroup[0]
    else:
        index = secureRandomInt(0, topGroup.size)
        winner = topGroup[index]

    保存 winner 与 prizeItem 对应关系
    保存 winner 的 total_face_value/code_count 快照
    从 eligible 删除 winner
```

### 示例

本期：

- A：1 + 50 = 51 元。
- B：10 × 1 = 10 元。
- C：20 元。
- D：20 元。

若有一个一等奖：

- A 直接获奖，因为 51 最高。

若 A 因冷却被排除：

- 最高变为 C/D 的 20 元。
- 只在 C、D 两人中随机。

若有三个奖品且都不冷却：

1. A（51）先获得第一个。
2. C/D（20）随机获得第二个。
3. C/D 剩余者获得第三个。
4. B（10）只有在更高累计面值候选者已经中奖/耗尽后才进入。

## 8.4 每张兑换码等权伪代码

无需把所有票展开成大数组，可以用 `code_count` 做区间随机。

```text
eligible = 所有不在冷却期的参与者
prizeItems = 有序奖品项

for prizeItem in prizeItems:
    if eligible 为空:
        prizeItem = UNAWARDED(CANDIDATE_SHORTAGE)
        continue

    totalTickets = sum(eligible.code_count)
    r = secureRandomInt(0, totalTickets)

    cumulative = 0
    winner = null

    for participant in eligible 按稳定顺序遍历:
        cumulative += participant.code_count
        if r < cumulative:
            winner = participant
            break

    保存 winner 与 prizeItem 对应关系
    从 eligible 删除 winner
```

性质：

- 一个邮箱 1 张码 → 1 张票。
- 一个邮箱 10 张码 → 10 张票。
- 面值 1/100 元在此模式下每张票完全等权。
- 中奖后删除该邮箱，因此最多获奖一次。

## 8.5 奖品不足候选者

若奖品项 6 个，但仅 4 个可中奖邮箱：

- 正常产生 4 个赢家。
- 剩余 2 个 prize_item 状态为 `UNAWARDED`。
- `unawarded_reason = CANDIDATE_SHORTAGE`。
- 活动仍然 `COMPLETED`，不能为了发完奖而允许同邮箱重复获奖。

## 8.6 0 个可中奖候选者

如果本期参与者全部处于冷却期，或没有任何参与者：

- 不产生中奖结果。
- draw_run 标记失败。
- campaign → `DRAW_FAILED`。
- 运维记录明确错误原因 `NO_ELIGIBLE_CANDIDATE`。
- 管理员可调整活动规则不允许直接修改已开始活动的历史规则；V1 推荐只能等待人工决定取消/新建活动，或由专门“管理员强制完成无中奖”操作处理（该操作不是默认按钮）。

---

# 9. 奖项与奖品模型

## 9.1 奖项字段

每个 Prize Tier：

- 奖项名称：默认“一等奖/二等奖/三等奖”。
- 对外展示内容：例如“100 元 AI 额度”。
- 排序顺序。

默认创建三个等级，但管理员可以：

- 只保留一等奖。
- 删除二等奖/三等奖。
- 新增其他奖项。

## 9.2 获奖内容

管理员输入多行文本：

```text
CODE100-ABC
CODE100-DEF
账号: aaa@example.com 密码: xxxxxx
```

解析规则：

- 一行非空内容 = 一个 prize_item = 一个中奖名额。
- 空行忽略。
- 不允许整个字段为空。
- 每一行作为独立敏感内容加密保存。

因此：

- 3 个非空行 = 3 个中奖名额。

## 9.3 公开信息与私密信息分离

公开可展示：

- 一等奖。
- “100 元 AI 额度”。
- 数量 ×3。

不得公开：

- 实际兑换码。
- 账号密码。
- 成品号凭据。

私密奖品内容只允许：

- 管理员后台查看（解密后按需显示）。
- 发送给该 prize_item 对应的中奖者。

---

# 10. 用户前台页面

V1 建议路由：

- `/` 当前活动/参与。
- `/winners` 当前及往期中奖记录。
- `/history/[issueNo]` 单期公开详情（可选独立页）。

也可以把前三者合并在首页不同区域，逻辑不变。

## 10.1 首页 `/`

### 活动区域

字段：

- ByLucky / 冰云抽奖 Logo/名称。
- 活动名称。
- 第 X 期。
- 活动状态。
- 当前不同邮箱人数。
- 目标人数。
- 进度条。
- 若定时开奖：开奖日期时间。

示例：

`当前参与：27 / 40 个不同邮箱`

### 奖项区域

每个奖项展示：

- 一等奖。
- 公开奖品说明。
- 名额数量。

### 参与表单

字段：

- 邮箱地址（required）。
- 兑换码（required；input 不做 trim）。
- 提交按钮。

### 状态

- 无活动：`当前暂无进行中的抽奖活动。`
- 已锁定/开奖中：禁止提交，显示 `本期已停止参与，正在开奖。`
- 已完成：隐藏参与表单，显示结果入口。

## 10.2 中奖展示

展示：

- 期号。
- 活动名称。
- 奖项名称。
- 公开奖品说明。
- 脱敏邮箱。
- 开奖时间。

邮箱脱敏函数建议：

- local 长度 1：`a***@qq.com`
- local 长度 2：`a***@qq.com`
- local 长度 ≥3：前 2 个字符 + `***` + domain，例如 `et***@gmail.com`

绝不显示完整邮箱。

## 10.3 不展示内容

首页和获奖页均不展示：

- 参与者累计金额。
- 某人提交多少张码。
- 哪些面值优先。
- 冷却名单。
- 当前核实码数量。

---

# 11. 管理后台信息架构

访问：`/admin`

未登录自动跳到：`/admin/login`

建议导航：

1. 总览
2. 邮箱配置
3. 抽奖配置
4. 活动列表
5. 获奖记录
6. 运维记录

“邮箱配置”中包含邮件相关配置；也可在 UI 上拆成 Tabs。

---

# 12. 管理员登录

## 12.1 环境变量

管理员账号不放数据库，不做注册。

- `ADMIN_USERNAME`
- `ADMIN_PASSWORD_HASH`

密码使用强密码哈希，不允许 `.env` 明文密码。

推荐使用 Node.js 内置 `crypto.scrypt` + 随机 salt，提供项目脚本：

`npm run admin:hash-password`

管理员复制生成结果到 `.env`。

## 12.2 Session

采用服务端 Session：

1. 登录成功生成 32 字节以上随机 token。
2. Cookie 保存原始 token。
3. 数据库 `admin_sessions` 仅保存 token 的 SHA-256 hash。
4. Cookie：HttpOnly + Secure（生产）+ SameSite=Lax。
5. Session 设过期时间，例如 12 小时；可在实现常量中调整。
6. 登出删除数据库 session。

## 12.3 登录保护

- 同一 IP 连续失败限速。
- 操作记录保存登录成功/失败，但不保存密码。
- 管理员敏感写操作校验 CSRF/同源。

---

# 13. 后台：总览

## 13.1 当前活动卡片

- 期号。
- 活动名称。
- 状态。
- 当前不同邮箱人数 / 目标人数。
- 本期成功使用兑换码数量。
- 本期累计参与面值总额（仅管理员）。
- 开奖方式。
- 开奖条件。
- 定时开奖时间（如有）。

## 13.2 核实码库存

- 总导入数。
- 已使用数。
- 未使用数。
- 按 1/5/10/20/50/100 元分组显示剩余数量。

## 13.3 邮件

- 待发送。
- 发送中。
- 已发送。
- 发送失败。

## 13.4 最近一期

- 参与邮箱人数。
- 使用兑换码数量。
- 获奖人数。
- 未发放奖品数。
- 开奖时间。
- 邮件发送成功率。

## 13.5 系统状态

- PostgreSQL：正常/异常。
- Worker：正常/离线；根据 heartbeat 判断。
- SMTP：最近测试成功/失败。
- 最近一次 Worker 心跳时间。
- 最近失败任务数量。

---

# 14. 后台：抽奖配置 / 创建活动

## 14.1 基本信息

字段：

- 活动名称 `name`：required。
- 期号：自动生成，只读；管理员不手改。
- 目标不同邮箱人数 `target_unique_emails`：默认 40，最小 1。
- 参与兑换码最低面值：下拉 1/5/10/20/50/100，默认 1。
- 抽奖方式：
  - 面值优先抽奖（默认）。
  - 每张兑换码等权。
- 开奖条件：
  - 满 N 个不同邮箱自动开奖。
  - 指定日期时间开奖。
  - 仅管理员手动开奖。
- 指定开奖时间：仅定时模式显示。
- 中奖冷却期数：默认读取系统设置 3。
- 未使用核实码清理延迟：默认 60 分钟。

## 14.2 奖项编辑器

默认出现：

- 一等奖。
- 二等奖。
- 三等奖。

每项字段：

- 奖项名称。
- 公开展示内容。
- 获奖内容多行输入框。
- 自动计算中奖名额 = 非空行数。
- 删除奖项。
- 拖动/按钮排序（V1 可以简单“上移/下移”）。

允许新增奖项。

## 14.3 核实兑换码区

- 大文本框。
- `解析并预览`。
- 预览统计。
- `确认导入`。
- 导入后显示库存统计，不再回显明文兑换码。

## 14.4 草稿与开始

按钮：

- 保存草稿。
- 开始活动。
- 删除草稿。

开始活动后：

- 抽奖核心规则不可直接编辑。
- 可查看规则快照。
- 不能修改已经导入兑换码的面值归属。

---

# 15. 后台：活动列表

表格字段：

- 期号。
- 活动名称。
- 状态。
- 当前不同邮箱数。
- 使用兑换码数。
- 抽奖方式。
- 开奖条件。
- 开奖时间。
- 创建时间。

操作按状态：

### DRAFT

- 编辑。
- 导入核实码。
- 开始活动。
- 删除。

### ACTIVE

- 查看详情。
- 手动开奖（即使配置为自动也可手动触发；需要二次确认）。
- 参与人数=0 时允许取消。

### LOCKED / DRAWING

- 只读查看。
- 不允许重复点击开奖。

### DRAW_FAILED

- 查看错误。
- 在原因允许的情况下重试开奖。

### COMPLETED / ARCHIVED

- 查看完整活动详情。
- 查看中奖记录。
- 查看参与统计。
- 查看邮件状态。
- 不允许重抽。

---

# 16. 后台：获奖记录

字段：

- 期号。
- 活动名称。
- 完整中奖邮箱（管理员可见）。
- 奖项。
- 公开奖品说明。
- 私密获奖内容（默认遮罩，点击后解密显示）。
- 中奖时累计面值快照。
- 中奖时兑换码数量快照。
- 开奖时间。
- 邮件状态。
- 邮件发送时间。
- 冷却提示（例如“后续 3 个已完成活动不可中奖”）。

操作：

- 查看详情。
- 复制邮箱。
- 复制私密获奖内容。
- 重新发送中奖邮件。

禁止：

- 修改中奖邮箱。
- 修改中奖奖项。
- 删除中奖记录。
- 重抽该奖品。

---

# 17. 后台：邮箱配置

建议使用三个 Tab：

1. SMTP 配置。
2. 邮件模板。
3. 发送队列。

另有“参与邮箱域名规则”区域。

## 17.1 SMTP

服务商：

- QQ 邮箱（默认预设）。
- 自定义 SMTP。

QQ 预设至少自动填：

- SMTP Host：`smtp.qq.com`。
- 推荐加密连接参数由代码预设，UI 仍允许管理员调整端口/安全模式。

管理员填写：

- SMTP 用户名/邮箱。
- SMTP 授权码/密码。
- 发件人邮箱。
- 发件人名称。

功能：

- 保存。
- 发送测试邮件。
- 显示最近测试时间和结果。

SMTP 密码必须使用 `CONFIG_ENCRYPTION_KEY` 加密存储。

## 17.2 邮件模板

V1 至少实现 `WINNER_NOTICE`。

字段：

- 模板名称。
- 邮件主题模板。
- 文本正文模板。
- HTML 正文模板（可选；V1 可以提供简单 HTML 编辑 textarea）。

变量：

- `{{winner_email}}`
- `{{campaign_name}}`
- `{{issue_no}}`
- `{{prize_level}}`
- `{{prize_public_name}}`
- `{{prize_content}}`
- `{{draw_time}}`

保存时验证未知变量，防止拼写错误。

## 17.3 发送队列

状态：

- `PENDING` 待发送。
- `SENDING` 发送中。
- `SENT` 已发送。
- `FAILED` 发送失败。

字段：

- 收件人。
- 期号。
- 奖项。
- 状态。
- 尝试次数。
- 最大尝试次数。
- 下次重试时间。
- 最近错误（脱敏）。
- 创建时间。
- 发送成功时间。

自动重试：

- 最大 3 次自动发送尝试。
- 建议延迟：第一次失败后 1 分钟；第二次失败后 5 分钟；第三次失败后进入 FAILED。
- 手动重试不受自动三次限制，但每次手动操作写运维记录。

邮件任务不得包含明文 SMTP 密码。

---

# 18. 运维记录

`operation_logs` 是审计日志。

必须记录：

- 管理员登录成功/失败。
- 创建活动。
- 修改草稿。
- 导入兑换码统计。
- 开始活动。
- 手动开奖。
- 系统自动锁定活动。
- 开奖成功/失败。
- 邮件任务创建。
- 邮件最终失败。
- 手动重试邮件。
- 修改 SMTP。
- SMTP 测试。
- 修改邮箱域名规则。
- 修改系统默认设置。
- 清理未使用核实码。
- 取消活动。

日志字段：

- actor_type：ADMIN / SYSTEM。
- action。
- entity_type。
- entity_id。
- IP（可存 HMAC 后值）。
- user_agent 摘要。
- sanitized metadata JSON。
- created_at。

严禁写入：

- 管理员密码。
- SMTP 密码/授权码。
- 明文核实兑换码。
- 完整私密奖品内容。

---

# 19. 后台任务与 Worker

## 19.1 进程模型

同一个代码仓库，生产运行两个 Node 进程：

- `app`：Next.js 网站/API。
- `worker`：后台任务。

二者连接同一 PostgreSQL。

V1 不引入 Redis/MQ。

## 19.2 Worker 职责

- 定时扫描到点活动并锁定/开奖。
- 处理 `DRAW_CAMPAIGN` 任务。
- 处理 `CLEANUP_CAMPAIGN_CODES` 任务。
- 处理 `email_jobs`。
- 写心跳。

## 19.3 System Jobs

建议表 `system_jobs`：

类型：

- `DRAW_CAMPAIGN`
- `CLEANUP_CAMPAIGN_CODES`

字段：

- id。
- type。
- campaign_id。
- status：PENDING/RUNNING/SUCCEEDED/FAILED。
- available_at。
- attempts。
- max_attempts。
- locked_at。
- locked_by。
- unique_key。
- last_error。
- created_at / updated_at。

`unique_key` 用于防止同一期同类型任务重复创建，例如：

`draw:<campaign_uuid>`

领取任务时使用 PostgreSQL 行锁/`FOR UPDATE SKIP LOCKED` 或等价原子 claim 方案。

## 19.4 定时扫描

Worker 每隔数秒扫描：

- `ACTIVE + trigger=SCHEDULED + draw_at <= now()`。

尝试原子锁定后创建唯一开奖任务。

精确到“分钟”的业务要求即可，不需要毫秒级开奖。

## 19.5 未使用核实码清理

活动完成后：

`cleanup_at = completed_at + campaign.cleanup_delay_minutes`

Worker 到时：

- 删除 `campaign_codes` 中该活动 `used_at IS NULL` 的记录。
- 已使用码仍保留在 `used_codes` 全局表中。
- 可选择保留该活动已使用的 `campaign_codes` 哈希行作为统计；V1 保留，不影响再次导入，因为再次导入会被 `used_codes` 跳过。
- campaign → `ARCHIVED`。
- 写 operation_log，记录删除数量和各面值数量，不记录码值。

---

# 20. PostgreSQL 数据库表结构

所有主业务表建议使用 UUID 主键。所有时间使用 `timestamptz` 存 UTC，展示时按活动/系统时区转换。

## 20.1 `app_settings`

单行配置表。

| 字段 | 类型 | 约束/说明 |
|---|---|---|
| id | smallint | PK，固定 1 |
| timezone | text | 默认 `Asia/Shanghai`，后台可改 |
| default_target_unique_emails | integer | 默认 40，CHECK >0 |
| default_min_code_face_value | smallint | CHECK IN (1,5,10,20,50,100) |
| default_draw_method | text | FACE_VALUE_PRIORITY / CODE_EQUAL |
| default_winner_cooldown_periods | integer | 默认 3，CHECK >=0 |
| default_cleanup_delay_minutes | integer | 默认 60，CHECK >=0 |
| reject_plus_alias | boolean | 默认 true |
| gmail_dot_normalization | boolean | 默认 true |
| public_show_progress | boolean | 默认 true |
| created_at | timestamptz | |
| updated_at | timestamptz | |

## 20.2 `admin_sessions`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| token_hash | bytea | UNIQUE；仅存 SHA-256 hash |
| created_at | timestamptz | |
| expires_at | timestamptz | index |
| last_seen_at | timestamptz | |
| ip_hash | bytea nullable | |
| user_agent | text nullable | |

## 20.3 `campaigns`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| issue_no | integer | UNIQUE，自动递增 |
| name | text | NOT NULL |
| status | text | DRAFT/ACTIVE/LOCKED/DRAWING/COMPLETED/DRAW_FAILED/ARCHIVED/CANCELED |
| target_unique_emails | integer | NOT NULL, >0 |
| min_code_face_value | smallint | 1/5/10/20/50/100 |
| draw_method | text | FACE_VALUE_PRIORITY/CODE_EQUAL |
| draw_trigger | text | PARTICIPANT_TARGET/SCHEDULED/MANUAL_ONLY |
| draw_at | timestamptz nullable | SCHEDULED 必填 |
| winner_cooldown_periods | integer | 活动快照 |
| cleanup_delay_minutes | integer | 活动快照 |
| timezone | text | 活动快照 |
| started_at | timestamptz nullable | |
| locked_at | timestamptz nullable | |
| completed_at | timestamptz nullable | |
| archived_at | timestamptz nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

关键约束：

- 应通过事务/部分唯一索引或业务锁保证最多一个活动处于 ACTIVE/LOCKED/DRAWING。
- SCHEDULED 时 `draw_at IS NOT NULL`。

## 20.4 `prize_tiers`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK campaigns |
| name | text | 例如一等奖 |
| public_description | text | 对外公开奖品说明 |
| sort_order | integer | NOT NULL |
| created_at | timestamptz | |
| updated_at | timestamptz | |

索引：`(campaign_id, sort_order)`。

## 20.5 `prize_items`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| prize_tier_id | uuid | FK prize_tiers |
| campaign_id | uuid | 冗余 FK，方便查询 |
| sequence_no | integer | 一行内容顺序 |
| content_ciphertext | text | AES-GCM 等应用层加密后的载荷 |
| status | text | AVAILABLE/AWARDED/UNAWARDED |
| unawarded_reason | text nullable | CANDIDATE_SHORTAGE 等 |
| created_at | timestamptz | |

唯一：`(prize_tier_id, sequence_no)`。

## 20.6 `campaign_codes`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK campaigns |
| code_hash | bytea | HMAC-SHA256 32 bytes |
| face_value | smallint | CHECK 1/5/10/20/50/100 |
| used_at | timestamptz nullable | null=本期未使用 |
| used_by_participant_id | uuid nullable | FK campaign_participants |
| imported_at | timestamptz | |

唯一：`(campaign_id, code_hash)`。

索引：

- `(campaign_id, used_at)`。
- `(campaign_id, face_value, used_at)`。
- `code_hash` 普通索引用于跨活动冲突预览。

## 20.7 `campaign_participants`

一个邮箱每期只存在一行汇总记录。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK campaigns |
| original_email | text | 第一次成功提交的邮箱，用于发信 |
| canonical_email | text | 判重/冷却身份 |
| code_count | integer | 默认 0 |
| total_face_value | integer | 默认 0 |
| first_submitted_at | timestamptz | |
| last_submitted_at | timestamptz | |

**唯一：`(campaign_id, canonical_email)`。**

该唯一约束只保证一个邮箱一个“参与者汇总”，不限制该邮箱追加多张兑换码。

## 20.8 `used_codes`

全局永久抽奖使用账本。

| 字段 | 类型 | 说明 |
|---|---|---|
| code_hash | bytea | PRIMARY KEY / UNIQUE |
| face_value | smallint | |
| campaign_id | uuid | FK campaigns |
| participant_id | uuid | FK campaign_participants |
| used_at | timestamptz | |

`code_hash` 全局唯一是“一张兑换码在 ByLucky 只能成功参与一次”的最终数据库兜底。

## 20.9 `draw_runs`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK |
| attempt_no | integer | |
| trigger_source | text | AUTO_TARGET/AUTO_SCHEDULE/ADMIN_MANUAL/ADMIN_RETRY |
| algorithm | text | FACE_VALUE_PRIORITY/CODE_EQUAL |
| algorithm_version | text | 例如 V1 |
| status | text | RUNNING/SUCCEEDED/FAILED |
| participant_count | integer | 快照 |
| eligible_count | integer | 冷却过滤后快照 |
| used_code_count | integer | 快照 |
| prize_item_count | integer | |
| winner_count | integer | |
| started_at | timestamptz | |
| completed_at | timestamptz nullable | |
| error_code | text nullable | |
| error_message | text nullable | 不含敏感内容 |

索引 `(campaign_id, attempt_no)`。

## 20.10 `winners`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| campaign_id | uuid | FK |
| draw_run_id | uuid | FK |
| participant_id | uuid | FK |
| prize_tier_id | uuid | FK |
| prize_item_id | uuid | FK |
| original_email_snapshot | text | 历史快照 |
| canonical_email_snapshot | text | 历史快照 |
| total_face_value_snapshot | integer | 中奖时累计面值 |
| code_count_snapshot | integer | 中奖时码数 |
| won_at | timestamptz | |

关键唯一约束：

- `UNIQUE(prize_item_id)`：一个奖品只能给一个人。
- `UNIQUE(campaign_id, participant_id)`：同一期一个邮箱只能中奖一次。

## 20.11 `email_domain_rules`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| rule_type | text | EXACT/WILDCARD_SUFFIX |
| value | text | qq.com 或 edu.cn |
| enabled | boolean | |
| created_at | timestamptz | |

唯一 `(rule_type, value)`。

## 20.12 `smtp_config`

V1 只需一行当前配置。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | smallint | PK=1 |
| provider | text | QQ/CUSTOM |
| host | text | |
| port | integer | |
| security | text | TLS/STARTTLS/NONE |
| username | text | |
| password_ciphertext | text | 应用层加密 |
| from_email | text | |
| from_name | text | |
| enabled | boolean | |
| last_test_at | timestamptz nullable | |
| last_test_ok | boolean nullable | |
| last_test_error | text nullable | 脱敏 |
| updated_at | timestamptz | |

## 20.13 `email_templates`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| template_key | text | UNIQUE，如 WINNER_NOTICE |
| subject_template | text | |
| text_template | text | |
| html_template | text nullable | |
| enabled | boolean | |
| updated_at | timestamptz | |

## 20.14 `email_jobs`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | uuid | PK |
| winner_id | uuid | FK winners |
| recipient_email | text | |
| status | text | PENDING/SENDING/SENT/FAILED |
| rendered_subject | text | 生成任务时冻结 |
| rendered_text_ciphertext | text | 因含私密奖品，建议加密 |
| rendered_html_ciphertext | text nullable | |
| attempts | integer | 默认 0 |
| max_attempts | integer | 默认 3 |
| next_attempt_at | timestamptz | index |
| locked_at | timestamptz nullable | |
| locked_by | text nullable | |
| last_error | text nullable | 脱敏 |
| sent_at | timestamptz nullable | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

唯一/约束：默认一条 winner 对应一条主中奖通知任务，可 `UNIQUE(winner_id)`；手动重试复用该任务而非新建不同 winner 任务。

## 20.15 `system_jobs`

见第 19 节。

## 20.16 `operation_logs`

| 字段 | 类型 | 说明 |
|---|---|---|
| id | bigserial/uuid | PK |
| actor_type | text | ADMIN/SYSTEM |
| action | text | |
| entity_type | text nullable | |
| entity_id | uuid/text nullable | |
| ip_hash | bytea nullable | |
| user_agent | text nullable | |
| metadata | jsonb | 已脱敏 |
| created_at | timestamptz | index |

## 20.17 `security_rate_limits`

用于持久限流，避免重启后完全清空。

| 字段 | 类型 | 说明 |
|---|---|---|
| bucket_key | text | PK；例如 HMAC(ip)+scope |
| scope | text | LOGIN/PARTICIPATION |
| window_started_at | timestamptz | |
| counter | integer | |
| blocked_until | timestamptz nullable | |
| updated_at | timestamptz | |

## 20.18 `worker_heartbeats`

| 字段 | 类型 | 说明 |
|---|---|---|
| worker_id | text | PK |
| started_at | timestamptz | |
| last_seen_at | timestamptz | index |
| version | text | |

---

# 21. 关键数据库并发约束

## 21.1 同一兑换码并发提交

场景：两个请求同时提交相同 code。

必须同时具备：

- `used_codes.code_hash` 全局 PRIMARY KEY/UNIQUE。
- 参与事务中插入 `used_codes`。
- 插入冲突时整个事务回滚。

因此即使两个请求都在前置查询阶段看到“未使用”，最终也只有一个能 commit。

## 21.2 同一邮箱同时追加不同兑换码

使用 `INSERT ... ON CONFLICT (campaign_id, canonical_email) DO UPDATE` 或等价逻辑获取/创建 participant。

累计字段更新必须原子：

```sql
code_count = code_count + 1,
total_face_value = total_face_value + :face_value
```

不能先读旧值再在应用层 `old + 1` 后写回，否则并发可能丢更新。

## 21.3 防止重复开奖

原子状态更新：

```text
UPDATE campaigns
SET status='LOCKED', locked_at=now()
WHERE id=? AND status='ACTIVE'
```

只允许 `affectedRows == 1` 的调用方创建开奖任务。

`system_jobs.unique_key = draw:<campaign_id>` 再做第二层唯一防护。

## 21.4 开奖事务

中奖者选择、winners 插入、prize_items 状态、email_jobs 创建、campaign COMPLETED 更新必须在一个数据库事务中完成。

邮件真正发送不在该事务内。

---

# 22. API 设计

统一 JSON：

成功：

```json
{
  "ok": true,
  "data": {}
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "CAMPAIGN_CLOSED",
    "message": "本期已停止接受参与。"
  }
}
```

## 22.1 Public API

### `GET /api/public/campaign`

返回当前公开活动：

- id。
- issueNo。
- name。
- public status。
- currentUniqueEmails。
- targetUniqueEmails。
- drawAt（如公开）。
- prizes：name/publicDescription/quantity。

不得返回 draw_method、冷却、最低面值、核实码统计。

### `POST /api/public/participations`

Request：

```json
{
  "email": "user@example.com",
  "code": "ExactCodeHere"
}
```

注意：后端禁止对 `code` 自动 trim。

成功 HTTP 200/201。

建议错误码：

- `NO_ACTIVE_CAMPAIGN`
- `CAMPAIGN_CLOSED`
- `INVALID_EMAIL`
- `EMAIL_DOMAIN_NOT_ALLOWED`
- `EMAIL_ALIAS_NOT_ALLOWED`
- `CODE_INVALID_OR_INELIGIBLE`
- `RATE_LIMITED`

代码不存在/面值不符/已使用统一为 `CODE_INVALID_OR_INELIGIBLE`。

### `GET /api/public/winners`

分页返回已完成活动的公开中奖记录。

### `GET /api/public/campaigns/:issueNo`

返回某期公开详情。

## 22.2 Admin Auth API

- `POST /api/admin/auth/login`
- `POST /api/admin/auth/logout`
- `GET /api/admin/auth/session`

所有其他 `/api/admin/*` 必须校验 Session。

## 22.3 Dashboard

- `GET /api/admin/dashboard`

## 22.4 Campaigns

- `GET /api/admin/campaigns`
- `POST /api/admin/campaigns`
- `GET /api/admin/campaigns/:id`
- `PATCH /api/admin/campaigns/:id`（仅 DRAFT 的核心字段）
- `DELETE /api/admin/campaigns/:id`（仅 DRAFT）
- `POST /api/admin/campaigns/:id/start`
- `POST /api/admin/campaigns/:id/draw`（手动锁定+创建任务）
- `POST /api/admin/campaigns/:id/retry-draw`（DRAW_FAILED）
- `POST /api/admin/campaigns/:id/cancel`（仅允许的状态）

## 22.5 核实兑换码

- `POST /api/admin/campaigns/:id/codes/preview`
- `POST /api/admin/campaigns/:id/codes/import`
- `GET /api/admin/campaigns/:id/codes/stats`

`preview` 返回一次性 preview token 或将解析结果由前端再次提交给 import。为了避免前端篡改面值，`import` 必须重新解析和重新校验原文本；不要信任前端统计结果。

## 22.6 Prize

可以嵌入 campaign 草稿保存接口；若单独拆：

- `POST /api/admin/campaigns/:id/prize-tiers`
- `PATCH /api/admin/prize-tiers/:id`
- `DELETE /api/admin/prize-tiers/:id`

V1 推荐在“保存草稿”时一次提交完整奖项树，后端事务替换未开始活动的 Prize Tier/Item，开发更简单。

## 22.7 Winners

- `GET /api/admin/winners`
- `GET /api/admin/winners/:id`
- `POST /api/admin/winners/:id/resend-email`

## 22.8 SMTP / Templates / Queue

- `GET /api/admin/email/smtp`
- `PUT /api/admin/email/smtp`
- `POST /api/admin/email/smtp/test`
- `GET /api/admin/email/templates`
- `PUT /api/admin/email/templates/:key`
- `GET /api/admin/email/jobs`
- `POST /api/admin/email/jobs/:id/retry`

## 22.9 Domain Rules / Settings / Logs

- `GET /api/admin/settings`
- `PUT /api/admin/settings`
- `GET /api/admin/email-domains`
- `POST /api/admin/email-domains`
- `PATCH /api/admin/email-domains/:id`
- `DELETE /api/admin/email-domains/:id`
- `GET /api/admin/operation-logs`

---

# 23. 页面字段清单

## 23.1 `/admin/login`

- 管理员账号。
- 密码。
- 登录按钮。
- 错误信息。

## 23.2 `/admin` 总览

- 当前活动卡。
- 参与人数。
- 本期码数/累计面值管理员统计。
- 核实码库存表。
- 邮件状态卡。
- 最近一期。
- DB/Worker/SMTP 状态。

## 23.3 `/admin/campaigns/new`

- 活动名称。
- 自动期号。
- 目标人数。
- 最低兑换码面值。
- 抽奖方式。
- 开奖条件。
- 开奖时间。
- 冷却期数。
- 清理延迟。
- 奖项编辑器。
- 核实码文本框。
- 解析预览。
- 保存草稿。
- 开始活动。

## 23.4 `/admin/campaigns`

- 筛选状态。
- 列表字段见活动列表章节。

## 23.5 `/admin/campaigns/[id]`

- 规则快照。
- 参与人数。
- 参与码数。
- 各面值成功使用数。
- 各面值未使用核实码。
- 奖项。
- 开奖结果。
- Draw Run 历史。
- 相关操作日志。

## 23.6 `/admin/winners`

- 搜索期号/邮箱。
- 筛选奖项/邮件状态。
- 结果表格。

## 23.7 `/admin/email`

Tabs：SMTP、模板、发送队列。

## 23.8 `/admin/settings`

- 默认目标人数。
- 默认最低面值。
- 默认抽奖方式。
- 默认中奖冷却期。
- 默认清理延迟。
- 时区。
- 禁止 `+` 邮箱别名。
- Gmail 点号归一化。
- 公开显示参与进度。
- 邮箱域名规则。

## 23.9 `/admin/logs`

- 日期范围。
- actor。
- action。
- entity。
- 关键字。
- 分页。

---

# 24. 安全要求

## 24.1 `.env` 只保存系统级秘密

推荐：

```env
NODE_ENV=development
APP_URL=http://localhost:3000
DATABASE_URL=postgresql://...

ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=...

SESSION_SECRET=...
CODE_HMAC_SECRET=...
CONFIG_ENCRYPTION_KEY=...

LOG_LEVEL=info
```

说明：

- `ADMIN_PASSWORD_HASH`：密码哈希，不是明文密码。
- `SESSION_SECRET`：Session/IP hash/签名等用途。
- `CODE_HMAC_SECRET`：兑换码 HMAC 密钥。
- `CONFIG_ENCRYPTION_KEY`：SMTP 密码、私密奖品内容加密密钥。

**CODE_HMAC_SECRET 一旦系统开始实际导入兑换码后不能随意修改。** 修改会导致已有兑换码 hash 无法与新提交一致，也会破坏全局重复使用识别。

**CONFIG_ENCRYPTION_KEY 必须备份。** 丢失后将无法解密已保存的奖品私密内容和 SMTP 密码。

## 24.2 奖品/SMTP 加密

推荐 AES-256-GCM：

- 每条数据随机 nonce/IV。
- 保存 version + iv + ciphertext + auth tag 的编码载荷。
- 解密失败不得自动返回密文原文。

## 24.3 兑换码爆破保护

Public Participation 限流建议初始值：

- 同 IP 在短窗口内最多若干失败请求。
- 同 canonical_email 短时间连续失败额外限制。
- 限制值写成代码配置/系统配置，V1 不需要做复杂风控控制台。

永远不提供“单独检查兑换码是否有效”的 API。

## 24.4 管理后台

- HttpOnly Session Cookie。
- 生产 Secure。
- SameSite=Lax。
- 登录限流。
- 所有写操作验证管理员 Session。
- Origin/CSRF 防护。
- 后台页面禁止被搜索引擎索引。
- 建议生产额外加 Cloudflare/WAF 或 VPS 防火墙，但不是应用核心依赖。

## 24.5 日志脱敏

任何代码路径不得打印：

- request body 中的 `code`。
- SMTP password。
- prize secret content。
- ADMIN password。

---

# 25. 邮件发送详细流程

开奖事务中：

1. 保存 winner。
2. 解密对应 prize_item 只用于渲染模板。
3. 使用当时的邮件模板渲染主题与正文。
4. 将渲染后的正文再次加密存入 email_jobs。
5. 不在事务中连接 SMTP。

Worker：

```text
claim PENDING job
→ status SENDING
→ 解密邮件正文和 SMTP 密码
→ SMTP send
→ success: SENT + sent_at
→ failure:
    attempts += 1
    若 attempts < 3:
        status PENDING
        next_attempt_at = 延迟时间
    否则:
        status FAILED
```

建议退避：

- 第 1 次失败 → 1 分钟后。
- 第 2 次失败 → 5 分钟后。
- 第 3 次失败 → 最终 FAILED。

管理员手动重试：

- 将 FAILED/PENDING job 重置到 PENDING。
- `next_attempt_at=now()`。
- 保留历史 attempts 或额外记录 manual_retry_count。
- operation_log 记录操作。

---

# 26. Windows 11 本地开发方案

## 26.1 推荐开发方式

推荐：

- Windows 11 作为桌面系统和浏览器环境。
- WSL 2 + Ubuntu 作为开发 shell（推荐，但不是强制）。
- VS Code + WSL 扩展。
- Docker Desktop 使用 WSL 2 backend。
- PostgreSQL 在 Docker 中运行。
- Next.js app 和 worker 在开发时直接用 Node.js 启动，避免每次代码修改都重建容器。

这样既可以在 Windows 浏览器访问 `http://localhost:3000`，又让代码执行环境更接近未来 Linux VPS。

## 26.2 本地依赖

- Git。
- Node.js 当前 LTS，项目锁定实际版本。
- npm。
- Docker Desktop。
- WSL 2 Ubuntu（推荐）。
- VS Code（推荐）。

## 26.3 本地启动建议

`docker-compose.dev.yml` 只启动 PostgreSQL：

```bash
docker compose -f docker-compose.dev.yml up -d db
npm install
npm run db:migrate
npm run dev
```

另一个终端：

```bash
npm run worker:dev
```

浏览器：

- 用户端：`http://localhost:3000`
- 后台：`http://localhost:3000/admin`

## 26.4 开发脚本

`package.json` 至少：

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "worker:dev": "tsx src/worker/index.ts",
    "worker:start": "node dist-worker/index.js",
    "db:migrate": "...",
    "db:generate": "...",
    "test": "...",
    "lint": "...",
    "typecheck": "...",
    "admin:hash-password": "..."
  }
}
```

具体 ORM 命令由 Drizzle 配置决定。

---

# 27. Linux VPS 部署方案

## 27.1 Docker Compose

生产建议四个服务：

- `app`
- `worker`
- `postgres`
- `caddy`

逻辑：

```text
Internet
   ↓
Caddy :80/:443
   ↓
Next.js app :3000
   ↓
PostgreSQL

Worker ─────→ PostgreSQL
Worker ─────→ QQ/Custom SMTP
```

## 27.2 Caddy

负责：

- HTTPS。
- 域名反向代理。
- HTTP → HTTPS。

## 27.3 数据持久化

必须使用 Docker volume 或 VPS 持久目录保存：

- PostgreSQL data。
- 备份目录。

应用容器本身必须视为可随时删除重建。

## 27.4 备份

至少每日 `pg_dump`。

必须另外安全备份：

- `.env` 中的 CODE_HMAC_SECRET。
- CONFIG_ENCRYPTION_KEY。
- SESSION_SECRET 可重建但会使现有 Session 失效；仍建议备份配置。

部署升级前执行数据库备份。

---

# 28. 技术栈基线

- TypeScript。
- Next.js App Router。
- React。
- Tailwind CSS。
- PostgreSQL。
- Drizzle ORM。
- Zod：API/表单输入校验。
- Nodemailer：SMTP。
- Node.js `crypto`：HMAC、CSPRNG、scrypt、AES-GCM 基础能力。
- Docker / Docker Compose。
- Caddy。
- Vitest 或等价 TypeScript 测试框架。

原则：版本全部在 `package-lock.json` 锁定，不在需求文档写死容易过时的具体小版本号。

---

# 29. 推荐项目目录

```text
ByLucky/
├─ src/
│  ├─ app/
│  │  ├─ page.tsx
│  │  ├─ winners/
│  │  ├─ history/[issueNo]/
│  │  ├─ admin/
│  │  │  ├─ login/
│  │  │  ├─ page.tsx
│  │  │  ├─ campaigns/
│  │  │  ├─ winners/
│  │  │  ├─ email/
│  │  │  ├─ settings/
│  │  │  └─ logs/
│  │  └─ api/
│  │     ├─ public/
│  │     └─ admin/
│  │
│  ├─ domain/
│  │  ├─ lottery/
│  │  │  ├─ face-value-priority.ts
│  │  │  ├─ code-equal.ts
│  │  │  ├─ cooldown.ts
│  │  │  ├─ random-source.ts
│  │  │  └─ types.ts
│  │  ├─ codes/
│  │  │  ├─ parser.ts
│  │  │  ├─ hasher.ts
│  │  │  └─ import-validator.ts
│  │  ├─ email-identity/
│  │  │  ├─ canonicalize.ts
│  │  │  └─ domain-rules.ts
│  │  ├─ campaigns/
│  │  └─ mail/
│  │
│  ├─ server/
│  │  ├─ auth/
│  │  ├─ crypto/
│  │  ├─ rate-limit/
│  │  ├─ services/
│  │  └─ repositories/
│  │
│  ├─ db/
│  │  ├─ schema/
│  │  ├─ migrations/
│  │  └─ client.ts
│  │
│  ├─ worker/
│  │  ├─ index.ts
│  │  ├─ heartbeat.ts
│  │  ├─ system-jobs.ts
│  │  └─ email-jobs.ts
│  │
│  └─ components/
│
├─ scripts/
│  ├─ hash-admin-password.ts
│  └─ seed-defaults.ts
│
├─ tests/
├─ public/
├─ Dockerfile
├─ docker-compose.yml
├─ docker-compose.dev.yml
├─ Caddyfile
├─ .env.example
├─ drizzle.config.ts
├─ package.json
└─ README.md
```

核心原则：抽奖算法必须放在 `domain/lottery`，不能把算法写死在页面组件或 API Route 中。

---

# 30. 兑换码 Parser 伪代码

```text
currentFaceValue = null
result = Map<faceValue, codes[]>
errors = []

for rawLine in splitPreserveLines(text):
    lineWithoutLineEnding = rawLine

    if lineWithoutLineEnding.trim() == "":
        continue

    headerValue = parseAllowedHeader(lineWithoutLineEnding)
    if headerValue exists:
        currentFaceValue = headerValue
        continue

    if lineWithoutLineEnding.trimStart().startsWith("#"):
        errors.add("UNKNOWN_HEADER")
        continue

    if currentFaceValue == null:
        errors.add("CODE_BEFORE_HEADER")
        continue

    exactCode = lineWithoutLineEnding   // 不 trim
    result[currentFaceValue].push(exactCode)

validate duplicates by HMAC(exactCode)
validate cross-face-value duplicates
validate global used_codes
validate other campaign unused codes
return preview
```

---

# 31. 参与事务伪代码

```text
function participate(emailInput, codeInput):
    campaign = getCurrentCampaign()
    assert campaign ACTIVE
    assert not pastScheduledDeadline(campaign)

    identity = validateAndCanonicalizeEmail(emailInput)
    assert domainAllowed(identity)

    codeHash = hmacExact(codeInput)

    begin transaction

      campaign = SELECT campaign FOR UPDATE/compatible lock
      assert still ACTIVE and not past deadline

      campaignCode = SELECT matching campaign_code FOR UPDATE
      assert campaignCode exists
      assert campaignCode.used_at is null
      assert campaignCode.face_value >= campaign.min_code_face_value

      assert used_codes does not contain codeHash

      participant = UPSERT campaign_participant by (campaign_id, canonical_email)
      // original_email 只在首次创建时写入

      INSERT used_codes(codeHash, faceValue, campaignId, participantId)
      // codeHash unique

      UPDATE campaign_codes
      SET used_at=now(), used_by_participant_id=participant.id

      UPDATE campaign_participants
      SET code_count=code_count+1,
          total_face_value=total_face_value+faceValue,
          last_submitted_at=now()

      if campaign.draw_trigger == PARTICIPANT_TARGET:
          currentCount = COUNT campaign_participants
          if currentCount >= target:
              locked = atomic ACTIVE -> LOCKED
              if locked:
                  insert unique DRAW_CAMPAIGN system job

    commit

    return generic success
```

---

# 32. 冷却查询伪代码

```text
previousCompletedCampaigns =
    SELECT id
    FROM campaigns
    WHERE status IN ('COMPLETED', 'ARCHIVED')
      AND issue_no < current.issue_no
    ORDER BY issue_no DESC
    LIMIT current.winner_cooldown_periods

cooldownEmails =
    SELECT DISTINCT canonical_email_snapshot
    FROM winners
    WHERE campaign_id IN previousCompletedCampaigns

eligibleParticipants =
    currentParticipants
    EXCEPT participant whose canonical_email IN cooldownEmails
```

冷却只影响“能否中奖”，不影响：

- 提交兑换码。
- 本期累计面值。
- 本期不同邮箱人数。

---

# 33. 管理员可见统计口径

当前活动：

- `unique_participants` = campaign_participants count。
- `used_codes` = used_codes where campaign_id。
- `total_face_value` = sum campaign_participants.total_face_value。
- `eligible_unique_participants` = 扣除冷却后的邮箱数。
- `available_campaign_codes` = campaign_codes used_at is null。

按面值：

- 导入数量。
- 已使用数量。
- 未使用数量。

用户端只允许取 `unique_participants` 和 `target_unique_emails`。

---

# 34. 重要业务错误码

Public：

| Code | 用户提示 |
|---|---|
| NO_ACTIVE_CAMPAIGN | 当前暂无进行中的抽奖活动 |
| CAMPAIGN_CLOSED | 本期已停止接受参与 |
| INVALID_EMAIL | 邮箱格式不正确 |
| EMAIL_DOMAIN_NOT_ALLOWED | 当前邮箱域名暂不支持 |
| EMAIL_ALIAS_NOT_ALLOWED | 请使用不含邮箱别名的地址 |
| CODE_INVALID_OR_INELIGIBLE | 兑换码无效、已使用或不符合当前活动要求 |
| RATE_LIMITED | 请求过于频繁，请稍后再试 |

Admin 可使用更具体错误：

- CAMPAIGN_ALREADY_ACTIVE
- INVALID_CAMPAIGN_STATE
- CODE_IMPORT_DUPLICATE
- CODE_IMPORT_CROSS_VALUE_DUPLICATE
- CODE_ASSIGNED_TO_OTHER_CAMPAIGN
- NO_PRIZE_ITEM
- DRAW_ALREADY_RUNNING
- NO_ELIGIBLE_CANDIDATE
- SMTP_NOT_CONFIGURED
- EMAIL_SEND_FAILED

---

# 35. 测试与验收标准

## 35.1 兑换码精确性

必须通过：

1. 管理员导入 `AbC123`，用户输入 `AbC123` 成功。
2. 输入 `abc123` 失败。
3. 输入 `AbC123 ` 失败，除非管理员导入的 code 真的包含尾随空格。
4. 任意长度 code 可用。
5. 已经参与过一期的 code，在后续任何活动都失败。

## 35.2 同邮箱多码

1. A 提交 1 元 → participant A: count=1, total=1，人数=1。
2. A 再提交 50 元 → count=2, total=51，人数仍=1。
3. B 提交 1 元 → 人数=2。
4. 两个请求同时给 A 提交不同 code，不得丢累计值。

## 35.3 满 N

目标 20：

- 前 19 个不同邮箱，不锁定。
- 同一邮箱追加 100 张码，仍是 19 人。
- 第 20 个不同邮箱成功提交后活动立即锁定。
- 锁定后任何邮箱不能再加码。
- 并发第 20/21 个请求最多只有锁定前合法 commit 的请求进入，不能重复创建开奖任务。

## 35.4 面值优先

参与者：

- A=51
- B=10
- C=20
- D=20

一等奖 1 个：A 必中（若 A 不冷却）。

A 冷却：C/D 中随机 1 人。

三个奖品：A → C/D 随机 → C/D 剩余。

## 35.5 每张兑换码等权

- A code_count=10。
- B code_count=1。
- 使用可注入固定 RandomSource 验证区间选择边界。
- A 一旦中第一个奖，A 的剩余 9 张票不能用于后续奖项。

## 35.6 冷却

默认 3：

- A 在已完成活动 X 中奖。
- 后续 3 个 COMPLETED/ARCHIVED 活动不能中奖。
- 第 4 个已完成活动对应的当前活动允许 A 中奖。
- 中间 CANCELED 活动不计入 3 期。

## 35.7 同期不重复中奖

任意算法、任意奖项数量下：

`UNIQUE(campaign_id, participant_id)` 永远不冲突；算法提前移除 winner。

## 35.8 奖品不足

2 个可中奖邮箱 + 5 个奖品：

- 2 个 winner。
- 3 个 prize_item UNAWARDED。
- 活动 COMPLETED。

## 35.9 邮件

- 开奖成功后，即使 SMTP 断开，winner 记录存在且不能重抽。
- email job 失败按 1m/5m 重试，最多三次。
- FAILED 可手动重试。
- 邮件中变量正确替换私密 prize_content。

## 35.10 清理

活动完成 + 60 分钟：

- 仅删除未使用 campaign_codes。
- used_codes 永久保留。
- 把上一期原始码列表重新导入下一期时，已使用码自动跳过，未使用码可再次导入。

## 35.11 Email Alias

- `Test.User@gmail.com` 与 `testuser@gmail.com` 同一 canonical。
- `test+1@gmail.com` 默认拒绝。
- `x@notallowed.example` 拒绝。
- `x@sub.example.edu.cn` 在 `*.edu.cn` 下允许。

---

# 36. 开发阶段与提交顺序

## Phase 1：基础工程

- Next.js + TypeScript。
- PostgreSQL + Drizzle。
- Migration。
- Windows 11 开发环境。
- `/admin` 登录/session。
- 基础 Layout。

验收：本地用户页和后台页可访问，管理员可登录。

## Phase 2：活动/奖项

- campaigns。
- prize_tiers/prize_items。
- 活动 CRUD。
- 状态机。
- 一次一个 active 活动。

## Phase 3：核实兑换码

- Parser。
- HMAC。
- 预览。
- 导入。
- used_codes 全局账本。
- 库存统计。

## Phase 4：用户参与

- 邮箱域名规则。
- canonical email。
- 同邮箱多码汇总。
- 精确 code 校验。
- 并发事务。
- 满 N 锁定。
- 前台进度。

## Phase 5：开奖

- 冷却。
- 面值优先。
- 每张兑换码等权。
- 一期一个邮箱最多一奖。
- draw_runs。
- 手动/满人/定时三种触发。

## Phase 6：邮件

- SMTP。
- QQ preset。
- 模板变量。
- email_jobs。
- Worker 重试。
- 手动重试。

## Phase 7：后台完善

- Dashboard。
- 活动详情。
- 获奖记录。
- 运维记录。
- Worker heartbeat。
- 核实码定时清理。

## Phase 8：安全、测试、部署

- 限流。
- CSRF/Origin。
- 敏感日志审计。
- 单元/集成测试。
- Dockerfile。
- docker-compose production。
- Caddy。
- PostgreSQL backup。
- Linux VPS 上线。

---

# 37. AI 编程工具执行约束

将本规格交给 AI 编程工具时，应追加以下强制说明：

1. 不得自行把“面值优先”改写成金额比例加权随机。
2. 不得自行增加“一个邮箱一期只能一张码”的限制。
3. 同一邮箱累计面值必须是所有成功提交兑换码面值之和。
4. 参与人数只按不同 canonical_email 数量。
5. 每张兑换码等权模式必须让多张码产生多张等权票，但邮箱中奖后移除其全部票。
6. 所有 code 比较必须精确，不 trim、不 lower、不 upper、不 normalize。
7. 核实兑换码只能后台导入，不能通过 AI 中转站 API 拉取。
8. `used_codes.code_hash` 必须全局唯一。
9. 同一期 winner 必须由数据库唯一约束保证一个 participant 只能出现一次。
10. 开奖必须防重复触发；不能只依靠前端按钮 disabled。
11. 邮件发送与开奖事务解耦，SMTP 失败不能导致重新开奖。
12. 不得在日志中输出明文兑换码、SMTP 密码、私密奖品内容。
13. 不得为了“技术优雅”擅自引入 Redis、Kafka、RabbitMQ、微服务。
14. V1 以 Windows 11 可调试、Linux VPS Docker Compose 可部署为验收目标。
15. 开发任何新功能前，先检查是否与本文档的数据口径冲突。

---

# 38. README 必须包含的部署/维护说明

README 至少需要：

- Windows 11 + WSL2 开发安装步骤。
- `.env.example` 每个字段说明。
- 如何生成管理员密码 hash。
- 如何生成安全随机 secret。
- 如何启动 PostgreSQL。
- 如何 migrate。
- 如何启动 app。
- 如何启动 worker。
- 如何运行 test/lint/typecheck。
- 如何构建 production image。
- Linux VPS Docker Compose 上线步骤。
- 如何配置域名和 Caddy。
- 如何备份 PostgreSQL。
- 如何恢复数据库。
- 明确警告不要随意更换 CODE_HMAC_SECRET/CONFIG_ENCRYPTION_KEY。

---

# 39. 官方实现参考

用于开发环境和部署实现时，应优先参考官方文档而不是博客复制命令：

- Next.js 部署与自托管：`https://nextjs.org/docs/app/getting-started/deploying`
- Next.js Self-Hosting：`https://nextjs.org/docs/app/guides/self-hosting`
- Next.js 本地开发：`https://nextjs.org/docs/app/guides/local-development`
- Docker Desktop Windows 安装：`https://docs.docker.com/desktop/setup/install/windows-install/`
- Docker Desktop WSL 2：`https://docs.docker.com/desktop/features/wsl/`
- PostgreSQL 当前文档：`https://www.postgresql.org/docs/current/`
- QQ 邮箱帮助中心 SMTP 信息：`https://service.mail.qq.com/`

---

# 40. V1 最终验收定义（Definition of Done）

ByLucky V1 只有同时满足以下条件才算完成：

- Windows 11 浏览器可以完整使用用户端和后台。
- 本地可用 PostgreSQL + app + worker 完整跑通。
- 管理员可在 `/admin` 登录。
- 可创建一期活动并导入任意长度、大小写敏感核实码。
- 同邮箱可提交多张码，金额正确累计，人数只增加一次。
- 同一兑换码全局只能成功参与一次。
- 满 N 不同邮箱能够自动锁定并开奖。
- 指定时间能够自动锁定并开奖。
- 管理员能够手动开奖。
- 面值优先算法完全符合本文定义。
- 每张兑换码等权算法完全符合本文定义。
- 一期一个邮箱最多一奖。
- 默认最近 3 个已完成活动中奖邮箱不能再次中奖，但可参与。
- 奖品一行一个名额。
- 私密奖品不会公开泄漏。
- 中奖邮件进入队列并支持 3 次自动尝试和手动重试。
- 开奖结果不受邮件失败影响。
- 开奖后按配置延迟自动删除未使用核实码。
- 运维日志可以还原关键管理员/系统操作。
- 敏感信息不写应用日志。
- Docker Compose 能在 Linux VPS 启动 app、worker、postgres、caddy。
- HTTPS、数据库持久卷、数据库备份流程可用。
- 关键业务算法具备自动化测试。

**以上为 ByLucky（冰云抽奖）V1 的开发基线。任何偏离本文核心规则的实现，都应视为需求变更，而不是程序员自行优化。**