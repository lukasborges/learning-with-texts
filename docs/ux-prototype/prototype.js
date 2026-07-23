const screens = new Map(
  [...document.querySelectorAll(".screen")].map((screen) => [
    screen.id.replace("screen-", ""),
    screen
  ])
);

const navigationButtons = [
  ...document.querySelectorAll("[data-screen-target]")
];

function showScreen(name) {
  const target = screens.get(name);
  if (!target) return;

  screens.forEach((screen, screenName) => {
    const active = screenName === name;
    screen.classList.toggle("is-active", active);
    screen.hidden = !active;
  });

  document.querySelectorAll(".nav-item, .bottom-nav button").forEach((button) => {
    const active = button.dataset.screenTarget === name;
    button.classList.toggle("is-active", active);
  });

  window.scrollTo({ top: 0, behavior: "instant" });
  target.querySelector("h1")?.setAttribute("tabindex", "-1");
  target.querySelector("h1")?.focus({ preventScroll: true });
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => {
    showScreen(button.dataset.screenTarget);
  });
});

document.querySelectorAll(".open-reader").forEach((button) => {
  button.addEventListener("click", () => showScreen("reader"));
});

const importDialog = document.querySelector("#import-dialog");
document.querySelectorAll("[data-open-import]").forEach((button) => {
  button.addEventListener("click", () => {
    importDialog?.showModal();
  });
});

const completeReadingButton = document.querySelector("#complete-reading");

const previewStateToggle = document.querySelector("#preview-state-toggle");
const populatedHomeState = document.querySelector("#home-populated-state");
const emptyHomeState = document.querySelector("#home-empty-state");
const populatedLibraryState = document.querySelector("#library-populated-state");
const emptyLibraryState = document.querySelector("#library-empty-state");
const reviewBadge = document.querySelector(".nav-badge");
const backupStatus = document.querySelector("#backup-status");
const activeLanguageCode = document.querySelector("#active-language-code");
const activeLanguageLabel = document.querySelector("#active-language-label");

previewStateToggle?.addEventListener("click", () => {
  const showFirstUse = emptyHomeState?.hidden ?? true;
  if (populatedHomeState) populatedHomeState.hidden = showFirstUse;
  if (emptyHomeState) emptyHomeState.hidden = !showFirstUse;
  if (populatedLibraryState) populatedLibraryState.hidden = showFirstUse;
  if (emptyLibraryState) emptyLibraryState.hidden = !showFirstUse;
  if (reviewBadge) reviewBadge.hidden = showFirstUse;
  if (backupStatus) {
    backupStatus.textContent = showFirstUse
      ? "No backup created yet"
      : "Last backup: today, 9:42 AM";
  }
  if (activeLanguageCode) activeLanguageCode.textContent = showFirstUse ? "—" : "EN";
  if (activeLanguageLabel) {
    activeLanguageLabel.textContent = showFirstUse ? "No language set" : "English";
  }
  previewStateToggle.textContent = showFirstUse
    ? "Preview returning user"
    : "Preview first use";
  const visibleHeading = showFirstUse
    ? emptyHomeState?.querySelector("h1")
    : populatedHomeState?.querySelector("h1");
  visibleHeading?.setAttribute("tabindex", "-1");
  visibleHeading?.focus({ preventScroll: true });
});

document.querySelector("#first-language-form")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const learningLanguage =
    document.querySelector("#inline-learning-language")?.value ?? "English";
  if (activeLanguageCode) {
    activeLanguageCode.textContent = learningLanguage.slice(0, 2).toUpperCase();
  }
  if (activeLanguageLabel) activeLanguageLabel.textContent = learningLanguage;
  const importLanguage = importDialog?.querySelector("select");
  if (importLanguage) importLanguage.value = learningLanguage;
  importDialog?.showModal();
});

document.querySelectorAll(".source-tabs button").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".source-tabs button")
      .forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
  });
});

const themeToggle = document.querySelector("#theme-toggle");
themeToggle?.addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme === "dark";
  root.dataset.theme = dark ? "light" : "dark";
});

const librarySearch = document.querySelector("#library-search");
librarySearch?.addEventListener("input", () => {
  const query = librarySearch.value.trim().toLocaleLowerCase();
  let visible = 0;
  document.querySelectorAll("#screen-library .book-card").forEach((card) => {
    const matches = `${card.dataset.title} ${card.dataset.language}`.includes(query);
    card.hidden = !matches;
    if (matches) visible += 1;
  });
  document.querySelector("#search-empty").hidden = visible !== 0;
});

const termPanel = document.querySelector(".term-panel");
const termTitle = document.querySelector("#term-panel-title");
const termTranslation = document.querySelector("#term-translation");
const contextMark = document.querySelector(".context-box mark");

document.querySelectorAll(".word").forEach((word) => {
  word.addEventListener("click", () => {
    document
      .querySelectorAll(".word")
      .forEach((candidate) => candidate.classList.toggle("is-selected", candidate === word));

    if (termTitle) termTitle.textContent = word.dataset.term ?? word.textContent;
    if (termTranslation) termTranslation.value = word.dataset.translation ?? "";
    if (contextMark) contextMark.textContent = word.dataset.term ?? word.textContent;

    document.querySelectorAll("[data-status-value]").forEach((button) => {
      button.classList.toggle(
        "is-selected",
        button.dataset.statusValue === word.dataset.status
      );
    });

    termPanel?.classList.add("is-open");
  });
});

