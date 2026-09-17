# 腾讯微信云开发部署

## 需要的配置

| 配置 | 填写位置 | 用途 |
|---|---|---|
| 微信小程序 AppID | 被 Git 忽略的 `project.private.config.json` 的 `appid` | 编译、预览及提交 |
| 云环境 ID | `miniprogram/config.js` 的 `cloudEnv` | 云函数、数据库、头像存储 |
| 高德 Web 服务 Key | 云函数环境变量 `AMAP_WEB_KEY` | 手动生成真实道路路线 |

AppSecret 不需要写进此项目，也不要发送到聊天。高德 Key 只配置在云端环境变量，不能放到小程序包或公开仓库。

## 1. 创建腾讯云环境

使用自己的小程序 AppID 在微信开发者工具打开本项目，进入「云开发」，按平台流程开通环境。环境套餐、费用和开通确认由账户所有者处理。

建立三个数据库集合：

- `users`：文档 ID 是服务端取得的 OPENID。
- `roadbooks`：路书、作者、可见范围、完整轨迹与预览点。
- `rate_limits`：每用户每分钟规划次数。

三个集合都设置为 **客户端不可读写，仅云函数访问**。在自定义规则编辑器填写：

```json
{ "read": false, "write": false }
```

公开路书也经云函数读取，不能为了广场查询开放整个集合。云函数自己区分 `public` 和 `private`。

为 `roadbooks` 创建以下非唯一复合索引，字段顺序与方向如下：

| 场景 | 索引 |
|---|---|
| 公共广场 | `visibility` 升序、`updatedAt` 降序 |
| 按方式筛选 | `visibility` 升序、`mode` 升序、`updatedAt` 降序 |
| 我的路书 | `ownerId` 升序、`updatedAt` 降序 |
| 我的路书筛选 | `ownerId` 升序、`mode` 升序、`updatedAt` 降序 |

名称/城市搜索使用转义后的正则，不接受客户端自定义数据库条件。若控制台提示某个查询需要额外索引，以其给出的查询索引建议建立。

云存储使用「仅创建者可读写」权限。头像通过客户端上传到 `avatars/<本人 OPENID>/...`；云函数再次校验头像路径。当前头像只在本人的资料页/我的页面展示，不用于公开用户主页。

## 2. 部署云函数

```sh
npm ci
npm run build
npm ci --prefix cloudfunctions/roadbook
```

选择 Node.js 20 或更新的受支持运行时。函数名必须是 `roadbook`，超时建议 60 秒，内存 256 MB 或以上。高德规划最多 4 段并发，每用户每分钟最多 5 次请求，每次最多 20 个地点。

在微信开发者工具右键 `cloudfunctions/roadbook`，选择上传部署。保留整个目录中的 `vendor/` 与锁文件；使用支持 npm overrides 的安装环境（npm 8+）。若云端安装版本较旧，可本地 `npm ci` 后选择上传已安装依赖的方式。

在云函数配置中设置 `AMAP_WEB_KEY`。申请的 Key 类型应为高德「Web 服务」，不是 JS 地图 Key。开通需要的骑行、步行、驾车规划服务；具体配额及授权以高德控制台为准。

函数通过 `cloud.openapi.security.msgSecCheck` 对昵称和路书文字执行检查，所需权限已放在 `config.json`。若检查服务未配置或不可用，保存会失败，不会绕过检查发布内容。

客户端不传可信用户 ID。云函数使用 `cloud.getWXContext().OPENID` 获取身份；无用户文档时 `login` 创建账户。客户端配置切换为：

```js
module.exports = {
  mode: 'cloud',
  cloudEnv: '你的云环境 ID',
  cloudFunction: 'roadbook'
};
```

演示内容不会自动上传到真实公共库，正式环境初始为空。可以先导入一份自己确认过的 GPX。

## 3. 小程序权限与资料

- 在小程序后台申请 `chooseLocation` 位置选择接口权限；已在 `app.json` 声明对应权限和使用说明。
- 依据真实功能在小程序后台完成用户隐私保护指引：账户标识、用户主动填写的昵称/头像、用户选择和上传的路线坐标。项目不持续采集 GPS。
- 微信昵称/头像采用 `type="nickname"` 与 `chooseAvatar`，不调用过时的自动获取用户头像昵称流程。
- GPX 从微信聊天文件选择；导出写入小程序文件目录并通过 `wx.shareFileMessage` 转发到聊天，不能表述为已直接写入 iPhone「文件」App。

## 4. iPhone 真机验收（发布前必做）

1. 扫开发者工具预览码进入小程序，使用真实账户登录。
2. 地图选两个实际地点，生成骑行路线，确认沿路规划而不是直线。
3. 导入 GPX，核对地图位置与原始文件一致；导出后重新导入检查点数、分段、起终点。
4. 在路书详情点击「高德导航」，使用「打开地图选择高德」。确认微信位置页实际提供高德选项，能进入高德并设置自行车骑行。
5. 若当前微信未提供该入口，使用「复制高德路线链接」→ Safari 粘贴打开 → 按提示进入高德。确认带入的起终点与模式正确。
6. 验证未安装高德、用户取消、环线起终点重合、长路线、多个途经点场景。
7. 用第二个微信账户查看公开路书，再将其设为私密；第二账户刷新详情或导出必须失败。
8. 编辑冲突必须提示重新加载；云服务断开不能静默改为本地模式。

**只有第 4/5 步在目标 iPhone 上实际通过，才能验收“可以进入高德 App”。现有代码、桌面预览和编译成功都不能替代该验收。**

## 参考

- [微信位置接口](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.openLocation.html)
- [微信选择位置](https://developers.weixin.qq.com/miniprogram/dev/api/location/wx.chooseLocation.html)
- [微信头像昵称填写](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/userProfile.html)
- [微信文件转发](https://developers.weixin.qq.com/miniprogram/dev/api/share/wx.shareFileMessage.html)
- [高德 URI 路线接口](https://lbs.amap.com/api/uri-api/guide/travel/route)
- [高德路径规划 2.0](https://lbs.amap.com/api/webservice/guide/api/newroute)
- [CloudBase 事务限制](https://docs.cloudbase.net/database/transaction)
