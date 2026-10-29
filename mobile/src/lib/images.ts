import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";

export type Upload = { uri: string; name: string; type: string };

/**
 * Shrinks a picture before it is sent: phone photos are several megabytes, which the server (or the network in front of it)
 * can refuse. The server optimises again, so this only has to make the upload small enough to arrive.
 */
export async function prepareImage(asset: ImagePickerAsset, max = 1600): Promise<Upload> {
  const base = (asset.fileName || `picture-${Date.now()}`).replace(/\.[^.]+$/, "");
  try {
    const actions: ImageManipulator.Action[] = [];
    if (asset.width && asset.height && Math.max(asset.width, asset.height) > max) actions.push({ resize: asset.width >= asset.height ? { width: max } : { height: max } });
    const saved = await ImageManipulator.manipulateAsync(asset.uri, actions, { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG });
    return { uri: saved.uri, name: `${base}.jpg`, type: "image/jpeg" };
  } catch {
    return { uri: asset.uri, name: asset.fileName || `${base}.jpg`, type: asset.mimeType || "image/jpeg" };
  }
}
