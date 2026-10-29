import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { authHeaders, fileUrl } from "./api";

/** Downloads a protected file from the API into the cache and returns it. */
export async function download(path: string, name: string) {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  await File.downloadFileAsync(fileUrl(path), file, { headers: authHeaders() || {} });
  return file;
}

/** Downloads a file and opens the phone's share / "open with" sheet for it. */
export async function downloadAndShare(path: string, name: string, mimeType?: string) {
  const file = await download(path, name);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  return file;
}

export async function shareFile(uri: string, mimeType?: string, title?: string) {
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType, dialogTitle: title });
}
