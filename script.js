const { jsPDF } = window.jspdf;

// Loader helpers
function getLoaderEl() {
  return document.getElementById("loader");
}
function showLoader(text) {
  const el = getLoaderEl();
  if (!el) return;
  const textEl = el.querySelector(".loader-text");
  if (textEl) textEl.textContent = text || "Processing…";
  el.removeAttribute("hidden");
  el.classList.add("show");
}
function hideLoader() {
  const el = getLoaderEl();
  if (!el) return;
  el.classList.remove("show");
  el.setAttribute("hidden", "");
}

async function makePdf(files, jobName, jobDate, type) {
  if (!files.length) {
    throw new Error(`No ${type} images selected.`);
  }

  const pdf = new jsPDF({ unit: "px", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();

  // --- Page 1: Title ---
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text(`${type} Images for`, pageW/2, pageH/2 - 20, { align: "center" });
  pdf.text(jobName || "Job", pageW/2, pageH/2, { align: "center" });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(14);
  pdf.text(`on ${jobDate || "Unknown Date"}`, pageW/2, pageH/2 + 20, { align: "center" });

  // --- Images ---
  for (let i = 0; i < files.length; i++) {
    const img = await loadImage(files[i]);
    const { canvas } = resizeImage(img, pageW);
    pdf.addPage();
    pdf.addImage(canvas, "JPEG", 0, 0, pageW, Math.min(canvas.height, pageH));
  }

  const safeName = (jobName || "Job").replace(/[^\w\d-_ ]+/g, "").trim() || "Job";
  pdf.save(`${type}_${safeName}_${jobDate || "date"}.pdf`);
}

function loadImage(file) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      res(img);
    };
    img.src = URL.createObjectURL(file);
  });
}

function resizeImage(img, maxW) {
  const ratio = maxW / img.width;
  const canvas = document.createElement("canvas");
  canvas.width = maxW;
  canvas.height = img.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return { canvas };
}

// --- Event bindings ---
document.getElementById("makeBefore").addEventListener("click", async () => {
  const files = (sections.before.pages || []).map(p => p.blob);
  if (!files.length) return alert("Please add some Before images (camera or choose files).");
  showLoader("Generating Before PDF…");
  try {
    await makePdf(
      files,
      document.getElementById("jobName").value,
      document.getElementById("jobDate").value,
      "Before"
    );
  } catch (err) {
    console.error(err);
    alert("Failed to generate Before PDF.");
  } finally {
    hideLoader();
  }
});

document.getElementById("makeAfter").addEventListener("click", async () => {
  const files = (sections.after.pages || []).map(p => p.blob);
  if (!files.length) return alert("Please add some After images (camera or choose files).");
  showLoader("Generating After PDF…");
  try {
    await makePdf(
      files,
      document.getElementById("jobName").value,
      document.getElementById("jobDate").value,
      "After"
    );
  } catch (err) {
    console.error(err);
    alert("Failed to generate After PDF.");
  } finally {
    hideLoader();
  }
});

/* ==== Simplified per-section camera + queue (Before/After) ==== */

const sections = {
  before: { pages: [], stream: null, type: "Before" },
  after:  { pages: [], stream: null, type: "After"  }
};

function el(id) { return document.getElementById(id); }
function other(key) { return key === "before" ? "after" : "before"; }

async function initCameraFor(key) {
  // Only one camera active at a time
  stopCameraFor(other(key));
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia not supported");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    sections[key].stream = stream;
    const video = el(`${key}CameraPreview`);
    if (video) {
      video.srcObject = stream;
      try { await video.play(); } catch (_) {}
    }
    updateUIFor(key);
  } catch (err) {
    console.warn("Camera not available:", err);
    alert("Camera access denied or unavailable. Use Choose Files instead.");
    stopCameraFor(key);
  }
}

function stopCameraFor(key) {
  const s = sections[key].stream;
  if (s) s.getTracks().forEach(t => t.stop());
  sections[key].stream = null;
  const video = el(`${key}CameraPreview`);
  if (video) video.srcObject = null;
  updateUIFor(key);
}

