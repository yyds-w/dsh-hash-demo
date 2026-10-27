# dsh-hash-demo

一个**最小可运行**的 DeepSeek Harness（dsh）插件，照着官方 `dshmarket` 插件的结构写的，
用来跑通「写插件 → 装进 profile → 启动 → 模型调用」的完整闭环。

它注册了一个工具 `hash_text`：给定文本 + 算法（md5/sha1/sha256/sha512），用 Node 的
`crypto` 算出**真实、100% 正确**的哈希值——弥补大模型自己算哈希会算错的问题（正是视频里选的例子）。

## 文件结构

```
dsh-hash-demo/
├── package.json      # 插件身份 + dsh.bundle.patch 指向下面这个文件
├── index.js          # apply(ctx) → ctx.tools.register(defineTool({...}))
└── cordis.patch.yml  # 把本插件插进 profile 的 layer 栈
```

## 三个核心概念

- **Plugin（插件）** = 导出 `name` / `inject` / `apply(ctx)` 的 cordis 插件。
  在 `apply` 里通过 `ctx.tools.register(...)` 注册工具；卸载时自动清理。
- **Tool（工具）** = 模型在对话里实际调用的函数，由你注册、模型自己决定何时调用。
- **Profile（配置档案）** = 机器上记录「装了哪些插件」的启动配置；装进 profile → 启动即生效。

## 安装进 web profile

> ⚠️ **本机 dsh 是源码跑法，没有全局 `dsh` 命令**（不是 pnpm 的问题——pnpm 11.23.0 实测可用）。
> 本机目前用下面的手动安装（已验证可用）。
>
> ✅ **`dsh` 全局命令已配好（2026-09-22）**：做了 shim `%APPDATA%\npm\dsh.cmd`
> （该目录已在 PATH 上），内容是 pushd 到 harness 目录后用 `node --import tsx/esm apps/cli/src/bin.ts %*` 启动。
> PowerShell / cmd / Git Bash 里现在都能直接敲 `dsh web --no-open`、`dsh plugin --profile web add <路径>`。
> 注意：bash 语法的 `alias dsh='...'` 在 PowerShell 里无效；PS 的 `Set-Alias` 也不能带参数，所以用 .cmd shim。

<details><summary>官方命令（pnpm 正常时可用，本机先别跑）</summary>

```bash
dsh plugin --profile web add <本仓库所在目录>/dsh-hash-demo
```

装完会做两件事：
1. 把插件放进 `~/.dsh/profiles/web/node_modules/dsh-hash-demo`
2. 把 `dsh-hash-demo` 追加进 `~/.dsh/profiles/web/package.json` 的 `dsh.profile.bundles`

</details>

### 本机实际用的手动安装（pnpm 坏了时的替代）

```bash
# 1) 复制插件目录进 profile 的 node_modules
cp -r <本仓库所在目录>/dsh-hash-demo ~/.dsh/profiles/web/node_modules/dsh-hash-demo
# 2) 编辑 ~/.dsh/profiles/web/package.json，把 "dsh-hash-demo": "1.0.0" 加进 dependencies，
#    把 "dsh-hash-demo" 加进 dsh.profile.bundles
```

### 验证（不启动也能查）
打开 `~/.dsh/profiles/web/package.json`，确认 `dsh.profile.bundles` 里多了 `dsh-hash-demo`。

## 启动 dsh web（从源码）

```bash
cd "<harness 源码目录>"
node --import tsx/esm apps/cli/src/bin.ts "web" --no-open
```

网页端口会漂移（默认不一定是 3000，实测在 3080），用下面的命令确认再访问：

```bash
# Windows 原生（cmd / PowerShell / Git Bash 都能用）：
netstat -ano | findstr ":3080"
# 或用 Python 兜底（任何环境都稳）：
python -c "import os,subprocess; t=subprocess.run(['netstat','-ano'],capture_output=True).stdout.decode('gbk','ignore'); [print(l) for l in t.splitlines() if ':3080' in l]"
```

## 在对话里测试

对模型说：

> 帮我用 hash_text 算一下 "123456" 的 md5 和 sha256

模型应该会自动调用 `hash_text` 工具并给出正确结果。终端里也会打印：
`[dsh-hash-demo] hash_text called with algorithm=md5`

## 卸载

```bash
dsh plugin --profile web remove dsh-hash-demo
```

## 踩坑提示

- **不需要、也不要 `npm install`**：插件是纯 ESM + 免构建，`@deepseek-ai/*` 走 harness 运行时桥接，
  装依赖是多余动作。npm 7+ 还会自动安装 peerDependencies——一旦里面混进不存在的包名
  （如手滑写了 `@deepseek-ai/schematery`），`npm install` 直接 `E404` 报错中断。
- **开发副本 ≠ 运行副本**：放在别处（如 harness 仓库里）的目录只是开发副本，
  dsh web 实际加载的是 `~/.dsh/profiles/web/node_modules/dsh-hash-demo`。改完代码要**同步拷贝过去**（或直接改那份）才生效。
- **不要重复 add 同一个插件**：会报「id 重复」类错误。先 `remove` 再 `add`。
- **改 `index.js`**：多数情况下热重载即可，不用重启；若改了 `package.json` 或依赖，需重新跑 `dsh plugin --profile web add`。
- **端口被占**：之前 `dsh web` 进程还在 → 杀掉 3080 端口进程再启动。

## 换成你自己的工具

只改 `index.js` 里 `defineTool({...})` 的 `execute` 即可，骨架不用动：
- `name`：工具名（模型看到的）
- `description`：模型决定「何时调用」的依据，写清楚
- `parameters`：参数 schema（`type` 支持 string/number/integer/boolean/array/object/null/oneOf）
- `output`：规范输出声明 + `render`
- `execute(args)`：你的实际逻辑，返回 `output.schema` 声明类型的值

例如做一个「查天气」「调内部 API」「读本地文件」的工具，都只是替换 `execute` 里的实现。

### ⚠️ 参数 schema 的硬性规则（踩过坑）

`defineTool` 的 schema 编译器走**严格 JSON Schema 校验**，和常见的 JSON-Schema 写法不一样：

- **必填参数**：必须写 `required: true`。
- **可选参数**：**直接不写 `required`**，不要写 `required: false`！
- 一旦写了 `required` 又不是 `true`，启动会直接崩：
  `unsupported JSON schema: parameters.<x>.required must be true when present`
  这个错误会让**整个插件树加载失败、dsh web 直接退出**（终端看起来就是「空 hang 没反应」）。

本插件的 `algorithm` 就是故意写成可选（不写 `required`）的正确示范。
