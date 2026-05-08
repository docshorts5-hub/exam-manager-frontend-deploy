import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

function cleanFileName(fileName: string): string {
  return fileName
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .trim();
}

export async function uploadPdf(file: Blob, fileName: string): Promise<string> {
  const storage = getStorage();
  const safeFileName = cleanFileName(fileName || `task-distribution-${Date.now()}.pdf`);
  const storageRef = ref(storage, `task-distribution-pdfs/${safeFileName}`);

  await uploadBytes(storageRef, file, {
    contentType: "application/pdf",
  });

  return getDownloadURL(storageRef);
}
