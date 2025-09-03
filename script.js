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
  const files = [...document.getElementById("beforeFiles").files];
  if (!files.length) return alert("Please select some Before images.");
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
  const files = [...document.getElementById("afterFiles").files];
  if (!files.length) return alert("Please select some After images.");
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

// ==== Milestone 1: Basic camera capture + queue ====
let pages = [];
let cameraStream = null;

function getEl(id) {
  return document.getElementById(id);
}

async function initCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("getUserMedia not supported");
    }
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" } },
      audio: false
    });
    const video = getEl("cameraPreview");
    if (video) {
      video.srcObject = cameraStream;
      try { await video.play(); } catch (_) {}
    }
    updateUI();
  } catch (err) {
    console.warn("Camera not available:", err);
    alert("Camera access denied or unavailable. Use Upload Photos instead.");
    stopCamera();
  }
}

function stopCamera() {
  if (cameraStream) {
    for (const track of cameraStream.getTracks()) track.stop();
  }
  cameraStream = null;
  const video = getEl("cameraPreview");
  if (video) video.srcObject = null;
  updateUI();
}

function snapPhoto() {
  const video = getEl("cameraPreview");
  if (!video || !video.videoWidth || !video.videoHeight) return;
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    pages.push({ blob, url });
    renderThumbs();
    updateUI();
  }, "image/jpeg", 0.85);
}

function addFilesFromPicker(files) {
  const arr = Array.from(files || []);
  for (const file of arr) {
    if (!file.type.startsWith("image/")) continue;
    const url = URL.createObjectURL(file);
    pages.push({ blob: file, url });
  }
  const input = getEl("captureUpload");
  if (input) input.value = "";
  renderThumbs();
  updateUI();
}

function removePage(index) {
  const item = pages[index];
  if (item && item.url) URL.revokeObjectURL(item.url);
  pages.splice(index, 1);
  renderThumbs();
  updateUI();
}

function clearQueue() {
  for (const item of pages) {
    if (item.url) URL.revokeObjectURL(item.url);
  }
  pages = [];
  renderThumbs();
  updateUI();
}

function renderThumbs() {
  const container = getEl("thumbs");
  if (!container) return;
  container.innerHTML = "";
  pages.forEach((p, idx) => {
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
    del.addEventListener("click", () => removePage(idx));
    div.appendChild(img);
    div.appendChild(del);
    container.appendChild(div);
  });
}

function updateUI() {
  const live = getEl("cameraLive");
  const startBtn = getEl("startCamera");
  const stopBtn = getEl("stopCamera");
  const shutter = getEl("shutter");
  const hasStream = !!cameraStream;
  if (live) live.classList.toggle("hidden", !hasStream);
  if (startBtn) startBtn.classList.toggle("hidden", hasStream);
  if (stopBtn) stopBtn.disabled = !hasStream;
  if (shutter) shutter.disabled = !hasStream;

  const disabled = pages.length === 0;
  const beforeQ = getEl("makeBeforeFromQueue");
  const afterQ = getEl("makeAfterFromQueue");
  const clearBtn = getEl("clearQueue");
  if (beforeQ) beforeQ.disabled = disabled;
  if (afterQ) afterQ.disabled = disabled;
  if (clearBtn) clearBtn.disabled = disabled;
}

// Event bindings for capture/queue
(function bindCaptureEvents() {
  const startBtn = getEl("startCamera");
  const stopBtn = getEl("stopCamera");
  const shutter = getEl("shutter");
  const upload = getEl("captureUpload");
  const clearBtn = getEl("clearQueue");
  const beforeQ = getEl("makeBeforeFromQueue");
  const afterQ = getEl("makeAfterFromQueue");

  if (startBtn) startBtn.addEventListener("click", initCamera);
  if (stopBtn) stopBtn.addEventListener("click", stopCamera);
  if (shutter) shutter.addEventListener("click", snapPhoto);
  if (upload) upload.addEventListener("change", (e) => addFilesFromPicker(e.target.files));
  if (clearBtn) clearBtn.addEventListener("click", clearQueue);

  if (beforeQ) beforeQ.addEventListener("click", async () => {
    if (!pages.length) return alert("No images in queue.");
    showLoader("Generating Before PDF…");
    try {
      await makePdf(
        pages.map(p => p.blob),
        getEl("jobName").value,
        getEl("jobDate").value,
        "Before"
      );
    } catch (err) {
      console.error(err);
      alert("Failed to generate Before PDF.");
    } finally {
      hideLoader();
    }
  });

  if (afterQ) afterQ.addEventListener("click", async () => {
    if (!pages.length) return alert("No images in queue.");
    showLoader("Generating After PDF…");
    try {
      await makePdf(
        pages.map(p => p.blob),
        getEl("jobName").value,
        getEl("jobDate").value,
        "After"
      );
    } catch (err) {
      console.error(err);
      alert("Failed to generate After PDF.");
    } finally {
      hideLoader();
    }
  });
})();

// initialize UI state
updateUI();
