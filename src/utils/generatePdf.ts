import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export async function generatePdf(element: HTMLElement): Promise<Blob> {
  const hiddenElements = element.querySelectorAll<HTMLElement>(".no-print");
  const oldDisplays: string[] = [];

  hiddenElements.forEach((node, index) => {
    oldDisplays[index] = node.style.display;
    node.style.display = "none";
  });

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    const imgData = canvas.toDataURL("image/png", 1.0);
    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    return pdf.output("blob");
  } finally {
    hiddenElements.forEach((node, index) => {
      node.style.display = oldDisplays[index] || "";
    });
  }
}