function snapPhotoFor(key) {
  const video = el(`${key}CameraPreview`);
  if (!video || !video.videoWidth || !video.videoHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    sections[key].pages.push({ blob, url });
    renderThumbsFor(key);
    updateUIFor(key);
  }, "image/jpeg", 0.85);
}

function addFilesFor(key, files) {
  const arr = Array.from(files || []);
  for (const file of arr) {
    if (!file.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(file);
    sections[key].pages.push({ blob: file, url });
  }
  const input = el(`${key}CaptureUpload`);
  if (input) input.value = "";
  renderThumbsFor(key);
  updateUIFor(key);
}

function removePageFor(key, idx) {
  const item = sections[key].pages[idx];
  if (item && item.url) URL.revokeObjectURL(item.url);
  sections[key].pages.splice(idx, 1);
  renderThumbsFor(key);
  updateUIFor(key);
}

function clearQueueFor(key) {
  for (const item of sections[key].pages) {
    if (item.url) URL.revokeObjectURL(item.url);
  }
  sections[key].pages = [];
  renderThumbsFor(key);
  updateUIFor(key);
}

function renderThumbsFor(key) {
  const container = el(`${key}Thumbs`);
  if (!container) return;
  container.innerHTML = "";
  // Newest first
  for (let idx = sections[key].pages.length - 1; idx >= 0; idx--) {
    const p = sections[key].pages[idx];
    const div = document.createElement("div");
    div.className = "thumb";
    const img = document.createElement("img");
    img.src = p.url;
    img.alt = `Page ${idx + 1}`;
    const del = document.createElement("button");
    del.className = "delete-btn";
    del.type = "button";
    del.setAttribute("aria-label", `Remove page ${idx + 1}`);
    del.textContent = "×";
    del.addEventListener("click", () => removePageFor(key, idx));
    div.appendChild(img);
    div.appendChild(del);
    container.appendChild(div);
  }
}

function updateUIFor(key) {
  const hasStream = !!sections[key].stream;
  const live = el(`${key}CameraLive`);
  const startBtn = el(`${key}StartCamera`);
  const stopBtn = el(`${key}StopCamera`);
  const shutter = el(`${key}Shutter`);
  if (live) live.classList.toggle("hidden", !hasStream);
  if (startBtn) startBtn.classList.toggle("hidden", hasStream);
  if (stopBtn) stopBtn.disabled = !hasStream;
  if (shutter) shutter.disabled = !hasStream;

  const disabled = sections[key].pages.length === 0;
  if (key === "before") {
    const makeBtn = el("makeBefore");
    if (makeBtn) makeBtn.disabled = disabled;
  } else {
    const makeBtn = el("makeAfter");
    if (makeBtn) makeBtn.disabled = disabled;
  }
  const clearBtn = el(`${key}ClearQueue`);
  if (clearBtn) clearBtn.disabled = disabled;
}

(function bindSections() {
  // Before
  el("beforeStartCamera")?.addEventListener("click", () => initCameraFor("before"));
  el("beforeStopCamera")?.addEventListener("click", () => stopCameraFor("before"));
  el("beforeShutter")?.addEventListener("click", () => snapPhotoFor("before"));
  el("beforeCaptureUpload")?.addEventListener("change", (e) => addFilesFor("before", e.target.files));
  el("beforeClearQueue")?.addEventListener("click", () => clearQueueFor("before"));
  updateUIFor("before");

  // After
  el("afterStartCamera")?.addEventListener("click", () => initCameraFor("after"));
  el("afterStopCamera")?.addEventListener("click", () => stopCameraFor("after"));
  el("afterShutter")?.addEventListener("click", () => snapPhotoFor("after"));
  el("afterCaptureUpload")?.addEventListener("change", (e) => addFilesFor("after", e.target.files));
  el("afterClearQueue")?.addEventListener("click", () => clearQueueFor("after"));
  updateUIFor("after");
})();
