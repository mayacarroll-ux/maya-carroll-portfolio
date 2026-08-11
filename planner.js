// Interactive dual-timezone schedule planner. Reads/writes the shared block
// model in schedule.js (window.MayaSchedule). Miami time is canonical and
// editable (drag/resize/form); Helsinki is always a live-derived, read-only
// projection — see schedule.js for why.
(function () {
  const S = window.MayaSchedule;
  if (!S) return;

  let blocks = S.loadBlocks();
  let prefs = S.loadPrefs();
  let editingId = null; // null while adding a new block

  function persistBlocks() {
    S.saveBlocks(blocks);
    render();
  }

  // ---------- Theme (same pattern as index.html) ----------
  const themeToggle = document.getElementById("theme-toggle");
  const themeIcon = document.getElementById("theme-icon");
  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    themeIcon.textContent = theme === "dark" ? "🌙" : "☀️";
    themeToggle.setAttribute("aria-label", theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
  }
  applyTheme(document.documentElement.getAttribute("data-theme") || "light");
  themeToggle.addEventListener("click", () => {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
  });

  // ---------- Clocks ----------
  const clockEls = {
    miami: {
      time: document.getElementById("clock-time-miami"),
      date: document.getElementById("clock-date-miami"),
      dot: document.getElementById("clock-daydot-miami"),
      label: document.getElementById("clock-daylabel-miami"),
      temp: document.getElementById("clock-temp-miami"),
    },
    helsinki: {
      time: document.getElementById("clock-time-helsinki"),
      date: document.getElementById("clock-date-helsinki"),
      dot: document.getElementById("clock-daydot-helsinki"),
      label: document.getElementById("clock-daylabel-helsinki"),
      temp: document.getElementById("clock-temp-helsinki"),
    },
  };

  function readWeatherCache() {
    try {
      return JSON.parse(localStorage.getItem("weatherCache")) || {};
    } catch (e) {
      return {};
    }
  }

  function renderClocks() {
    const now = new Date();
    Object.keys(S.SCHEDULE_CITIES).forEach((city) => {
      const cfg = S.SCHEDULE_CITIES[city];
      const hourFloat = S.hourFloatInZone(now, cfg.timeZone);
      const els = clockEls[city];
      els.time.textContent = S.formatHour(hourFloat, prefs.format);
      els.date.textContent = new Intl.DateTimeFormat(undefined, {
        timeZone: cfg.timeZone,
        weekday: "short",
        month: "short",
        day: "numeric",
      }).format(now);
      // Simple fixed day/night window (6:00–20:00 local) — an approximation
      // for this supplementary display, not the precise solar calculation
      // used elsewhere on the site.
      const isDay = hourFloat >= 6 && hourFloat < 20;
      els.dot.className = `day-dot ${isDay ? "is-day" : "is-night"}`;
      els.label.textContent = isDay ? "Daylight" : "Night";

      const cache = readWeatherCache();
      const entry = cache[city];
      if (entry && entry.tempC != null) {
        const unit = city === "miami" ? "F" : "C";
        const value = unit === "F" ? (entry.tempC * 9) / 5 + 32 : entry.tempC;
        els.temp.textContent = `${Math.round(value)}°${unit}`;
      } else {
        els.temp.textContent = "—";
      }
    });

    const summary = S.summarize(blocks, now);
    const notice = document.getElementById("dst-notice");
    if (summary.isDstGap) {
      notice.textContent = `Miami and Helsinki are currently ${Math.abs(summary.offsetDiff)} hours apart — a temporary shift from the usual 7, during a daylight-saving transition week.`;
      notice.classList.add("is-visible");
    } else {
      notice.classList.remove("is-visible");
    }
  }

  // ---------- Legend ----------
  function renderLegend() {
    const legend = document.getElementById("legend");
    legend.innerHTML = Object.keys(S.BLOCK_TYPES)
      .map((type) => {
        const t = S.BLOCK_TYPES[type];
        const sample = blocks.find((b) => b.type === type) || { color: "#888" };
        return `<span class="legend-item"><span class="swatch" style="background:${sample.color}"></span>${t.icon} ${t.label}</span>`;
      })
      .join("");
  }

  // ---------- Timelines ----------
  const TICK_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

  function tickLabel(hour) {
    return S.formatHour(hour, prefs.format).replace(":00", "");
  }

  function renderTimelines() {
    const container = document.getElementById("timelines");
    const order = prefs.cityOrder === "helsinki" ? ["helsinki", "miami"] : ["miami", "helsinki"];
    const now = new Date();

    container.innerHTML = order
      .map((city) => {
        const editable = city === "miami";
        const { laneOf, laneCount } = S.assignLanes(blocks.filter((b) => b.enabled || true));
        const nowHour =
          city === "miami"
            ? S.hourFloatInZone(now, S.SCHEDULE_CITIES.miami.timeZone)
            : S.hourFloatInZone(now, S.SCHEDULE_CITIES.helsinki.timeZone);

        const ticks = TICK_HOURS.map((h) => `<span style="left:${(h / 24) * 100}%">${tickLabel(h)}</span>`).join("");

        const lanes = Array.from({ length: laneCount }, () => []);
        blocks.forEach((block) => {
          const lane = laneOf.get(block.id) || 0;
          lanes[lane].push(block);
        });

        const laneHtml = lanes
          .map((laneBlocks, laneIndex) =>
            `<div class="lane" data-lane="${laneIndex}">` +
            laneBlocks.map((block) => renderBlockPieces(block, city, editable)).join("") +
            `</div>`
          )
          .join("");

        return `
          <div class="timeline-block-wrap">
            <div class="timeline-header">
              <span class="city-name">${S.SCHEDULE_CITIES[city].label}${editable ? "" : " (derived)"}</span>
            </div>
            <div class="timeline-ticks">${ticks}</div>
            <div class="timeline-track" data-city="${city}" data-editable="${editable}">
              <div class="now-line" style="left:${(nowHour / 24) * 100}%"></div>
              ${laneHtml}
            </div>
          </div>
        `;
      })
      .join("");

    wireBlockInteractions();
  }

  function renderBlockPieces(block, city, editable) {
    const [start, end] =
      city === "miami"
        ? [block.startHour, block.endHour]
        : [S.miamiHourToHelsinki(block.startHour, new Date()), S.miamiHourToHelsinki(block.endHour, new Date())];

    const type = S.BLOCK_TYPES[block.type] || { icon: "", label: block.type };
    const disabledClass = block.enabled ? "" : "is-disabled";

    function piece(s, e) {
      const left = (s / 24) * 100;
      const width = ((e - s + 24) % 24 || 24) * (100 / 24);
      const handles = editable
        ? `<span class="resize-handle left" data-role="resize-left"></span><span class="resize-handle right" data-role="resize-right"></span>`
        : "";
      return `<div class="block ${disabledClass}" data-id="${block.id}" data-editable="${editable}"
                style="left:${left}%;width:${width}%;background:${block.color}"
                tabindex="${editable ? 0 : -1}"
                role="button"
                aria-label="${type.label}: ${block.name}, ${S.formatHour(block.startHour, prefs.format)} to ${S.formatHour(block.endHour, prefs.format)} Miami time${block.enabled ? "" : " (disabled)"}">
                ${handles}
                <span class="block-icon">${type.icon}</span><span class="block-label">${block.name}</span>
              </div>`;
    }

    if (end > start) return piece(start, end);
    // Wraps midnight: render as two pieces sharing the same block id.
    return piece(start, 24) + piece(0, end);
  }

  // ---------- Drag / resize (Miami track only; Helsinki is derived/read-only) ----------
  function wireBlockInteractions() {
    document.querySelectorAll('.block[data-editable="true"]').forEach((el) => {
      el.addEventListener("click", (e) => {
        if (e.target.dataset.role) return; // handled by resize listeners
        openEditor(el.dataset.id);
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openEditor(el.dataset.id);
        }
      });

      const track = el.closest(".timeline-track");

      el.addEventListener("pointerdown", (e) => {
        if (e.target.dataset.role) return; // resize handles have their own listener
        startDrag(e, el, track, "move");
      });
      el.querySelectorAll('[data-role="resize-left"]').forEach((h) =>
        h.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          startDrag(e, el, track, "resize-left");
        })
      );
      el.querySelectorAll('[data-role="resize-right"]').forEach((h) =>
        h.addEventListener("pointerdown", (e) => {
          e.stopPropagation();
          startDrag(e, el, track, "resize-right");
        })
      );
    });
  }

  function startDrag(e, el, track, mode) {
    const id = el.dataset.id;
    const block = blocks.find((b) => b.id === id);
    if (!block) return;
    e.preventDefault();
    const trackRect = track.getBoundingClientRect();
    const startX = e.clientX;
    const origStart = block.startHour;
    const origEnd = block.endHour;
    const origDuration = S.blockDurationHours(block);
    let moved = false;

    function onMove(ev) {
      const deltaPx = ev.clientX - startX;
      const deltaHours = (deltaPx / trackRect.width) * 24;
      if (Math.abs(deltaPx) > 3) moved = true;

      if (mode === "move") {
        const newStart = ((origStart + deltaHours) % 24 + 24) % 24;
        const newEnd = ((origEnd + deltaHours) % 24 + 24) % 24;
        block.startHour = snap(newStart);
        block.endHour = snap(newEnd);
      } else if (mode === "resize-left") {
        let newStart = ((origStart + deltaHours) % 24 + 24) % 24;
        newStart = snap(newStart);
        if (S.blockDurationHours({ startHour: newStart, endHour: origEnd }) >= 0.25) {
          block.startHour = newStart;
        }
      } else if (mode === "resize-right") {
        let newEnd = ((origEnd + deltaHours) % 24 + 24) % 24;
        newEnd = snap(newEnd);
        if (S.blockDurationHours({ startHour: origStart, endHour: newEnd }) >= 0.25) {
          block.endHour = newEnd;
        }
      }
      renderTimelines();
    }

    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      if (moved) {
        persistBlocks();
      } else if (mode === "move") {
        openEditor(id); // treat as a click if it didn't actually move
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  function snap(hour) {
    return Math.round(hour * 4) / 4; // nearest 15 minutes
  }

  // ---------- Block list (accessible text alternative) ----------
  function renderBlockList() {
    const list = document.getElementById("block-list");
    list.innerHTML = blocks
      .map((block) => {
        const type = S.BLOCK_TYPES[block.type] || { icon: "", label: block.type };
        const helsinkiStart = S.miamiHourToHelsinki(block.startHour, new Date());
        const helsinkiEnd = S.miamiHourToHelsinki(block.endHour, new Date());
        return `
          <li>
            <span class="block-swatch" style="background:${block.color}" aria-hidden="true"></span>
            <span class="block-name">${type.icon} ${block.name}</span>
            <span class="block-times">
              Miami ${S.formatHour(block.startHour, prefs.format)}–${S.formatHour(block.endHour, prefs.format)} ·
              Helsinki ${S.formatHour(helsinkiStart, prefs.format)}–${S.formatHour(helsinkiEnd, prefs.format)}
            </span>
            <button type="button" class="btn btn-small" data-edit="${block.id}">Edit</button>
            <button type="button" class="btn btn-small" data-toggle="${block.id}">${block.enabled ? "Disable" : "Enable"}</button>
          </li>
        `;
      })
      .join("");

    list.querySelectorAll("[data-edit]").forEach((btn) =>
      btn.addEventListener("click", () => openEditor(btn.dataset.edit))
    );
    list.querySelectorAll("[data-toggle]").forEach((btn) =>
      btn.addEventListener("click", () => {
        blocks = S.toggleBlock(blocks, btn.dataset.toggle);
        persistBlocks();
      })
    );
  }

  // ---------- Summary ----------
  function renderSummary() {
    const summary = S.summarize(blocks, new Date());
    const grid = document.getElementById("summary-grid");
    const stats = [
      ["Sleep", summary.sleepHours],
      ["Focused work", summary.focusHours],
      ["Meetings", summary.meetingHours],
      ["Miami 9–5 overlap", summary.miamiBusinessOverlap],
      ["Helsinki 9–5 overlap", summary.helsinkiBusinessOverlap],
    ];
    grid.innerHTML = stats
      .map(
        ([label, hours]) =>
          `<div class="stat"><span class="stat-value">${hours.toFixed(1)}h</span><span class="stat-label">${label}</span></div>`
      )
      .join("");
  }

  // ---------- Editor ----------
  const backdrop = document.getElementById("editor-backdrop");
  const form = document.getElementById("editor-form");
  const fieldName = document.getElementById("field-name");
  const fieldType = document.getElementById("field-type");
  const fieldStart = document.getElementById("field-start");
  const fieldEnd = document.getElementById("field-end");
  const fieldColor = document.getElementById("field-color");
  const fieldEnabled = document.getElementById("field-enabled");
  const helsinkiPreview = document.getElementById("helsinki-preview");
  const durationDisplay = document.getElementById("duration-display");
  const overlapWarning = document.getElementById("overlap-warning");
  const editorTitle = document.getElementById("editor-title");

  function hourToTimeInput(hour) {
    const h = Math.floor(hour);
    const m = Math.round((hour - h) * 60);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  function timeInputToHour(value) {
    const [h, m] = value.split(":").map(Number);
    return h + m / 60;
  }

  function openEditor(id) {
    editingId = id || null;
    const block = id
      ? blocks.find((b) => b.id === id)
      : { name: "New block", type: "personal", startHour: 12, endHour: 13, color: "#f4b860", enabled: true };

    editorTitle.textContent = id ? "Edit block" : "Add block";
    fieldName.value = block.name;
    fieldType.value = block.type;
    fieldStart.value = hourToTimeInput(block.startHour);
    fieldEnd.value = hourToTimeInput(block.endHour);
    fieldColor.value = block.color;
    fieldEnabled.checked = block.enabled;
    document.getElementById("delete-btn").style.display = id ? "" : "none";
    document.getElementById("duplicate-btn").style.display = id ? "" : "none";
    updateEditorPreview();
    backdrop.classList.add("is-open");
    fieldName.focus();
  }

  function closeEditor() {
    backdrop.classList.remove("is-open");
    editingId = null;
  }

  function updateEditorPreview() {
    const start = timeInputToHour(fieldStart.value || "00:00");
    const end = timeInputToHour(fieldEnd.value || "00:00");
    const hStart = S.miamiHourToHelsinki(start, new Date());
    const hEnd = S.miamiHourToHelsinki(end, new Date());
    helsinkiPreview.textContent = `Helsinki: ${S.formatHour(hStart, prefs.format)} – ${S.formatHour(hEnd, prefs.format)}`;
    const duration = S.blockDurationHours({ startHour: start, endHour: end });
    durationDisplay.textContent = `Duration: ${duration.toFixed(2)}h`;

    const candidate = { id: editingId || "__draft__", startHour: start, endHour: end, enabled: true };
    const others = blocks.filter((b) => b.id !== editingId && b.enabled);
    const overlaps = others.some((b) => S.blocksOverlap(candidate, b));
    overlapWarning.classList.toggle("is-visible", overlaps);
  }

  [fieldStart, fieldEnd].forEach((el) => el.addEventListener("input", updateEditorPreview));

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const block = {
      name: fieldName.value.trim() || "Untitled block",
      type: fieldType.value,
      startHour: timeInputToHour(fieldStart.value),
      endHour: timeInputToHour(fieldEnd.value),
      color: fieldColor.value,
      enabled: fieldEnabled.checked,
    };
    const { valid, errors } = S.validateBlock(block);
    if (!valid) {
      alert(errors.join("\n"));
      return;
    }
    if (editingId) {
      blocks = S.updateBlock(blocks, editingId, block);
    } else {
      blocks = S.addBlock(blocks, block);
    }
    closeEditor();
    persistBlocks();
  });

  document.getElementById("cancel-btn").addEventListener("click", closeEditor);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeEditor();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && backdrop.classList.contains("is-open")) closeEditor();
  });

  document.getElementById("delete-btn").addEventListener("click", () => {
    if (!editingId) return;
    if (!confirm("Delete this block?")) return;
    blocks = S.deleteBlock(blocks, editingId);
    closeEditor();
    persistBlocks();
  });
  document.getElementById("duplicate-btn").addEventListener("click", () => {
    if (!editingId) return;
    blocks = S.duplicateBlock(blocks, editingId);
    closeEditor();
    persistBlocks();
  });

  document.getElementById("add-block-btn").addEventListener("click", () => openEditor(null));

  // ---------- Toolbar ----------
  document.getElementById("restore-btn").addEventListener("click", () => {
    if (!confirm("Restore the recommended schedule? This replaces your current blocks.")) return;
    blocks = S.restoreDefaultBlocks();
    persistBlocks();
  });

  document.getElementById("export-btn").addEventListener("click", () => {
    const json = S.exportBlocksJSON(blocks);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "maya-schedule.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  const importInput = document.getElementById("import-input");
  const importError = document.getElementById("import-error");
  document.getElementById("import-btn").addEventListener("click", () => importInput.click());
  importInput.addEventListener("change", () => {
    const file = importInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = S.importBlocksJSON(String(reader.result));
      if (!result.ok) {
        importError.textContent = result.error;
        importError.classList.add("is-visible");
        return;
      }
      importError.classList.remove("is-visible");
      blocks = result.blocks;
      persistBlocks();
    };
    reader.readAsText(file);
    importInput.value = "";
  });

  function setPref(key, value) {
    prefs[key] = value;
    S.savePrefs(prefs);
    render();
  }

  document.getElementById("order-miami-btn").addEventListener("click", () => setOrderButtons("miami"));
  document.getElementById("order-helsinki-btn").addEventListener("click", () => setOrderButtons("helsinki"));
  function setOrderButtons(order) {
    document.getElementById("order-miami-btn").setAttribute("aria-pressed", String(order === "miami"));
    document.getElementById("order-helsinki-btn").setAttribute("aria-pressed", String(order === "helsinki"));
    setPref("cityOrder", order);
  }

  document.getElementById("format-12-btn").addEventListener("click", () => setFormatButtons("12"));
  document.getElementById("format-24-btn").addEventListener("click", () => setFormatButtons("24"));
  function setFormatButtons(format) {
    document.getElementById("format-12-btn").setAttribute("aria-pressed", String(format === "12"));
    document.getElementById("format-24-btn").setAttribute("aria-pressed", String(format === "24"));
    setPref("format", format);
  }

  // ---------- Init ----------
  function render() {
    renderClocks();
    renderLegend();
    renderTimelines();
    renderBlockList();
    renderSummary();
  }

  setOrderButtons(prefs.cityOrder || "miami");
  setFormatButtons(prefs.format || "12");
  render();
  setInterval(render, 60 * 1000);
})();
