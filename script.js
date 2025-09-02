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
