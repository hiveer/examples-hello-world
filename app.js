(() => {
  "use strict";

  /*
   * 同构入口：
   * - 浏览器中：运行问答游戏
   * - Deno 中：作为静态文件服务器启动
   *
   * 这样部署平台即使把 app.js 当作 Deno 服务端入口执行，
   * 也不会再因为访问浏览器专属的 window / document 而崩溃。
   */
  if (typeof document !== "undefined") {
    startGame();
  } else if (typeof Deno !== "undefined" && typeof Deno.serve === "function") {
    startStaticServer();
  } else {
    console.warn("STREET QUIZ: 请在浏览器中打开 index.html，或使用 Deno 运行 app.js。");
  }

  /* ============================== 浏览器游戏 ============================== */

  function startGame() {
    const allQuestions = Array.isArray(globalThis.STREET_QUESTIONS)
      ? globalThis.STREET_QUESTIONS.filter((item) => item && item.id && item.question && item.answer)
      : [];

    const elements = {
      card: document.getElementById("quiz-card"),
      category: document.getElementById("category"),
      counter: document.getElementById("question-counter"),
      questionNo: document.getElementById("question-no"),
      question: document.getElementById("question-text"),
      progress: document.getElementById("progress-fill"),
      answerPanel: document.getElementById("answer-panel"),
      answerText: document.getElementById("answer-text"),
      answerNote: document.getElementById("answer-note"),
      revealButton: document.getElementById("reveal-btn"),
      revealLabel: document.getElementById("reveal-label"),
      revealIcon: document.getElementById("reveal-icon"),
      nextButton: document.getElementById("next-btn"),
      revealedCount: document.getElementById("revealed-count"),
      totalCount: document.getElementById("total-count"),
      introTotal: document.getElementById("intro-total"),
      footerTotal: document.getElementById("footer-total"),
      toast: document.getElementById("toast")
    };

    const state = {
      deck: [],
      position: 0,
      current: null,
      isRevealed: false,
      revealedIds: new Set()
    };

    let toastTimer = null;

    init();

    function init() {
      if (allQuestions.length === 0) {
        elements.category.textContent = "题库读取失败";
        elements.question.textContent = "没有找到题目，请刷新页面后再试一次。";
        elements.revealButton.disabled = true;
        elements.nextButton.disabled = true;
        return;
      }

      const total = allQuestions.length;
      elements.totalCount.textContent = total;
      elements.introTotal.textContent = total;
      elements.footerTotal.textContent = total;
      elements.revealedCount.textContent = "00";

      state.deck = buildDeck();
      drawQuestion({ initial: true });

      elements.revealButton.addEventListener("click", () => toggleAnswer());
      elements.nextButton.addEventListener("click", () => drawQuestion());
      document.addEventListener("keydown", handleShortcut);
    }

    /* 洗牌：Fisher–Yates，保证一轮内每道题只出现一次 */
    function shuffle(items) {
      const result = items.slice();
      for (let index = result.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
      }
      return result;
    }

    function buildDeck(avoidId) {
      const deck = shuffle(allQuestions);

      // 新一轮的第一题避开上一轮的最后一题，避免连续重复。
      if (deck.length > 1 && deck[0].id === avoidId) {
        const swapIndex = 1 + Math.floor(Math.random() * (deck.length - 1));
        [deck[0], deck[swapIndex]] = [deck[swapIndex], deck[0]];
      }

      return deck;
    }

    function drawQuestion({ initial = false } = {}) {
      if (state.position >= state.deck.length) {
        state.deck = buildDeck(state.current ? state.current.id : null);
        state.position = 0;

        if (!initial) {
          showToast("这一轮刷完了，已重新洗牌，开始新一轮！");
        }
      }

      const question = state.deck[state.position];
      state.position += 1;
      renderQuestion(question, { animate: !initial });
    }

    function renderQuestion(question, { animate = true } = {}) {
      state.current = question;
      state.isRevealed = false;

      resetAnswerState();
      elements.card.classList.remove("is-revealed");

      elements.category.textContent = question.category || "随机题";
      elements.question.textContent = question.question;
      elements.counter.textContent = `${formatNumber(state.position)} / ${formatNumber(allQuestions.length)}`;
      elements.questionNo.textContent = `NO. ${formatNumber(state.position)}`;
      elements.progress.style.width = `${(state.position / allQuestions.length) * 100}%`;

      elements.answerText.textContent = question.answer;
      elements.answerNote.textContent = question.note || "这道题暂时没有补充知识。";

      if (animate) {
        animateQuestionChange();
      }
    }

    function resetAnswerState() {
      // 切题时立即收起答案，避免上一题的答案在收起动画里一闪而过。
      elements.answerPanel.classList.add("is-instant");
      elements.answerPanel.classList.remove("is-open");
      elements.answerPanel.setAttribute("aria-hidden", "true");
      elements.revealButton.setAttribute("aria-expanded", "false");
      elements.revealButton.classList.remove("is-revealed");
      elements.revealLabel.textContent = "查看答案";
      elements.revealIcon.textContent = "↓";

      // 强制读取一次布局，让 is-instant 立即生效，再恢复动画。
      void elements.answerPanel.offsetWidth;
      globalThis.requestAnimationFrame(() => {
        elements.answerPanel.classList.remove("is-instant");
      });
    }

    function toggleAnswer(forceOpen) {
      if (!state.current) {
        return;
      }

      const shouldOpen = typeof forceOpen === "boolean" ? forceOpen : !state.isRevealed;
      if (shouldOpen === state.isRevealed) {
        return;
      }

      state.isRevealed = shouldOpen;
      elements.card.classList.toggle("is-revealed", shouldOpen);
      elements.answerPanel.classList.toggle("is-open", shouldOpen);
      elements.answerPanel.setAttribute("aria-hidden", String(!shouldOpen));
      elements.revealButton.setAttribute("aria-expanded", String(shouldOpen));
      elements.revealButton.classList.toggle("is-revealed", shouldOpen);
      elements.revealLabel.textContent = shouldOpen ? "收起答案" : "查看答案";
      elements.revealIcon.textContent = shouldOpen ? "↑" : "↓";

      if (shouldOpen) {
        state.revealedIds.add(state.current.id);
        updateRevealedCount();
      }
    }

    function updateRevealedCount() {
      const count = state.revealedIds.size;
      elements.revealedCount.textContent = formatNumber(count);

      if (!globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        elements.revealedCount.animate(
          [
            { transform: "translateY(0)" },
            { transform: "translateY(-5px)", opacity: 0.45 },
            { transform: "translateY(0)", opacity: 1 }
          ],
          { duration: 330, easing: "ease-out" }
        );
      }
    }

    function animateQuestionChange() {
      if (globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
      }

      [elements.category, elements.question].forEach((element) => {
        element.getAnimations().forEach((animation) => animation.cancel());
      });

      elements.question.animate(
        [
          { opacity: 0, transform: "translateY(13px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 390, easing: "cubic-bezier(.2,.8,.2,1)" }
      );

      elements.category.animate(
        [
          { opacity: 0, transform: "translateY(-5px)" },
          { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 320, easing: "ease-out" }
      );
    }

    function handleShortcut(event) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target;
      const isTyping =
        target instanceof Element &&
        Boolean(target.closest("input, textarea, select, [contenteditable='true']"));

      if (isTyping) {
        return;
      }

      if (event.key === " " || event.key === "Spacebar") {
        const isButton = target instanceof Element && Boolean(target.closest("button, a"));
        if (isButton) {
          return;
        }
        event.preventDefault();
        toggleAnswer();
        return;
      }

      if (event.key.toLowerCase() === "n") {
        event.preventDefault();
        if (!event.repeat) {
          drawQuestion();
        }
        return;
      }

      if (event.key === "Escape" && state.isRevealed) {
        toggleAnswer(false);
      }
    }

    function formatNumber(value) {
      return String(value).padStart(2, "0");
    }

    function showToast(message) {
      globalThis.clearTimeout(toastTimer);
      elements.toast.textContent = message;
      elements.toast.classList.add("is-visible");

      toastTimer = globalThis.setTimeout(() => {
        elements.toast.classList.remove("is-visible");
      }, 3200);
    }
  }

  /* ============================== Deno 静态服务 ============================== */

  function startStaticServer() {
    const rootUrl = getStaticRootUrl();
    const parsedPort = Number.parseInt(readEnv("PORT", "8000"), 10);
    const port = Number.isInteger(parsedPort) && parsedPort >= 0 && parsedPort <= 65535 ? parsedPort : 8000;
    const hostname = readEnv("HOST", "0.0.0.0");

    try {
      Deno.serve(
        {
          hostname,
          port,
          onListen({ hostname: listeningHost, port: listeningPort }) {
            console.log(`STREET QUIZ running at http://${listeningHost}:${listeningPort}/`);
            console.log(`Static root: ${rootUrl.pathname}`);
          }
        },
        (request) => handleStaticRequest(request, rootUrl)
      );
    } catch (error) {
      console.error("STREET QUIZ server failed to start:", error);
      Deno.exit(1);
    }
  }

  function getStaticRootUrl() {
    try {
      if (Deno.mainModule) {
        return new URL(".", Deno.mainModule);
      }
    } catch {
      // fall through
    }

    try {
      return new URL("./", `file://${Deno.cwd()}/`);
    } catch {
      return new URL("file:///app/src/");
    }
  }

  async function handleStaticRequest(request, rootUrl) {
    const method = request.method.toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD", "Content-Type": "text/plain; charset=utf-8" }
      });
    }

    let url;
    try {
      url = new URL(request.url);
    } catch {
      return badRequest();
    }

    if (url.pathname === "/health" || url.pathname === "/healthz") {
      return new Response(JSON.stringify({ status: "ok", service: "street-quiz" }), {
        status: 200,
        headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }
      });
    }

    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return badRequest();
    }

    if (pathname === "/" || pathname === "") {
      pathname = "/index.html";
    } else if (pathname.endsWith("/")) {
      pathname += "index.html";
    }

    const segments = pathname.split("/").filter(Boolean);
    const hasUnsafeSegment = segments.some(
      (segment) => segment === ".." || segment.startsWith(".") || segment.includes("\\") || segment.includes("\0")
    );

    if (segments.length === 0 || hasUnsafeSegment) {
      return notFound();
    }

    let fileUrl;
    try {
      fileUrl = new URL(segments.join("/"), rootUrl);
    } catch {
      return notFound();
    }

    // 双重检查，防止 URL 归一化后越出站点根目录。
    if (!fileUrl.href.startsWith(rootUrl.href)) {
      return notFound();
    }

    try {
      const info = await Deno.stat(fileUrl);
      if (!info.isFile) {
        return notFound();
      }

      const data = await Deno.readFile(fileUrl);
      const headers = new Headers({
        "Content-Type": contentTypeFor(fileUrl.pathname),
        "Content-Length": String(data.byteLength),
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "no-referrer"
      });

      return new Response(method === "HEAD" ? null : data, { status: 200, headers });
    } catch (error) {
      if (error instanceof Deno.errors.PermissionDenied) {
        console.error(
          "STREET QUIZ cannot read static files. Start Deno with --allow-read (or use: deno run -A app.js)."
        );
        return new Response("Server is missing read permission for static files.", {
          status: 500,
          headers: { "Content-Type": "text/plain; charset=utf-8" }
        });
      }

      return notFound();
    }
  }

  function contentTypeFor(pathname) {
    const extension = pathname.split(".").pop()?.toLowerCase();
    const types = {
      html: "text/html; charset=utf-8",
      css: "text/css; charset=utf-8",
      js: "text/javascript; charset=utf-8",
      mjs: "text/javascript; charset=utf-8",
      json: "application/json; charset=utf-8",
      svg: "image/svg+xml",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      ico: "image/x-icon",
      txt: "text/plain; charset=utf-8",
      md: "text/markdown; charset=utf-8",
      woff: "font/woff",
      woff2: "font/woff2"
    };

    return types[extension] || "application/octet-stream";
  }

  function notFound() {
    return new Response("404 · 这里没有你要找的页面。", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  function badRequest() {
    return new Response("400 · 请求地址不正确。", {
      status: 400,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }
    });
  }

  function readEnv(name, fallback) {
    try {
      return Deno.env.get(name) || fallback;
    } catch {
      return fallback;
    }
  }
})();
