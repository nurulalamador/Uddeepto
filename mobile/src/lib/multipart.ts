export type ApiResponse = Pick<Response, "status" | "ok" | "text">;

/**
 * Expo 58's global fetch rejects React Native's { uri, name, type } file parts.
 * XMLHttpRequest uses RN's native multipart encoder, which reads those files
 * directly and preserves their filenames, MIME types and repeated field names.
 */
export function sendMultipart(
  url: string,
  method: string,
  headers: Record<string, string>,
  form: FormData,
  signal?: AbortSignal,
): Promise<ApiResponse> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest();
    const abortError = () => new DOMException("The upload was cancelled.", "AbortError");
    const abort = () => request.abort();
    const cleanup = () => signal?.removeEventListener("abort", abort);

    if (signal?.aborted) {
      reject(abortError());
      return;
    }

    request.onload = () => {
      cleanup();
      const status = request.status;
      const text = request.responseText;
      resolve({ status, ok: status >= 200 && status < 300, text: async () => text });
    };
    request.onerror = () => {
      cleanup();
      reject(new TypeError("Network request failed"));
    };
    request.onabort = () => {
      cleanup();
      reject(abortError());
    };

    try {
      request.open(method, url);
      for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
      // Leave Content-Type unset: the native encoder supplies the multipart boundary.
      signal?.addEventListener("abort", abort, { once: true });
      request.send(form);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
