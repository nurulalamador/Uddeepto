export const CV_MAX_BYTES = 10 * 1024 * 1024;
export const cvTemplates = ["classic", "modern", "minimal", "executive", "creative"];
export const cvSummary = row => ({
  has_cv: true,
  file_name: row.file_name,
  file_size: row.file_size,
  source: row.source,
  template: row.template,
  updated_at: row.updated_at
});