document.querySelector("#close-term-panel")?.addEventListener("click", () => {
  termPanel?.classList.remove("is-open");
});

document.querySelectorAll("[data-status-value]").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll("[data-status-value]")
      .forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
  });
});

document.querySelectorAll(".translation-options button").forEach((button) => {
  button.addEventListener("click", () => {
    document
      .querySelectorAll(".translation-options button")
      .forEach((candidate) => candidate.classList.toggle("is-selected", candidate === button));
    if (termTranslation) termTranslation.value = button.textContent.trim();
  });
});

const toast = document.querySelector("#toast");
const undoFinishButton = document.querySelector("#undo-finish");
let toastTimer;

function showToast(
  title = "Term saved",
  message = "The translation and status were updated.",
  { showUndo = false } = {}
) {
  if (!toast) return;
  window.clearTimeout(toastTimer);
  toast.querySelector("strong").textContent = title;
  toast.querySelector(".toast-message").textContent = message;
  if (undoFinishButton) undoFinishButton.hidden = !showUndo;
  toast.classList.toggle("toast--action", showUndo);
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, showUndo ? 6000 : 2800);
}

document.querySelector("#save-term")?.addEventListener("click", () => showToast());

document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    if (screens.get("reader")?.classList.contains("is-active")) {
      showToast();
    }
  }

  if (screens.get("review")?.classList.contains("is-active")) {
    if (event.code === "Space" && !document.querySelector("#reveal-answer")?.hidden) {
      event.preventDefault();
      revealReviewAnswer();
    }
    if (["1", "2", "3", "4"].includes(event.key)) {
      document
        .querySelectorAll("#review-rating button")
        [Number(event.key) - 1]?.click();
    }
  }
});

const revealButton = document.querySelector("#reveal-answer");
const reviewAnswer = document.querySelector("#review-answer");
const reviewRating = document.querySelector("#review-rating");

function revealReviewAnswer() {
  if (revealButton) revealButton.hidden = true;
  if (reviewAnswer) reviewAnswer.hidden = false;
  if (reviewRating) reviewRating.hidden = false;
}

revealButton?.addEventListener("click", revealReviewAnswer);

document.querySelectorAll("#review-rating button").forEach((button) => {
  button.addEventListener("click", () => {
    const label = button.querySelector("strong")?.textContent ?? "Answer";
    showToast(`${label} recorded`, "The next review was scheduled.");
    window.setTimeout(() => {
      if (revealButton) revealButton.hidden = false;
      if (reviewAnswer) reviewAnswer.hidden = true;
      if (reviewRating) reviewRating.hidden = true;
    }, 450);
  });
});

let wordsMarkedAtFinish = [];

function markReadingComplete() {
  wordsMarkedAtFinish = [...document.querySelectorAll(".word--new")];
  completeReadingButton.textContent = "Lesson finished ✓";
  completeReadingButton.disabled = true;

  wordsMarkedAtFinish.forEach((word) => {
    word.classList.remove("word--new");
    word.classList.add("word--known");
    word.dataset.status = "known";
  });
  const markedTermCount = new Set(
    wordsMarkedAtFinish.map((word) => word.dataset.term?.toLocaleLowerCase())
  ).size;
  const knownTerms = 138 + markedTermCount;
  const progressBar = document.querySelector("#reader-progress-bar");
  const progressLabel = document.querySelector("#reader-progress-label");
  if (progressBar) progressBar.style.width = `${(knownTerms / 184) * 100}%`;
  if (progressLabel) progressLabel.textContent = `${knownTerms} of 184 terms known`;
  const wordLabel = markedTermCount === 1 ? "word was" : "words were";
  showToast(
    "Lesson finished",
    `${markedTermCount} unmarked ${wordLabel} set to Well Known. Learning terms stayed in Vocabulary.`,
    { showUndo: true }
  );
}

completeReadingButton?.addEventListener("click", markReadingComplete);

undoFinishButton?.addEventListener("click", () => {
  wordsMarkedAtFinish.forEach((word) => {
    word.classList.remove("word--known");
    word.classList.add("word--new");
    word.dataset.status = "new";
  });
  completeReadingButton.textContent = "Finish lesson";
  completeReadingButton.disabled = false;
  const progressBar = document.querySelector("#reader-progress-bar");
  const progressLabel = document.querySelector("#reader-progress-label");
  if (progressBar) progressBar.style.width = "75%";
  if (progressLabel) progressLabel.textContent = "138 of 184 terms known";
  wordsMarkedAtFinish = [];
  showToast("Completion undone", "The unmarked word is new again.");
});

document.querySelectorAll(".segmented button").forEach((button) => {
  button.addEventListener("click", () => {
    const group = button.closest(".segmented");
    group
      ?.querySelectorAll("button")
      .forEach((candidate) => candidate.classList.toggle("is-active", candidate === button));
  });
});
