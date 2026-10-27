(() => {
  "use strict";

  const allQuestions = Array.isArray(window.STREET_QUESTIONS)
    ? window.STREET_QUESTIONS.filter((item) => item && item.id && item.question && item.answer)
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
    window.requestAnimationFrame(() => {
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

    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
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
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");

    toastTimer = window.setTimeout(() => {
      elements.toast.classList.remove("is-visible");
    }, 3200);
  }
})();
