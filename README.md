# trae-work-checkin-plus

一个 Trae 自定义 **Skill**：本机自动领取 Trae Work（TraeCode/CN 客户端）每日签到积分，并可只读查询当前积分余额。

> 保留了 `SKILL.md`、`lib.js`、`balance.js`、`checkin.js`、`run-checkin.sh` 的原始结构与命名，方便用 TRAE 的「手动导入外部技能」方式整体导入。

## 功能

- **每日签到**：`node scripts/checkin.js` —— 幂等；今日已签则跳过，未签则调用官方领取接口签到（基础 + 额外奖励）。
- **余额查询**：`node scripts/balance.js`（`--json` 输出原始数据）—— 只读，不修改任何数据。
- **自动读本地登录态**：读客户端 `storage.json` 中的 `iCubeAuthInfo://icube.cloudide`（`tc` 加密格式）取令牌，临期自动用 refreshToken 换新，无需重复登录。
- **系统级定时**：`scripts/run-checkin.sh` 是 cron / launchd 的包装脚本，运行不依赖客户端是否打开。

## 安装（作为 Skill 导入）

1. 下载本仓库打包的 zip 或直接拉取目录。
2. 在 TraeCode 的「技能」面板选择 **手动导入外部技能**，上传 `SKILL.md`（或含 `SKILL.md` 的 zip）。
3. 确认自动填充的名称 / 描述 / 指令后确定。

## 用法

```bash
node scripts/checkin.js    # 签到
node scripts/balance.js    # 查积分

# 系统级每日定时(每天09:00)
crontab:
0 9 * * * /path/to/run-checkin.sh
# 或 macOS launchd（见 scripts/run-checkin.sh 注释）
```

## 安全说明

- 令牌只在脚本内存中，**绝不打印 / 落盘 / 上传**。
- 只对本机已登录的本人账号操作；**禁止批量账号 / 刷奖 / 绕过验证**。
- 登录态解密与所用接口均为逆向自官方客户端的非公开实现，可能随客户端版本变化（失效时需同步更新）。

## 免责声明

本项目仅供学习与个人自动化使用。请遵守 TRAE 平台规则，仅用于自己有账号的机器。若你使用本项目产生的任何违规后果，由使用者自担。

## License

[MIT](./LICENSE)