# 考公学习工作台（双人备考 APP）

移动端优先的考公备考工作台：考试倒计时、学习计划、科目进度、成绩记录、艾宾浩斯复习、
新闻时事、申论素材库，以及**双人（小硕咪 & 秋秋）数据云同步**。

## 部署（推荐：Cloudflare Pages，中国大陆通常可达）

> Render / Heroku / Railway 等在中国大陆常被墙或极慢，本仓库已改为 Cloudflare Pages 原生方案。

1. 注册/登录 [Cloudflare](https://dash.cloudflare.com)（用 GitHub 账号登录最省事）。
2. 左侧 **Workers 和 Pages → 创建 → Pages → 连接到 Git** → 选本仓库 `kaogong-workbench`。
3. 构建设置：
   - 框架预设：**无（无框架）** / `None`
   - 构建命令：**留空**
   - 构建输出目录：**`.`**（根目录，仓库里已用 `wrangler.toml` 的 `pages_build_output_dir` 声明）
   - 点击 **保存并部署**。
4. 部署完成后，进入项目 **设置 → Functions → KV 命名空间绑定**：
   - 变量名填 **`SYNC_KV`**
   - 命名空间选「新建」一个（任意名字，如 `kaogong-sync`）
   - 保存（绑定后同步才会生效，否则前端会自动降级为本机存储）。
5. 几秒后，你会得到一个永久地址：`https://kaogong-workbench.pages.dev`。
   **手机 / iPad / 电脑都打开这个地址并收藏**，数据自动跨设备共享。

### 可选：自定义域名（Cloudflare 免费）
若 `*.pages.dev` 在你网络下偏慢，可在 Cloudflare 绑定任意域名（含免费域名），
经 Cloudflare 网络分发，通常比默认地址更快更稳。

## 其它部署方式（备选，非中国首选）
- `server.js` + `package.json`：标准 Node 服务（托管前端 + `/api/state`），适合自有服务器。
- `render.yaml`：Render 一键部署配置（Render 在中国大陆常被墙，故非首选）。

## 数据同步说明
- 默认房间号 `kaogong-shared`，两人共用即可。
- 同步采用**字段级合并**：A 设备改了「成绩」、B 设备改了「打卡」，互不影响，不会互相覆盖。
- 右上角 ⚙ 可查看同步状态，或手动改「同步服务器地址 / 房间号」。
- 无网络/未绑 KV 时自动降级为浏览器本机存储，不报错。
