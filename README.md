# 街头问答 · STREET QUIZ

一个街头海报风格的随机问答小游戏。首次进入随机抽题，一轮 50 题不重复，支持查看答案、收起答案和下一题。

## 打开游戏

直接双击 `index.html` 即可玩；也可以在当前目录启动一个本地静态服务器：

```bash
cd streetgame
python3 -m http.server 8123
```

然后访问 <http://127.0.0.1:8123>。

## Deno 部署 / 运行

`app.js` 现在是同构入口：

- 在浏览器中加载时，运行问答游戏；
- 在 Deno 中执行时，自动启动静态文件服务器，默认监听 `0.0.0.0:8000`，并读取部署平台注入的 `PORT` / `HOST` 环境变量。

本地运行：

```bash
cd streetgame
deno run -A app.js
# 或
deno task start
```

指定端口：

```bash
PORT=8080 deno run -A app.js
```

健康检查接口：`/health` 或 `/healthz`。

> 如果部署平台把 `app.js` 指定为入口，现在不会再出现 `window is not defined`。
> 若平台使用自定义启动命令，请确保至少允许 `--allow-net`、`--allow-read`、`--allow-env`（`-A` 最省事）。

## 玩法

- 进入页面会随机出现一道题。
- 点击「查看答案」揭晓参考答案和小知识，可再次点击收起。
- 点击「下一题」随机进入下一道未出现的题。
- 50 题全部刷完后会自动重新洗牌，开启新一轮，并避免和上一题连续重复。
- 桌面端支持快捷键：`空格` 查看 / 收起答案，`N` 下一题，`Esc` 收起答案。

## 修改题库

所有题目都在 `questions.js` 的 `globalThis.STREET_QUESTIONS` 数组中，每道题的格式如下：

```js
{
  id: "q01",
  category: "生活常识",
  question: "题目内容？",
  answer: "参考答案。",
  note: "补充的小知识。"
}
```

新增或删除题目后刷新页面即可，题数、进度和洗牌逻辑会自动适配。

## 文件结构

```
streetgame/
├── index.html      # 页面结构
├── styles.css      # 街头海报视觉与响应式布局
├── questions.js    # 50 道题库
├── app.js          # 浏览器游戏逻辑 + Deno 静态服务器
├── deno.json       # Deno 启动任务
└── README.md
```

