const { jsPDF } = window.jspdf;

async function makePdf(files, jobName, jobDate, type) {
  if (!files.length) return alert(`Please select some ${type} images.`);

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
    if (i >= 0) pdf.addPage();
    pdf.addImage(canvas, "JPEG", 0, 0, pageW, Math.min(canvas.height, pageH));
  }

  const safeName = jobName.replace(/[^\w\d-_ ]+/g, "").trim() || "Job";
  pdf.save(`${type}_${safeName}_${jobDate || "date"}.pdf`);
}

function loadImage(file) {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res(img);
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
document.getElementById("makeBefore").addEventListener("click", () => {
  const files = [...document.getElementById("beforeFiles").files];
  makePdf(files, document.getElementById("jobName").value, document.getElementById("jobDate").value, "Before");
});

document.getElementById("makeAfter").addEventListener("click", () => {
  const files = [...document.getElementById("afterFiles").files];
  makePdf(files, document.getElementById("jobName").value, document.getElementById("jobDate").value, "After");
});
