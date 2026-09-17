# 路书 · 微信小程序 MVP

原生微信小程序 + 腾讯微信云开发。支持公共路书库、GPX 导入导出、多地点规划、作者身份、公开/私密权限，以及高德导航入口。

**当前为已接入正式云环境的开发版本。云函数、数据库权限、索引和高德真实道路规划均已验证；iPhone 高德真机验收尚未完成。结果以 [验收记录](docs/VERIFICATION.md) 为准，不能视为已发布的小程序。**

## 先体验

需要 Node.js 20+。在项目根目录执行：

```sh
npm ci
npm run build
npm run preview
```

访问 <http://127.0.0.1:4173>。浏览器预览支持浏览、搜索、筛选、体验登录、创建/编辑、GPX 导入、导出下载和高德链接。预览使用与小程序相同的 GPX、坐标转换和演示数据服务，不是真实微信运行环境。浏览器中的手动规划只生成示意连线，正式道路规划需要高德 Web 服务 Key。

## 微信小程序

1. 注册小程序，把 `project.private.config.example.json` 中的示例复制到被 Git 忽略的 `project.private.config.json`，并填写真实 AppID。
2. 微信开发者工具导入项目根目录；小程序目录已配置为 `miniprogram/`。
3. `miniprogram/config.js` 已切换为 `mode: 'cloud'`，指向本项目的微信云开发环境。
4. 数据库、云函数与高德 Web 服务 Key 已经配置，可继续真机验收。

本机微信开发者工具已登录，并已确认能识别项目 AppID 与云环境。

## 配置与密钥

- 高德 Web 服务 Key 只从云函数环境变量 `AMAP_WEB_KEY` 读取，参考 [`.env.example`](.env.example)。不要把真实值写入源码、文档或 Git。
- 微信 AppID 和云环境 ID 是客户端运行所需的标识，不具备 AppSecret 或云端管理权限。公开仓库仍使用 `touristappid` 占位，真实 AppID 放在被 Git 忽略的 `project.private.config.json`。
- `project.private.config.json`、`.env*`、本地依赖、验收产物和预览二维码均不进入版本库。

## 已实现的功能

| 功能 | 本机演示 | 云开发模式 |
|---|---|---|
| 路书广场、搜索、出行方式筛选、分页 | 示例及本机公开内容 | 公共数据库 |
| 详情、完整地图轨迹、距离与标记点 | 示例地图/轨迹 | 微信原生地图 |
| GPX 导入 | 浏览器文件/微信聊天文件 | 小程序本地解析后存云端 |
| 手动多地点制作 | 明确标注的示意连线 | 高德逐段规划，最多 20 个地点 |
| 路书编辑、删除、草稿 | 本机持久化；小程序新建草稿自动保留 | 服务端作者校验、版本冲突保护 |
| GPX 导出 | 浏览器下载；小程序转发文件到聊天 | 重新鉴权读取后导出 |
| 用户 | 本机体验身份 | 微信云函数获取 OPENID，用户填写昵称头像 |
| 公开/私密 | 本机可见范围演示 | 服务端权限校验，私密链接不能越权 |
| 分享 | 不支持跨用户分享 | 仅公开路书可分享小程序卡片 |
| 高德 | 路线 URL 与接入说明 | 微信位置页入口 + Safari 路线链接 |

## 高德导航的准确边界

- 「打开地图选择高德」调用微信 `wx.openLocation`，仅传递所选目的地。用户在微信位置页选择路线和高德；是否显示高德以及具体操作步骤取决于微信/iOS/高德版本。**尚未在 iPhone 验收，不能宣称已经实现微信内一键直达高德。**
- 「复制高德路线链接」包含原路书起点、终点、出行方式和 `callnative=1`。用户将链接粘贴到 iPhone Safari，按提示打开高德。
- 骑行 URL 不传未经确认支持的途经点。驾车恰好一个中途点时，使用官方支持的 `via`。
- 不保证高德生成的路线与原路书一致。环线起终点重合时明确提示可能生成零距离路线。
- 小程序不做导航、连续 GPS 记录或后台定位。

高德官方明确说明部分第三方内置浏览器（包括微信）无法成功唤起客户端。见 [官方 URI 文档](https://lbs.amap.com/api/uri-api/guide/travel/route) 和 [微信位置接口](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.openLocation.html)。

## 数据约定

- 原始轨迹统一保存为 **WGS84**；地图显示和高德参数转换成 GCJ-02。
- GPX 文件最大 3 MB、8000 个轨迹点、100 段；禁止 DTD/实体声明。支持 GPX 1.0/1.1 风格 `trk/trkseg/trkpt` 和 `rte/rtept`，优先轨迹。
- 保留不连续轨迹分段；距离不会连接不同分段。无海拔时显示未知，不造出爬升数据。
- 用户导入轨迹不重新算路。手动路线保存用户确认的规划结果，查看时不重新请求地图服务。
- 高德规划失败或断段会报错，不用直线伪装成道路。
- KML、FIT、TCX、多日行程、评论、点赞、实时运动记录暂未实现。

## 开发与验证

```sh
npm run check
npm audit
npm ci --prefix cloudfunctions/roadbook
npm audit --prefix cloudfunctions/roadbook
```

`check` 构建共享代码、检查 JS/JSON、调用本机微信官方 WXML/WXSS 编译器（可用时），并运行自动化测试。Mac 编译器路径可用 `WECHAT_COMPILER_DIR` 覆盖。没有编译器时会明确打印跳过，不冒充模拟器验证。

当前 35 项自动化测试及官方 WXML 编译产物的列表、登录状态、编辑页切换检查通过。真实云端联调记录和仍需真机验证的项目见 [验收记录](docs/VERIFICATION.md)。

`shared/` 是 GPX、地理和路书逻辑的源文件，`npm run build` 生成 `miniprogram/lib/core.js`、`cloudfunctions/roadbook/core.js`、`preview/core.js` 等；请勿手改这些产物。

云 SDK 4.0.2 锁定了旧的 Axios 和已停止维护的 lodash 单函数包。云函数使用 `overrides` 将 Axios 更新到兼容的 0.33.0，并通过两个小型适配包引用 lodash 4.18.1 的 `set/unset`。部署时必须保留 `vendor/`、`package-lock.json` 并使用 npm 8+；适配函数有测试覆盖，并已在当前云环境完成真实读写联调。

## 目录

```text
miniprogram/             原生微信小程序，6 个页面
cloudfunctions/roadbook/ 云端身份、权限、持久化、内容检查、路线规划
shared/                 GPX、坐标转换、路书规则、演示样本
preview/                可交互浏览器预览，明确标注为演示
tests/                  文件、坐标、权限、事务与页面逻辑测试
docs/                   部署说明、需求边界、验收清单
scripts/                构建、编译检查、本地预览服务
```
